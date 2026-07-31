import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('vm-images.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const devApp = await readFile(new URL('dev-app.html', root), 'utf8');
const startup = await readFile(new URL('network/guest/rc.startup', root), 'utf8');
const builder = await readFile(new URL('network/guest/build-tier-images.sh', root), 'utf8');

const expected = [
  ['barebones', 67108864],
  ['essentials', 83886080],
  ['ai-tools', 92274688],
  ['dev', 99614720],
  ['performance', 96468992],
  ['vapt', 103809024],
];

test('VM image manifest defines six ordered cumulative tiers', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.defaultTier, 'ai-tools');
  assert.deepEqual(Object.keys(manifest.tiers), expected.map(([tier]) => tier));
  for (const [tier, size] of expected) {
    const image = manifest.tiers[tier];
    assert.equal(image.size, size);
    assert.match(image.url, new RegExp(`^vm-${tier}-i386-ext4\\.img$`));
    assert.match(image.version, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
  }
});

test('built image files match manifest byte sizes', async () => {
  for (const [tier, size] of expected) {
    const image = manifest.tiers[tier];
    assert.equal((await stat(new URL(image.url, root))).size, size);
  }
});

test('tier builder applies each preceding installer and validates boundaries', () => {
  assert.match(builder, /number >= 2 \)\) && install_essentials/);
  assert.match(builder, /number >= 3 \)\) && install_ai_tools/);
  assert.match(builder, /\[\[ "\$tier" == dev \]\] && install_dev/);
  assert.match(builder, /\[\[ "\$tier" == performance \|\| "\$tier" == vapt \]\] && install_performance/);
  assert.match(builder, /\[\[ "\$tier" == vapt \]\] && install_vapt/);
  assert.match(builder, /! command -v curl; ! command -v vmagent-rpc/);
  assert.match(builder, /! command -v herdr; ! command -v rig; ! command -v git/);
  assert.match(builder, /! command -v k6/);
  assert.match(builder, /! command -v nuclei/);
  assert.match(builder, /command -v vaptr/);
  assert.match(builder, /command -v esbuild vmbro-httpd vmbro-dev/);
  assert.match(builder, /test -f \/root\/project\/src\/pages\/index\.astro/);
  assert.match(builder, /for tool in httpx katana urlfinder ffuf interactsh-client hakrawler gospider nuclei/);
  assert.match(builder, /test -f \/opt\/vaptr\/configs\/native\.json/);
});

test('Settings selects a manifest image and warns before restart', () => {
  assert.match(html, /id="vm-image-tier"/);
  assert.match(html, /"dev": \{ name: "Dev".*url: "vm-dev-i386-ext4\.img".*size: 99614720/);
  assert.match(html, /dev: "Dev tier · includes AI Tools"/);
  assert.match(html, /id="apply-vm-image"[^>]*>Apply &amp; restart/);
  assert.match(html, /Each image has an independent guest filesystem/);
  assert.match(html, /localStorage\.setItem\("vm\.imageTier", nextTier\)/);
  assert.match(html, /next\.searchParams\.set\("tier", nextTier\)/);
});

test('Dev tier exposes its port 3000 app launcher', () => {
  assert.match(html, /id="open-dev-app"[^>]*hidden>Open Dev App<\/button>/);
  assert.match(html, /devAppButton\.hidden = vmImageTier !== "dev"/);
  assert.match(html, /http:\/\/10\.77\.0\.15:3000\//);
});

test('Dev tier starts and opens its app automatically', () => {
  assert.match(startup, /\[ "\$\(cat \/etc\/vmvm\/tier 2>\/dev\/null\)" = "dev" \]/);
  assert.match(startup, /\(sleep 5; cd \/root\/project && PORT=3000 \/usr\/local\/bin\/vmbro-dev >\/var\/log\/vmbro-dev\.log 2>&1\) &/);
  assert.match(devApp, /location\.replace\(appURL\)/);
  assert.match(devApp, /http:\/\/10\.77\.0\.15:3000\//);
  // The current VM tab enters the IDE only once the guest server is listening.
  assert.match(html, /if \(vmImageTier === "dev"\) startDevAppPhase\(\)/);
  assert.match(html, /location\.assign\(DEV_APP_URL\)/);
  assert.match(html, /finishDevApp\(true\)/);
});

test('Dev tier boot progress reflects the app compile/serve phase', () => {
  assert.match(html, /Compiling Dev app \(esbuild\)…/);
  assert.match(html, /Starting Chi server on port 3000…/);
  // Readiness is gated on port 3000 actually listening, not a blind timer.
  assert.match(html, /grep -q ':3000'/);
  assert.match(html, /includes\(DEVAPP_READY_MARKER\)/);
});

test('Dev tier allows the larger image enough time to produce VM output', () => {
  assert.match(html, /vmImageTier === "dev" \? 300000 : 120000/);
  assert.match(html, /first boot may take several minutes/);
});

test('VMVM branding, themes, and refresh controls are present', () => {
  assert.match(html, /assets\/vmvm-logo\.png/);
  assert.match(html, /id="toggle-theme"/);
  assert.match(html, /localStorage\.setItem\("vm\.theme", next\)/);
  assert.match(html, /id="refresh-app"/);
});

test('host terminal control commands are hidden from xterm', () => {
  assert.match(html, /hiddenSerialMarkers = \[[^\]]*"__V86TERM_CONTROL__"/);
  assert.match(html, /: __V86TERM_CONTROL__; stty rows \$\{rows\} cols \$\{cols\}/);
  assert.match(html, /: __V86TERM_CONTROL__; export HISTFILE=/);
});
