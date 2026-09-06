import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('images/v86/vm-images.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const devIndex = await readFile(new URL('network/guest/dev-template/dist/index.html', root), 'utf8');
const devIdeIndex = await readFile(new URL('network/guest/dev-ide/index.html', root), 'utf8');
const devIdeApp = await readFile(new URL('network/guest/dev-ide/app.js', root), 'utf8');
const devIdeStyles = await readFile(new URL('network/guest/dev-ide/styles.css', root), 'utf8');
const mastraAstro = await readFile(new URL('network/guest/templates/mastra-hono-astro/src/pages/index.astro', root), 'utf8');
const mastraBundle = await readFile(new URL('agent/dist/mastra-agent.js', root), 'utf8');
const devSupervisor = await readFile(new URL('network/guest/vmbro-httpd/main.go', root), 'utf8');
const startup = await readFile(new URL('network/guest/rc.startup', root), 'utf8');
const builder = await readFile(new URL('network/guest/build-tier-images.sh', root), 'utf8');

// Sizes carry 64 MiB of headroom above contents, so adding a tool no longer
// forces a size bump and a full re-download. star is smaller than its
// neighbours because it is the one tier still built from this repository.
const expected = [
  ['barebones', 134217728],
  ['essentials', 150994944],
  ['ai-tools', 159383552],
  ['dev', 218103808],
  ['performance', 163577856],
  ['vapt', 170917888],
  ['star', 134217728],
];

test('VM image manifest defines seven ordered tiers with an all-features Star image', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.defaultTier, 'barebones');
  assert.deepEqual(Object.keys(manifest.tiers), expected.map(([tier]) => tier));
  for (const [tier, size] of expected) {
    const image = manifest.tiers[tier];
    assert.equal(image.size, size);
    assert.match(image.url, new RegExp(`^images/v86/vm-${tier}-i386-ext4\\.img$`));
    assert.match(image.version, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
  }
});

test("index.html's fallback manifest mirrors the real one", () => {
  // A fourth place every tier's size and url is written down: VM_IMAGE_FALLBACK,
  // used whenever the vm-images.json fetch fails. It had drifted on all seven
  // tiers -- pre-headroom sizes and pre-images/v86 urls -- and the failure is
  // silent, because index.html compares the size against the Range preflight's
  // content-range total and quietly falls back to ATA PIO compatibility mode
  // when they disagree. A stale fallback is worse than no fallback.
  const start = html.indexOf('const VM_IMAGE_FALLBACK');
  assert.ok(start > 0, 'index.html has no VM_IMAGE_FALLBACK');
  const block = html.slice(start, html.indexOf('\n};', start));

  assert.match(block, new RegExp(`defaultTier: ["']${manifest.defaultTier}["']`));

  // imageBaseUrl drifting is the same silent failure as a stale size, one level
  // worse: if the manifest fetch is what failed and the fallback still points
  // beside the page, every image 404s on a deployment that hosts them elsewhere
  // and the boot parks at the progress cap with nothing in the console.
  const fallbackBase = block.match(/imageBaseUrl: "([^"]*)"/);
  assert.ok(fallbackBase, 'fallback has no imageBaseUrl');
  assert.equal(fallbackBase[1], manifest.imageBaseUrl ?? '', 'fallback imageBaseUrl');
  for (const [tier, entry] of Object.entries(manifest.tiers)) {
    const line = block.split('\n').find(l => l.includes(`"${tier}":`));
    assert.ok(line, `fallback has no entry for ${tier}`);
    assert.equal(Number(line.match(/size: (\d+)/)[1]), entry.size, `${tier}: fallback size`);
    assert.equal(line.match(/url: "([^"]+)"/)[1], entry.url, `${tier}: fallback url`);
    assert.equal(line.match(/version: "([^"]+)"/)[1], entry.version, `${tier}: fallback version`);
  }
});

test('tier builder allocates exactly the sizes the manifest advertises', () => {
  // The size of every tier is stated three times: here, in vm-images.json, and
  // in tier_bytes(). Nothing compared the last two, so they drifted -- the
  // builder produced 92 MB ai-tools images for months while the manifest and
  // the live site said 152 MB. This is the check that would have caught it.
  const block = builder.slice(builder.indexOf('tier_bytes()'));
  for (const [tier, size] of expected) {
    const match = block.match(new RegExp(`${tier}\\)\\s*echo\\s+(\\d+)`));
    assert.ok(match, `tier_bytes() has no entry for ${tier}`);
    assert.equal(Number(match[1]), size, `${tier}: builder disagrees with the manifest`);
  }
});

