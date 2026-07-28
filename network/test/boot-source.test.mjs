import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../../service-worker.js', import.meta.url), 'utf8');

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

test('v86 disk progress describes the selected source rather than the event name', () => {
  assert.match(html, /isVmDiskDownload\(e\.file_name\)/);
  assert.match(
    html,
    /vmImageSource === "local cache" \? "Loading cached VM image" : "Downloading VM image"/,
  );
  assert.match(html, /`\$\{action\} \[\$\{vmImageSource\}\]…`/);
});

test('the interactive VM shell starts in the project directory', () => {
  assert.match(
    html,
    /stty rows \$\{term\.rows\} cols \$\{term\.cols\};[\s\S]*?cd \/root\/project\\n/,
  );
});

test('the app shell revalidates without intercepting VM disk ranges', () => {
  assert.match(html, /serviceWorker\.register\("\.\/service-worker\.js", \{ updateViaCache: "none" \}\)/);
  assert.match(serviceWorker, /event\.request\.mode !== "navigate"/);
  assert.match(serviceWorker, /fetch\(source, \{ cache: "no-cache" \}\)/);
  assert.doesNotMatch(serviceWorker, /vm-network-ext4/);
  assert.match(serviceWorker, /"guest-tools", "deep-agent"/);
  assert.match(serviceWorker, /docs\/\$\{documentName\}\.md/);
  assert.match(serviceWorker, /docs\/\$\{documentName\}\.html/);
});
