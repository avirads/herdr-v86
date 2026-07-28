import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../autobro-extension-0.4.0/', import.meta.url);
const command = await readFile(new URL('Install AutoBro.cmd', root), 'utf8');
const installer = await readFile(new URL('native/install-autobro.ps1', root), 'utf8');

test('guided AutoBro installer remains per-user and verifies the helper', () => {
  assert.match(command, /ExecutionPolicy Bypass/);
  assert.match(installer, /Get-FileHash/);
  assert.match(installer, /bc633b2a04a5aa16575222010dc98e5bad53211f849b83fe28ebe9a2a3acd51d/);
  assert.match(installer, /LOCALAPPDATA/);
  assert.doesNotMatch(installer, /Start-Process[^\r\n]*-Verb\s+RunAs/i);
});

test('guided installer opens the unpacked-extension confirmation', () => {
  assert.match(installer, /Set-Clipboard/);
  assert.match(installer, /chrome:\/\/extensions\//);
  assert.match(installer, /Load unpacked/);
});