test('built image files match manifest byte sizes', async () => {
  // The images are build artifacts and are no longer committed, so a fresh
  // clone has the manifest and none of the files. Check whatever is present
  // and skip the rest rather than failing on a clone that is perfectly valid.
  //
  // The size still matters -- index.html compares it against the Range
  // preflight's content-range total, and a mismatch silently downgrades every
  // boot to compatibility mode. It just cannot be checked from here. Build the
  // images with network/guest/build-tier-images.sh to exercise this properly.
  let checked = 0;
  for (const [tier, size] of expected) {
    const image = manifest.tiers[tier];
    let actual;
    try {
      actual = (await stat(new URL(image.url, root))).size;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    assert.equal(actual, size, `${tier}: ${image.url}`);
    checked += 1;
  }
  console.log(`  checked ${checked} of ${expected.length} images present locally`);
});

test('tier builder applies each preceding installer and validates boundaries', () => {
  assert.match(builder, /number >= 2 \)\) && install_essentials/);
  assert.match(builder, /number >= 3 \)\) && install_ai_tools/);
  assert.match(builder, /\[\[ "\$tier" == dev \|\| "\$tier" == star \]\] && install_dev/);
  assert.match(builder, /\[\[ "\$tier" == performance \|\| "\$tier" == vapt \|\| "\$tier" == star \]\] && install_performance/);
  assert.match(builder, /\[\[ "\$tier" == vapt \|\| "\$tier" == star \]\] && install_vapt/);
  assert.match(builder, /! command -v curl; ! command -v vmagent-rpc/);
  assert.match(builder, /! command -v herdr; ! command -v rig; ! command -v git/);
  assert.match(builder, /! command -v k6/);
  // openssh-client-default is installed from essentials up, so the verifier has
  // to prove it landed -- and that barebones, which is deliberately bare, did
  // not get it. The install arrived without either check.
  assert.match(builder, /command -v curl jq qjs vmagent-rpc ssh scp/);
  assert.match(builder, /! command -v curl; ! command -v vmagent-rpc; ! command -v ssh/);
  // e2fsck exits 1 when it repaired something; under set -e that aborts a batch
  // build of an image that is now perfectly good.
  assert.match(builder, /e2fsck -fy "\$image" \|\| \[\[ \$\? -le 2 \]\]/);

  assert.match(builder, /! command -v nuclei/);
  assert.match(builder, /command -v vaptr/);
  assert.match(builder, /command -v esbuild vmbro-httpd vmbro-dev/);
  assert.match(builder, /command -v vmai vmllm vmlang vmmastra vmjs vmbench/);
  assert.match(builder, /test -f \/root\/project\/src\/pages\/index\.astro/);
  assert.match(builder, /for tool in httpx katana urlfinder ffuf interactsh-client hakrawler gospider nuclei/);
  assert.match(builder, /test -f \/opt\/vaptr\/configs\/native\.json/);
});

