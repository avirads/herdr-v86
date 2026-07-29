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
  assert.match(html, /href="https:\/\/fapstaff\.com\/downloads\/autobro-web-bridge-2026\.07\.29\.7\.zip" download>Download AutoBro Chrome extension 2026\.07\.29\.7/);
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
  const files = await walk(new URL('autobro-extension-2026.07.29.7/', root));
  assert.deepEqual(files.filter((name) => /\.(?:exe|ps1)$/i.test(name)), []);
  const rootEntries = await readdir(new URL('autobro-extension-2026.07.29.7/', root));
  assert.ok(!rootEntries.includes('native'), 'extension must not contain a native directory');
  const zip = await readFile(new URL('downloads/autobro-web-bridge-2026.07.29.7.zip', root));
  const listing = zip.toString('latin1');
  assert.doesNotMatch(listing, /\.(?:exe|ps1)(?:[/"\0]|$)/i);
  assert.ok(!listing.includes('native/'), 'extension ZIP must not contain a native directory');
});

test('AutoBro calendar version is consistent', async () => {
  const publicVersion = '2026.07.29.7';
  const sourceDirectory = `autobro-extension-${publicVersion}/`;
  const manifest = JSON.parse(await readFile(new URL(`${sourceDirectory}manifest.json`, root), 'utf8'));
  assert.equal(manifest.version, '2026.7.29.7');
  assert.equal(manifest.version_name, publicVersion);
  assert.match(publicVersion, /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/);
});

test('selected skills populate the automation prompt directly', async () => {
  const sourceDirectory = new URL('autobro-extension-2026.07.29.7/', root);
  const html = await readFile(new URL('panel/panel.html', sourceDirectory), 'utf8');
  const script = await readFile(new URL('panel/panel.js', sourceDirectory), 'utf8');
  assert.doesNotMatch(html, /id="skillContent"/);
  assert.match(script, /\$\('automationPrompt'\)\.value = skill\.content/);
  assert.doesNotMatch(script, /\$\('skillContent'\)/);
  assert.match(script, /hostname\.replace\(\/\^www\\\.\/, ''\) !== 'fapstaff\.com'/);
});

test('skill URLs normalize obsolete plu targets', async () => {
  const { normalizeSkillContent } = await import(
    new URL('../../autobro-extension-2026.07.29.7/src/skills.js', import.meta.url)
  );
  assert.equal(normalizeSkillContent('https://fapstaff.com/plu/'), 'https://fapstaff.com/');
  assert.equal(normalizeSkillContent('fapstaff.com/plu/page'), 'fapstaff.com/page');
  assert.equal(normalizeSkillContent('open /plu/page'), 'open https://fapstaff.com/page');
});

test('automation uses a fresh tab, login skill, and final logout', async () => {
  const sourceDirectory = new URL('autobro-extension-2026.07.29.7/', root);
  const panel = await readFile(new URL('panel/panel.js', sourceDirectory), 'utf8');
  const guidewire = await readFile(new URL('src/domains/guidewire.js', sourceDirectory), 'utf8');
  assert.match(panel, /command: 'newTab', args: \[sourceTab\.url\]/);
  assert.match(panel, /policycenter-login-session-health\\\.md\$/);
  assert.match(panel, /command: 'loginStatus'/);
  assert.match(panel, /\['localhost', '127\.0\.0\.1'\]/);
  assert.match(panel, /command: 'localLogin', args: \['su', 'gw'\]/);
  assert.match(panel, /finally \{[\s\S]*command: 'gwLogout'/);
  assert.match(guidewire, /GUIDEWIRE_COMMANDS = new Set\(\['gwClick', 'gwOpenMenu', 'gwLogout'\]\)/);
  assert.match(guidewire, /logout-action-not-found/);
});

test('webpage pairing opens the singleton extension panel without a separate open command', async () => {
  const sourceDirectory = new URL('autobro-extension-2026.07.29.7/', root);
  const background = await readFile(new URL('background.js', sourceDirectory), 'utf8');
  const transport = await readFile(new URL('src/transports/external-messaging.js', sourceDirectory), 'utf8');
  assert.match(background, /externalMessaging\.onPairingRequested\(\(\) => \{ openPanelWindow\(\)/);
  assert.doesNotMatch(background, /externalMessaging\.onOpenPanelRequested/);
  assert.doesNotMatch(transport, /message\.command === 'openPanelWindow'/);
});
