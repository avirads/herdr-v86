import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('every long-lived VM startup message includes its source', () => {
  assert.doesNotMatch(html, /Starting VM…/);
  assert.match(html, /Starting VM \[\$\{vmImageSource\}\]…/);
  assert.match(html, /Starting compatibility boot \[\$\{vmImageSource\}\]…/);
});

test('a successfully booted disk version becomes the local source', () => {
  assert.match(html, /localStorage\.setItem\("vm\.diskVersion", DISK_VERSION\)/);
  assert.match(
    html,
    /localStorage\.getItem\("vm\.diskVersion"\) === DISK_VERSION\s*\?\s*"local cache"\s*:\s*"remote"/,
  );
  assert.doesNotMatch(html, /cache:\s*"only-if-cached"/);
});
