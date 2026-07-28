import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));

test('project import and export share one Settings section', () => {
  const section = settings.match(/<section class="provider-section" aria-labelledby="project-transfer-settings-title">([\s\S]*?)<\/section>/)?.[1] || '';
  assert.match(section, /id="import-project"/);
  assert.match(section, /id="export-project"/);
  assert.doesNotMatch(section, /id="import-file"|id="export-file"/);
});

test('file import and export share a separate Settings section', () => {
  const section = settings.match(/<section class="provider-section" aria-labelledby="file-transfer-settings-title">([\s\S]*?)<\/section>/)?.[1] || '';
  assert.match(section, /id="import-file"/);
  assert.match(section, /id="export-file"/);
  assert.doesNotMatch(section, /id="import-project"|id="export-project"/);
});

test('file export validates and shell-quotes the selected VM path', () => {
  assert.match(html, /file export requires a VM path/);
  assert.match(html, /if \(\/\[\\r\\n\\0\]\/\.test\(path\)\)/);
  assert.match(html, /transferShellQuote = value =>/);
  assert.match(html, /emulator\.read_file\(`\/\$\{sharedName\}`\)/);
});

test('imports use the dedicated binary 9p channel without Base64 shell chunks', () => {
  assert.match(html, /filesystem: \{\}/);
  assert.match(html, /emulator\.create_file\(`\/\$\{sharedName\}`, bytes\)/);
  assert.doesNotMatch(html, /encoded\.slice\(offset, offset \+ 2048\)/);
});