test('Settings selects a manifest image and warns before restart', () => {
  assert.match(html, /id="vm-image-tier"/);
  // Presence only. These lines used to restate the url and size of each tier,
  // which is how the fallback drifted on all seven without a test noticing:
  // the assertion and the code held the same stale numbers. Sizes and urls are
  // compared against the real manifest above, in one place.
  assert.match(html, /"dev": \{ name: "Dev"/);
  assert.match(html, /"star": \{ name: "Star"/);
  assert.match(html, /dev: "Dev tier · includes AI Tools"/);
  assert.match(html, /star: "Star tier · includes Dev, Performance and VAPT"/);
  assert.match(html, /id="apply-vm-image"[^>]*>Apply &amp; restart/);
  assert.match(html, /Each image has an independent guest filesystem/);
  assert.match(html, /localStorage\.setItem\("vm\.imageTier", nextTier\)/);
  assert.match(html, /next\.searchParams\.set\("tier", nextTier\)/);
});

test('Dev tier starts and opens its app automatically', () => {
  assert.match(startup, /dev\|star\)/);
  assert.match(startup, /\(sleep 5; cd \/root\/project && PORT=3000 \/usr\/local\/bin\/vmbro-dev >\/var\/log\/vmbro-dev\.log 2>&1\) &/);
  // The current VM tab enters the IDE only once the guest server is listening.
  assert.match(html, /const hasDevEnvironment = vmImageTier === "dev" \|\| vmImageTier === "star"/);
  assert.match(html, /if \(hasDevEnvironment\) startDevAppPhase\(\)/);
  assert.match(html, /new URL\("\/ide\/", location\.origin\)\.href/);
  assert.match(html, /target\.searchParams\.set\("theme", document\.documentElement\.dataset\.theme \|\| "dark"\)/);
  assert.match(html, /devFrame\.src = target\.href/);
  assert.match(html, /finishBoot\(false\)/);
  assert.match(html, /finishDevApp\(true\)/);
	assert.match(html, /await devNetworkReady/);
	assert.match(html, /fetch\(DEV_APP_URL, \{ cache: "no-store" \}\)/);
  assert.match(html, /the public IDE route did not become reachable/);
  assert.match(html, /providers\/v86\/websocket-network\.js\?v=\$\{encodeURIComponent\(APP_VERSION\)\}/);
	assert.match(html, /function finishDevInTerminal\(message\)/);
	assert.match(html, /Shell ready — Dev IDE network unavailable/);
	assert.match(html, /continuing in terminal/);
	assert.match(html, /session\.active[\s\S]*public IDE is already in use by another VM tab/);
  assert.doesNotMatch(html, /Open Dev App|id="open-dev-app"|devAppButton/);
});

test('Dev and Star can switch between IDE and terminal without restarting the VM', () => {
  assert.match(html, /id="toggle-dev-view"[^>]*hidden/);
  assert.match(html, /function setDevView\(view\)/);
  assert.match(html, /devFrame\.hidden = showTerminal/);
  assert.match(html, /termHost\.style\.display = showTerminal \? "" : "none"/);
  assert.match(html, /termHost\.style\.visibility = showTerminal \? "visible" : "hidden"/);
  assert.match(html, /scheduleTerminalFit\(\)/);
  assert.match(html, /Terminal — same running VM/);
  assert.match(html, /devViewButton\.onclick = \(\) => setDevView\(devFrame\.hidden \? "ide" : "terminal"\)/);
  assert.doesNotMatch(html, /toggle-dev-view[\s\S]{0,1000}location\.reload/);
});

test('Dev UI exposes the live VM terminal beside its Console view', () => {
  assert.match(devIdeIndex, /id="console-tab"[^>]*>Console</);
  assert.match(devIdeIndex, /id="terminal-tab"[^>]*>Terminal</);
  assert.match(devIdeIndex, /id="embedded-terminal"[^>]*role="tabpanel"/);
  assert.match(devIdeIndex, /src="\/xterm\.js"/);
  assert.match(devIdeApp, /new Terminal\(/);
  assert.match(devIdeApp, /function selectOutputView\(view\)/);
  assert.match(devIdeApp, /type: 'vmvm-terminal-input'/);
  assert.match(devIdeApp, /type: 'vmvm-terminal-ready'/);
  assert.match(html, /type === "vmvm-terminal-input"/);
  assert.match(html, /handleTerminalData\(event\.data\.data\)/);
  assert.match(html, /DEV_TERMINAL_HISTORY_LIMIT = 65536/);
  assert.match(html, /type: "vmvm-terminal-output"/);
  assert.match(devIdeStyles, /\.embedded-terminal \{/);
});

test('Dev UI gives the output pane more space and focuses Terminal on load', () => {
  assert.match(devIdeIndex, /id="terminal-tab" class="output-tab active"[^>]*aria-selected="true"/);
  assert.match(devIdeIndex, /id="log-output"[^>]*hidden/);
  assert.match(devIdeStyles, /\.log-pane \{[^}]*flex: 0 0 clamp\(260px, 34vh, 390px\);[^}]*min-height: 240px;/s);
  assert.match(devIdeStyles, /\.log-output \{[^}]*flex: 1 1 auto;[^}]*min-height: 0;/s);
  assert.match(devIdeApp, /cursor: '#fbbf24'/);
  assert.match(devIdeApp, /requestAnimationFrame\(\(\) => selectOutputView\('terminal'\)\)/);
  assert.match(devIdeApp, /embeddedTerm\.scrollToBottom\(\);/);
  assert.match(devIdeApp, /embeddedTerm\.focus\(\);/);
});

test('Dev IDE autosaves editor changes so Astro rebuild and preview reload can run', () => {
  assert.match(devIdeApp, /editor\.onDidChangeModelContent\(\(\) =>/);
  assert.match(devIdeApp, /autoSaveTimer = setTimeout\(\(\) => \{/);
  assert.match(devIdeApp, /if \(activeTab === path && openTabs\.get\(path\)\?\.dirty\) saveActive\(\)/);
  assert.match(devIdeApp, /eventsSource\.addEventListener\('reload'/);
  assert.match(devIdeApp, /reloadPreview\(\)/);
  assert.match(devSupervisor, /func \(s \*supervisor\) handleWorkspaceChange\(\)/);
  assert.match(devSupervisor, /if err := s\.startApp\(\); err != nil \{/);
  assert.match(devSupervisor, /rebuild finished — app server restarted/);
	assert.match(devSupervisor, /cp " \+ ws \+ "\/src\/pages\/index\.astro " \+ ws \+ "\/dist\/index\.html"/);
	assert.doesNotMatch(mastraAstro, /^---$/m);
});

test('Mastra Astro reuses the VMVM model and reveals setup only when none is loaded', () => {
  assert.match(html, /globalThis\.vmvmLocalModelClient = client/);
  assert.match(html, /globalThis\.vmvmLocalModelReady = initialization/);
  assert.match(html, /vmvm-local-model-client/);
  assert.match(mastraAstro, /id="model-setup"[^>]*hidden/);
  assert.match(mastraAstro, /sharedHost\.addEventListener\('vmvm-local-model-client'/);
  assert.match(mastraAstro, /sharedClient = announced\?\.client/);
  assert.match(mastraAstro, /if \(client\.modelName\) \{[\s\S]*setReady\(client\.modelName\);[\s\S]*return;/);
  assert.match(mastraAstro, /else showModelSetup\(\)/);
  assert.match(mastraAstro, /No downloaded model was found/);
  assert.match(mastraAstro, /import\('\/shared\/litert-lm-client\.js'\)/);
  assert.doesNotMatch(mastraAstro, /\/vmmastra\/shared\/litert-lm-client\.js/);
	assert.match(mastraAstro, /import\('\/agent\/dist\/mastra-agent\.js\?v=2026\.08\.03\.1'\)/);
  assert.doesNotMatch(mastraAstro, /\/vmmastra\/agent\/mastra-agent\.js/);
	assert.match(mastraBundle, /export \{\s*Agent,[\s\S]*createLiteRt,[\s\S]*createMastraVMAgent/);
});

test('Dev IDE inherits and persists the VMVM theme', () => {
  assert.match(devIndex, /new URLSearchParams\(location\.search\)\.get\('theme'\)/);
  assert.match(devIndex, /\['light', 'dark'\]\.includes\(requestedTheme\)/);
  assert.match(devIndex, /localStorage\.setItem\('dev\.theme', initialTheme\)/);
  assert.match(devIndex, /event\.data\?\.type !== 'vmvm-theme'/);
});

test('Dev tier boot progress reflects the app compile/serve phase', () => {
  assert.match(html, /Compiling Dev app \(esbuild\)…/);
  assert.match(html, /Starting Chi server on port 3000…/);
  // Readiness is gated on port 3000 actually listening, not a blind timer.
  assert.match(html, /grep -q ':3000'/);
  assert.match(html, /includes\(DEVAPP_READY_MARKER\)/);
});

test('Dev tier allows the larger image enough time to produce VM output', () => {
  assert.match(html, /compatibilityBoot \? 300000 : \(hasDevEnvironment \? 300000 : 120000\)/);
  assert.match(html, /emulator-ready", \(\) => \{\s*armNoOutputWatchdog\(\)/);
  assert.match(html, /after compatibility-mode emulator startup/);
  assert.match(html, /first boot may take several minutes/);
});

test('Star combines every specialized guest installer and behavior', () => {
  assert.match(builder, /star\) echo 6/);
  assert.match(builder, /star\) echo 134217728/);
  assert.match(builder, /if \[\[ "\$tier" == dev \|\| "\$tier" == star \]\]/);
  assert.match(builder, /if \[\[ "\$tier" == performance \|\| "\$tier" == vapt \|\| "\$tier" == star \]\]/);
  assert.match(builder, /if \[\[ "\$tier" == vapt \|\| "\$tier" == star \]\]/);
  assert.match(startup, /dev\|star\)/);
});

test('VMVM branding, themes, and refresh controls are present', () => {
  assert.match(html, /assets\/vmvm-logo\.png/);
  assert.match(html, /id="toggle-theme"/);
  assert.match(html, /localStorage\.setItem\("vm\.theme", next\)/);
  // Both were removed deliberately in 2d0242c, so vmbro still having them is
  // not a feature this tree is missing. Pinned so a future port cannot quietly
  // reinstate them.
  assert.doesNotMatch(html, /id="refresh-app"/);
  assert.doesNotMatch(html, /id="share-ide"/);
  assert.match(html, /aria-label="Settings">\s*<svg/);
});

test('an unset theme follows the operating system rather than assuming dark', () => {
  assert.match(html, /matchMedia\("\(prefers-color-scheme: light\)"\)\.matches \? "light" : "dark"/);
  // The media query only helps if the light palette also switches the UA's own
  // widgets; without this a light page keeps dark scrollbars and form controls.
  assert.match(html, /:root\[data-theme="light"\] \{ color-scheme: light; \}/);
});

test('a fault recorded this session survives that session booting successfully', () => {
  // The counterpart to the test below, and the half that was missing. #45 ported
  // clearStaleRuntimeFault and its guard but not the line in recordRuntimeFault
  // that resets the flag, so the tree shipped a doc comment promising "one
  // recorded in this session stays put" alongside code that discarded it:
  // load with a carried-over fault (flag true) -> fault again now -> the flag is
  // never lowered -> finishBoot clears the banner and localStorage for a fault
  // that had just happened.
  const record = html.slice(html.indexOf('function recordRuntimeFault('));
  const body = record.slice(0, record.indexOf('\n}'));
  assert.match(body, /showingPreviousFault = false;/);
  // Order matters: lower the flag before showing, so the banner and the flag
  // never disagree about which session the fault belongs to.
  assert.ok(
    body.indexOf('showingPreviousFault = false;') < body.indexOf('showRuntimeFault(lastRuntimeFault);'),
    'the flag must be cleared before the fault is shown',
  );
});

test('a carried-over runtime fault is cleared by a boot that works', () => {
  // The fault is persisted so it survives the reload it provokes. Nothing but
  // the Dismiss button ever cleared it, so one bad boot left the banner up for
  // every later visit, describing something that had stopped happening.
  assert.match(html, /function clearStaleRuntimeFault\(\)/);
  assert.match(html, /if \(!showingPreviousFault\) return;/);
  // Only carried-over faults clear. One recorded in this session describes what
  // is happening now, and reaching a shell does not make it untrue.
  assert.match(html, /showRuntimeFault\(lastRuntimeFault, true\); showingPreviousFault = true;/);
  // Called on the success path, after the shell-ready dispatch rather than
  // before it, because boot-source.test.mjs pins those two lines as adjacent.
  // Bounded by position rather than by a character count, so editing a comment
  // in between cannot fail this.
  const dispatch = html.indexOf('window.dispatchEvent(new Event("vmvm-shell-ready"));');
  const cleared = html.indexOf('clearStaleRuntimeFault();', dispatch);
  const overlayDone = html.indexOf('bootOverlay.classList.add("done");', dispatch);
  assert.ok(dispatch > 0, 'the shell-ready dispatch should exist');
  assert.ok(
    cleared > dispatch && cleared < overlayDone,
    'clearStaleRuntimeFault should run inside finishBoot, after the shell-ready dispatch',
  );
});

test('host terminal control commands are hidden from xterm', () => {
  assert.match(html, /hiddenSerialMarkers = \[[^\]]*"__V86TERM_CONTROL__"/);
  assert.match(html, /: __V86TERM_CONTROL__; stty rows \$\{rows\} cols \$\{cols\}/);
  assert.match(html, /: __V86TERM_CONTROL__; export HISTFILE=/);
});
