import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('Windows helper is distributed as a ZIP with source', async () => {
  const helperUrl = new URL('downloads/autobro-helper-windows-amd64.zip', root);
  const helper = await readFile(helperUrl);
  assert.equal(helper.subarray(0, 2).toString('ascii'), 'PK');
  assert.ok((await stat(helperUrl)).size > 1_000_000);
  const listing = helper.toString('latin1');
  for (const expected of [
    'Install AutoBro Helper.cmd',
    'Uninstall AutoBro Helper.cmd',
    'v86net-native-host.exe',
    'source/go.mod',
    'source/go.sum',
    'source/cmd/v86net-gateway/main.go',
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
});

test('CMD helper installer is per-user and needs no PowerShell or elevation', async () => {
  const installer = await readFile(new URL('network/helper-package/Install AutoBro Helper.cmd', root), 'utf8');
  assert.match(installer, /LOCALAPPDATA/);
  assert.match(installer, /HKCU\\/);
  assert.match(installer, /v86net-native-host\.exe/);
  assert.doesNotMatch(installer, /powershell|RunAs|HKLM/i);
});

test('Settings links the helper ZIP beside the extension', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /href="https:\/\/fapstaff\.com\/downloads\/autobro-web-bridge-0\.5\.0\.zip" download>Download AutoBro Chrome extension 0\.5\.0/);
  assert.match(html, /href="https:\/\/fapstaff\.com\/downloads\/autobro-helper-windows-amd64\.zip" download>Download Windows networking helper/);
  assert.doesNotMatch(html, /Install-AutoBro\.cmd|install-autobro\.ps1/);
});

test('extension source contains no Windows executable or PowerShell script', async () => {
  const walk = async (url) => {
    const entries = await readdir(url, { withFileTypes: true });
    const paths = [];
    for (const entry of entries) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url);
      if (entry.isDirectory()) paths.push(...await walk(child));
      else paths.push(child.pathname);
    }
    return paths;
  };
  const files = await walk(new URL('autobro-extension-0.5.0/', root));
  assert.deepEqual(files.filter((name) => /\.(?:exe|ps1)$/i.test(name)), []);
  const rootEntries = await readdir(new URL('autobro-extension-0.5.0/', root));
  assert.ok(!rootEntries.includes('native'), 'extension must not contain a native directory');
  const zip = await readFile(new URL('downloads/autobro-web-bridge-0.5.0.zip', root));
  const listing = zip.toString('latin1');
  assert.doesNotMatch(listing, /\.(?:exe|ps1)(?:[/"\0]|$)/i);
  assert.ok(!listing.includes('native/'), 'extension ZIP must not contain a native directory');
});
