import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('vm-images.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
const builder = await readFile(new URL('network/guest/build-tier-images.sh', root), 'utf8');

const expected = [
  ['barebones', 67108864],
  ['essentials', 83886080],
  ['ai-tools', 92274688],
  ['performance', 96468992],
  ['vapt', 103809024],
];

test('VM image manifest defines five ordered cumulative tiers', () => {
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
  assert.match(builder, /number >= 4 \)\) && install_performance/);
  assert.match(builder, /number >= 5 \)\) && install_vapt/);
  assert.match(builder, /! command -v curl; ! command -v vmagent-rpc/);
  assert.match(builder, /! command -v herdr; ! command -v rig; ! command -v git/);
  assert.match(builder, /! command -v k6/);
  assert.match(builder, /! command -v nuclei/);
  assert.match(builder, /command -v vaptr/);
  assert.match(builder, /for tool in httpx katana urlfinder ffuf interactsh-client hakrawler gospider nuclei/);
  assert.match(builder, /test -f \/opt\/vaptr\/configs\/native\.json/);
});

test('Settings selects a manifest image and warns before restart', () => {
  assert.match(html, /id="vm-image-tier"/);
  assert.match(html, /id="apply-vm-image"[^>]*>Apply &amp; restart/);
  assert.match(html, /Each image has an independent guest filesystem/);
  assert.match(html, /localStorage\.setItem\("vm\.imageTier", nextTier\)/);
  assert.match(html, /next\.searchParams\.set\("tier", nextTier\)/);
});
