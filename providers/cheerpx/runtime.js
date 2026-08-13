// CheerpX runtime: load the engine, build the device stack, boot Linux.
//
// Everything here encodes something a spike proved the hard way. The three
// constants that look like trivia are not:
//
//   - the image must have 4096-byte blocks, or Linux.create reports
//     "Invalid disk image" (see images/cheerpx/build-ext2.sh)
//   - /vmbro/in and /vmbro/out must already exist in the image, or the mount is
//     refused and the boot never completes
//   - the HTTP server must send Last-Modified or ETag, or HttpBytesDevice
//     refuses to initialise
//
// The engine is vendored under vendor/cheerpx/<version>/ and served from our
// own origin. Upstream ships it only from Leaning's CDN, which made that CDN a
// hard runtime dependency and ruled out working offline; vendor/cheerpx/fetch.sh
// pins a copy instead. It cannot be bundled: cx_esm.js finds its siblings by
// throwing an Error and reading its own URL out of the stack trace, so it must
// stay a separate file, under that exact name, beside the rest of the closure.

export const CHEERPX_VERSION = '1.3.7';
const VENDORED = version => new URL(`../../vendor/cheerpx/${version}/cx.esm.js`, import.meta.url).href;

/** Where the host↔guest transfer devices are mounted inside the guest. */
export const GUEST_IN = '/vmbro/in';
export const GUEST_OUT = '/vmbro/out';

/** Linux.create never settles on a bad mount, so every boot is raced. */
const BOOT_TIMEOUT_MS = 180_000;

let enginePromise = null;

/**
 * Import the CheerpX engine. Cached: the CDN module is a singleton and
 * re-importing it per page load is wasted network.
 */
export function loadCheerpX(version = CHEERPX_VERSION) {
  enginePromise ??= import(/* @vite-ignore */ VENDORED(version)).catch(error => {
    enginePromise = null; // let a retry work after a transient network failure
    throw new Error(
      `Could not load the vendored CheerpX engine (${version}) from ` +
      `vendor/cheerpx/${version}/. These files are not fetched at build time — ` +
      `restore them with:\n\n  sh vendor/cheerpx/fetch.sh ${version}\n\n` +
      `and make sure the whole directory is deployed, not just cx.esm.js. ` +
      `Underlying error: ${error?.message ?? error}`,
    );
  });
  return enginePromise;
}

/** wss:// is Leaning's streaming disk protocol; anything else is a range-served file. */
async function createBlockDevice(CheerpX, diskUrl) {
  if (/^wss?:\/\//i.test(diskUrl)) return CheerpX.CloudDevice.create(diskUrl);
  return CheerpX.HttpBytesDevice.create(new URL(diskUrl, location.href).href).catch(error => {
    const message = String(error?.message ?? error);
    if (/Last-Modified|Etag/i.test(message)) {
      throw new Error(
        `The server hosting ${diskUrl} must send a Last-Modified or ETag header — ` +
        `CheerpX needs a validator to detect the disk changing underneath it. ` +
        `It must also support HTTP Range (206). Underlying error: ${message}`,
      );
    }
    throw error;
  });
}

/**
 * Boot a CheerpX guest.
 *
 * Returns the pieces the guest client needs: the Linux instance, the DataDevice
 * that carries host→guest bytes, and the IDBDevice that carries guest→host
 * bytes. Callers attach their own console.
 */
export async function createRuntime({
  diskUrl,
  tier = 'default',
  onProgress = () => {},
  bootTimeoutMs = BOOT_TIMEOUT_MS,
  version = CHEERPX_VERSION,
  imageVersion = '',
} = {}) {
  if (!diskUrl) throw new Error('createRuntime requires a diskUrl');
  if (!globalThis.crossOriginIsolated) {
    throw new Error(
      'CheerpX requires a cross-origin-isolated page (COOP: same-origin, COEP: require-corp). ' +
      'SharedArrayBuffer is unavailable without it.',
    );
  }

  onProgress({ phase: 'engine', message: 'Loading CheerpX…' });
  const CheerpX = await loadCheerpX(version);

  onProgress({ phase: 'devices', message: 'Preparing disk…' });
  const block = await createBlockDevice(CheerpX, diskUrl);
  // The overlay keeps guest writes in IndexedDB, per tier AND per image version,
  // so switching tiers does not inherit another tier's filesystem and a new
  // image is actually seen.
  //
  // The version half is not decoration. This key was tier-only, and publishing a
  // rebuilt image then changed nothing for anyone who had already booted: the
  // overlay still had the old blocks, so the guest kept the old filesystem and a
  // newly added command was simply "not found". The boot even looked healthy --
  // 97 ms, because it never went to the network. v86 gets this for free by
  // putting the version in the image URL; here the cache is ours to key.
  const overlayKey = `vmbro-cx-root-${tier}${imageVersion ? `-${imageVersion}` : ''}`;
  const overlay = await CheerpX.OverlayDevice.create(
    block,
    await CheerpX.IDBDevice.create(overlayKey),
  );
  // Drop this tier's overlays from earlier image versions. Without it every
  // published image leaves its predecessor behind in IndexedDB forever, and
  // these are gigabyte-scale disks. Best-effort: databases() is Chromium-only
  // and a failure here must never stop a boot.
  if (imageVersion && navigator.storage && indexedDB.databases) {
    indexedDB.databases().then(dbs => {
      for (const { name } of dbs ?? []) {
        if (name && name.startsWith(`vmbro-cx-root-${tier}-`) && name !== overlayKey) {
          indexedDB.deleteDatabase(name);
        }
      }
    }).catch(() => {});
  }
  const dataIn = await CheerpX.DataDevice.create();
  const idbOut = await CheerpX.IDBDevice.create(`vmbro-cx-out-${tier}`);

  onProgress({ phase: 'boot', message: 'Booting Linux…' });
  const started = Date.now();
  const cx = await Promise.race([
    CheerpX.Linux.create({
      mounts: [
        { type: 'ext2', path: '/', dev: overlay },
        { type: 'dir', path: GUEST_IN, dev: dataIn },
        { type: 'dir', path: GUEST_OUT, dev: idbOut },
        { type: 'devs', path: '/dev' },
        { type: 'proc', path: '/proc' },
      ],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(
      `CheerpX did not finish booting within ${Math.round(bootTimeoutMs / 1000)}s.

` +
      `Two very different causes look identical here, because Linux.create does not ` +
      `reject on failure — it simply never settles.

` +
      `1. The disk is still being fetched. CheerpX demand-pages the image over HTTP ` +
      `Range, so a cold boot on a slow link can exceed this timeout while working ` +
      `perfectly. Check the Network panel: steadily arriving 206 responses mean it is ` +
      `slow, not broken, and it will boot from cache next time.
` +
      `2. The image is wrong. A missing mount parent (${GUEST_IN}, ${GUEST_OUT}) or a ` +
      `block size other than 4096 hangs it forever, with no requests in flight. The ` +
      `console shows "Could not mount FS type".`,
    )), bootTimeoutMs)),
  ]);

  onProgress({ phase: 'ready', message: 'Guest ready', bootMs: Date.now() - started });
  return { CheerpX, cx, dataIn, idbOut, bootMs: Date.now() - started };
}
