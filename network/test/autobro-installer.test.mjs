import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const command = await readFile(new URL('downloads/Install-AutoBro.cmd', root), 'utf8');
const installer = await readFile(new URL('downloads/install-autobro.ps1', root), 'utf8');

test('guided AutoBro installer remains per-user and verifies the helper', () => {
  assert.match(command, /ExecutionPolicy Bypass/);
  assert.match(command, /%SystemRoot%\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.match(command, /%ProgramFiles%\\PowerShell\\7\\pwsh\.exe/);
  assert.doesNotMatch(command, /^powershell\.exe /m);
  assert.match(command, /https:\/\/fapstaff\.com\/downloads\/install-autobro\.ps1/);
  assert.match(installer, /Get-FileHash/);
  assert.match(installer, /bc633b2a04a5aa16575222010dc98e5bad53211f849b83fe28ebe9a2a3acd51d/);
  assert.doesNotMatch(installer, /__EXTENSION_ZIP_SHA256__/);
  assert.match(installer, /LOCALAPPDATA/);
  assert.doesNotMatch(installer, /Start-Process[^\r\n]*-Verb\s+RunAs/i);
});

test('guided installer opens the unpacked-extension confirmation', () => {
  assert.match(installer, /Set-Clipboard/);
  assert.match(installer, /chrome:\/\/extensions\//);
  assert.match(installer, /Load unpacked/);
});

test('Settings links the standalone installer beside the extension', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /href="https:\/\/fapstaff\.com\/downloads\/autobro-web-bridge-0\.4\.0\.zip" download>Download AutoBro Chrome extension/);
  assert.match(html, /href="https:\/\/fapstaff\.com\/downloads\/Install-AutoBro\.cmd" download>Guided Windows installer/);
});

test('bootstrap hashes match the published PowerShell and extension ZIP', async () => {
  const zip = await readFile(new URL('downloads/autobro-web-bridge-0.4.0.zip', root));
  const scriptHash = createHash('sha256').update(installer).digest('hex');
  const zipHash = createHash('sha256').update(zip).digest('hex');
  assert.match(command, new RegExp(scriptHash));
  assert.match(installer, new RegExp(zipHash));
});
