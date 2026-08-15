import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const client = fs.readFileSync(path.join(root, 'shared/litert-lm-client.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('model import bypasses OPFS when the selected file exceeds available quota', () => {
  assert.match(client, /navigator\.storage\.estimate\(\)\.catch/);
  assert.match(client, /available < file\.size/);
  assert.match(client, /createEngine\(file, file\.name, \{ remember: false \}\)/);
  assert.match(client, /return \{ cached: false \}/);
});

test('a write-time quota error removes the partial cache and loads the selected file directly', () => {
  assert.match(client, /removeEntry\(file\.name\)[\s\S]*error\?\.name === 'QuotaExceededError'/);
  assert.match(client, /storage quota reached; loading \$\{file\.name\} without caching/);
});

test('uncached models are not remembered and the UI explains their temporary status', () => {
  assert.match(client, /if \(remember\) \{[\s\S]*localStorage\.setItem\(LAST_MODEL_KEY, name\)/);
  assert.match(html, /using selected file; not cached/);
});
