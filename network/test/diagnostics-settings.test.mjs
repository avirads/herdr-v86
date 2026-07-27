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
  assert.match(html, /id="copy-diagnostics"[^>]*>Copy diagnostics</);
  assert.match(html, /id="diagnostics-status" role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /id="diagnostics-output"|id="download-diagnostics"|id="refresh-diagnostics"/);
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
  const collectorStart = html.indexOf('async function collectDiagnostics()');
  const collector = html.slice(collectorStart, html.indexOf('document.getElementById("copy-diagnostics")', collectorStart));
  assert.doesNotMatch(collector, /autobroPairingToken|setup-autobro-token|agentInput|remoteKey/);
});

test('diagnostics are collected on demand and copied without being displayed', () => {
  assert.match(html, /const diagnostics = await collectDiagnostics\(\)/);
  assert.match(html, /navigator\.clipboard\.writeText\(JSON\.stringify\(diagnostics, null, 2\)/);
  assert.match(html, /Diagnostics copied to clipboard\./);
  assert.doesNotMatch(html, /new Blob\(\[JSON\.stringify\(latestDiagnostics/);
});
