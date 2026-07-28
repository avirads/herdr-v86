import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const build = await readFile(new URL('network/guest/build-network-image.sh', root), 'utf8');
const docs = await readFile(new URL('network/guest/agent-capabilities.md', root), 'utf8');
const controller = await readFile(new URL('network/browser/vmagent-controller.js', root), 'utf8');
const mastraSource = await readFile(new URL('agent/src/mastra-browser.js', root), 'utf8');
const mastraSkill = await readFile(new URL('network/guest/skills/mastra/SKILL.md', root), 'utf8');
const source = JSON.parse(await readFile(new URL('network/guest/k6-source.json', root), 'utf8'));

test('the fixed guest image installs and verifies Grafana k6', async () => {
  const binary = await stat(new URL('network/guest/bin/k6', root));
  assert.ok(binary.size > 10_000_000 && binary.size < 12_000_000);
  assert.match(build, /install -D -m 0755 "\$K6_BINARY" "\$MOUNT_DIR\/usr\/local\/bin\/k6"/);
  assert.match(build, /chroot "\$MOUNT_DIR" \/usr\/local\/bin\/k6 version/);
  assert.match(build, /command -v k6/);
});

test('k6 build provenance pins official source and linux 386 target', () => {
  assert.equal(source.project, 'grafana/k6');
  assert.equal(source.version, 'v2.0.0');
  assert.equal(source.target, 'linux/386');
  assert.match(source.binarySha256, /^[0-9a-f]{64}$/);
});

test('all coding-agent instructions advertise k6', () => {
  assert.match(docs, /Grafana `k6` v2\.0\.0/);
  assert.match(docs, /k6 run --vus N --duration D/);
  assert.match(controller, /Use Grafana k6 for JavaScript HTTP\/API performance and load tests/);
  assert.match(mastraSource, /Use Grafana k6 for JavaScript HTTP\/API performance and load tests/);
  assert.match(mastraSkill, /installed Grafana `k6` command/);
});
