import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const worker = await readFile(new URL("service-worker.js", root), "utf8");
const nginx = await readFile(new URL("network/deploy/fapstaff-peerjs.nginx", root), "utf8");
const manifest = JSON.parse(await readFile(new URL("app.webmanifest", root), "utf8"));

test("VMVM exposes an installable standalone PWA manifest", () => {
  assert.match(html, /rel="manifest" href="app\.webmanifest"/);
  assert.equal(manifest.start_url, "/?role=agent");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some(icon => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable"));
	assert.match(nginx, /location = \/app\.webmanifest \{[\s\S]*default_type application\/manifest\+json;/);
});

test("Settings provides browser-native installation UX", () => {
  assert.match(html, /id="pwa-settings-title">App installation</);
  assert.match(html, /addEventListener\("beforeinstallprompt"/);
  assert.match(html, /await prompt\.prompt\(\)/);
  assert.match(html, /addEventListener\("appinstalled"/);
});

test("service worker caches the shell but excludes VM and model payloads", () => {
  assert.match(worker, /cache\.addAll\(APP_SHELL\)/);
  assert.match(worker, /request\.headers\.has\("range"\)/);
  // Both disk formats: .img is the v86 tier image, .ext2 the CheerpX one.
  // Caching either would put a 150-450 MB payload in the app-shell cache.
  const payloadLine = worker.split('\n').find(line => line.includes('litertlm'));
  const payloadTypes = payloadLine.match(/\(\?:([^)]*)\)/)[1].split('|');
  assert.deepEqual(payloadTypes, ['img', 'ext2', 'litertlm', 'task', 'zip']);
  // Read the excluded prefixes out of the worker and compare them as a set,
  // rather than restating the alternation as one long regex. The previous form
  // spelled the list out a second time, so when network/browser became shared/
  // and providers/, the worker went on excluding a directory that no longer
  // existed and this assertion still passed -- it agreed with its own copy of
  // the list, not with the tree.
  const exclusionLine = worker.split('\n').find(line => line.includes('models|downloads'));
  assert.ok(exclusionLine, 'service worker has no path-prefix exclusion list');
  const excluded = exclusionLine.match(/\(\?:([^)]*)\)/)[1].split('|').map(name => name.replace(/\\/g, ''));
  assert.deepEqual(
    excluded,
    ['models', 'downloads', 'agent/dist', 'shared', 'providers', 'cx', 'vendor', 'ide', 'preview', 'v1', 'peerjs', 'plu'],
  );
  assert.match(worker, /offline\.html/);
	assert.match(worker, /agent\\\/dist/);
  assert.match(worker, /vmvm-app-shell-v8/);
	assert.match(worker, /fetch\(request, \{ cache: "no-cache" \}\)/);
});
