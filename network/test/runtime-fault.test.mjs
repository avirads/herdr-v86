import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('runtime disk faults are captured without reloading the VM', () => {
  assert.match(html, /if \(shellReady\) \{\s*recordRuntimeFault\("virtual disk error"/);
  assert.match(html, /automatic reload was suppressed/);
  assert.match(html, /else \{\s*status\("virtual disk DMA failed during boot — restarting in compatibility mode…"\)/);
  assert.match(html, /setTimeout\(\(\) => location\.replace\(next\.href\), 1500\)/);
});

test('runtime faults retain bounded context and expose explicit recovery', () => {
  assert.match(html, /serialContext: serialFaultContext\.slice\(-2048\)/);
  assert.match(html, /command: lastSubmittedShellCommand\.slice\(0, 500\)/);
  assert.match(html, /localStorage\.setItem\(RUNTIME_FAULT_KEY/);
  assert.match(html, /id="restart-compatibility"/);
  assert.match(html, /next\.searchParams\.set\("compat", "1"\)/);
  assert.match(html, /id="dismiss-runtime-warning"/);
});

test('kernel panics and browser-side VM errors are surfaced after boot', () => {
  assert.match(html, /serialFaultContext\.includes\("Kernel panic - not syncing"\)/);
  assert.match(html, /recordRuntimeFault\("kernel panic"/);
  assert.match(html, /if \(shellReady\) \{\s*recordRuntimeFault\("browser-side VM error", msg\)/);
});
