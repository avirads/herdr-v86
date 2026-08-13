import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('vm-images.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const devIndex = await readFile(new URL('network/guest/dev-template/dist/index.html', root), 'utf8');
const devIdeIndex = await readFile(new URL('network/guest/dev-ide/index.html', root), 'utf8');
const devIdeApp = await readFile(new URL('network/guest/dev-ide/app.js', root), 'utf8');
const devIdeStyles = await readFile(new URL('network/guest/dev-ide/styles.css', root), 'utf8');
const mastraAstro = await readFile(new URL('network/guest/templates/mastra-hono-astro/src/pages/index.astro', root), 'utf8');
const mastraBundle = await readFile(new URL('agent/dist/mastra-agent.js', root), 'utf8');
const clineBundle = await readFile(new URL('agent/dist/cline-agent.js', root), 'utf8');
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
    assert.match(image.url, new RegExp(`^vm-${tier}-i386-ext4\\.img$`));
    assert.match(image.version, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
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
  assert.match(builder, /! command -v nuclei/);
  assert.match(builder, /command -v vaptr/);
  assert.match(builder, /command -v esbuild vmbro-httpd vmbro-dev/);
  assert.match(builder, /command -v vmai vmllm vmlang vmmastra cline vmjs vmbench/);
  assert.match(builder, /test -f \/root\/project\/src\/pages\/index\.astro/);
  assert.match(builder, /for tool in httpx katana urlfinder ffuf interactsh-client hakrawler gospider nuclei/);
  assert.match(builder, /test -f \/opt\/vaptr\/configs\/native\.json/);
});

test('Cline is a lazy browser bundle with only its launcher installed in AI Tools images', () => {
  assert.match(html, /createClineVMAgent/);
  assert.match(html, /import\(`\.\/agent\/dist\/cline-agent\.js\?v=\$\{encodeURIComponent\(APP_VERSION\)\}`\)/);
  assert.match(html, /import\(`\.\/shared\/vmagent-controller\.js\?v=\$\{encodeURIComponent\(APP_VERSION\)\}`\)/);
  assert.match(html, /import\(`\.\/shared\/litert-lm-client\.js\?v=\$\{encodeURIComponent\(APP_VERSION\)\}`\)/);
  assert.match(clineBundle, /vmvm-cline/);
  assert.match(builder, /cline-vm.*\/usr\/local\/bin\/cline/);
});

test('Settings selects a manifest image and warns before restart', () => {
  assert.match(html, /id="vm-image-tier"/);
  assert.match(html, /"dev": \{ name: "Dev".*url: "vm-dev-i386-ext4\.img".*size: 99614720/);
  assert.match(html, /"star": \{ name: "Star".*url: "vm-star-i386-ext4\.img".*size: 134217728/);
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
  assert.doesNotMatch(html, /id="refresh-app"/);
  assert.doesNotMatch(html, /id="share-ide"/);
  assert.match(html, /aria-label="Settings">\s*<svg/);
});

test('host terminal control commands are hidden from xterm', () => {
  assert.match(html, /hiddenSerialMarkers = \[[^\]]*"__V86TERM_CONTROL__"/);
  assert.match(html, /: __V86TERM_CONTROL__; stty rows \$\{rows\} cols \$\{cols\}/);
  assert.match(html, /: __V86TERM_CONTROL__; export HISTFILE=/);
});
