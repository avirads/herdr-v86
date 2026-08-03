import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../../service-worker.js', import.meta.url), 'utf8');

test('every long-lived VM startup message includes its source', () => {
  assert.match(html, /Preparing VMVM…/);
  assert.match(html, /Checking VMVM \[\$\{vmImageDisplaySource\}\]…/);
  assert.doesNotMatch(html, /Starting VM…/);
  assert.match(html, /Starting VMVM \[\$\{vmImageDisplaySource\}\]…/);
  assert.match(html, /Starting VMVM \[\$\{vmImageDisplaySource\}\] in compatibility mode…/);
  assert.doesNotMatch(html, /(?:Preparing|Checking) VM(?:…| \[)/);
});

test('a successfully booted disk version becomes the local source', () => {
  assert.match(html, /localStorage\.setItem\(diskCacheKey, DISK_VERSION\)/);
  assert.match(
    html,
    /localStorage\.getItem\(diskCacheKey\) === DISK_VERSION\s*\?\s*"local cache"\s*:\s*"remote"/,
  );
  assert.doesNotMatch(html, /cache:\s*"only-if-cached"/);
});

test('v86 disk progress describes the selected source rather than the event name', () => {
  assert.match(html, /isVmDiskDownload\(e\.file_name\)/);
  assert.match(
    html,
    /vmImageSource === "local cache" \? "Loading cached VMVM" : "Downloading VMVM"/,
  );
  assert.match(html, /`\$\{action\} \[\$\{vmImageDisplaySource\}\]…`/);
  assert.match(html, /Downloading VMVM \[\$\{vmImageDisplaySource\}\]…/);
  assert.doesNotMatch(html, /Downloading \$\{e\.file_name\}/);
});

test('the selected cumulative image comes from the manifest and has its own cache key', () => {
  assert.match(html, /fetch\("\.\/vm-images\.json", \{ cache: "no-cache" \}\)/);
  assert.match(html, /localStorage\.getItem\("vm\.imageTier"\)/);
  assert.match(html, /const diskCacheKey = `vm\.diskVersion\.\$\{vmImageTier\}`/);
  assert.match(html, /hda: \{ url: diskURL, async: !compatibilityBoot, size: DISK_SIZE \}/);
});

test('the interactive VM shell starts in the project directory', () => {
  assert.match(
    html,
    /stty rows \$\{term\.rows\} cols \$\{term\.cols\};[\s\S]*?cd \/root\/project\\n/,
  );
});

test('the app shell revalidates without intercepting VM disk ranges', () => {
  assert.match(html, /serviceWorker\.register\("\.\/service-worker\.js", \{ updateViaCache: "none" \}\)/);
  assert.match(serviceWorker, /request\.mode !== "navigate"/);
  assert.match(serviceWorker, /request\.headers\.has\("range"\)/);
  assert.match(serviceWorker, /fetch\(source, \{ cache: "no-cache" \}\)/);
  assert.doesNotMatch(serviceWorker, /vm-network-ext4/);
  assert.match(serviceWorker, /"guest-tools", "deep-agent"/);
  assert.match(serviceWorker, /docs\/\$\{documentName\}\.md/);
  assert.match(serviceWorker, /docs\/\$\{documentName\}\.html/);
});
