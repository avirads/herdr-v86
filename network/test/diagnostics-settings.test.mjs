import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('Settings contains About version information and Diagnostics controls', () => {
  assert.match(html, /<h3 id="about-settings-title">About<\/h3>/);
  assert.match(html, /const APP_VERSION = "[^"]+"/);
  assert.match(html, /id="about-app-version"/);
  assert.match(html, /id="about-vm-version"/);
  assert.match(html, /<h3 id="diagnostics-settings-title">Diagnostics<\/h3>/);
  assert.match(html, /id="refresh-diagnostics"[^>]*>Refresh</);
  assert.match(html, /id="download-diagnostics"[^>]*>Download JSON</);
});

test('diagnostics capture useful local metrics and exclude sensitive content', () => {
  for (const signal of [
    'navigator.userAgent',
    'navigator.deviceMemory',
    'navigator.hardwareConcurrency',
    'navigator.storage?.estimate',
    'navigator.gpu.requestAdapter',
    'cachedModelNames',
    'vmImageSource',
  ]) assert.ok(html.includes(signal), `missing diagnostic signal: ${signal}`);
  assert.match(html, /Project files, prompts, and pairing credentials are excluded/);
  const collector = html.slice(html.indexOf('async function collectDiagnostics()'), html.indexOf('async function refreshDiagnostics()'));
  assert.doesNotMatch(collector, /autobroPairingToken|setup-autobro-token|agentInput|remoteKey/);
});

test('diagnostics download is a local JSON file', () => {
  assert.match(html, /new Blob\(\[JSON\.stringify\(latestDiagnostics, null, 2\)/);
  assert.match(html, /type: "application\/json"/);
  assert.match(html, /herdr-v86-diagnostics-/);
  assert.match(html, /URL\.revokeObjectURL\(url\)/);
});
