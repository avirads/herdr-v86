import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('provider controls are grouped at the top of Settings', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  const providers = settings.indexOf('class="provider-settings"');
  const transfers = settings.indexOf('id="assets-transfer-settings-title"');
  assert.ok(providers >= 0 && providers < transfers);
  for (const title of ['AI Model', 'AutoBro', 'Voice']) {
    assert.match(settings, new RegExp(`<h3[^>]*>${title}</h3>`));
  }
  assert.match(settings, /id="configure-llm-later"[^>]*>Load</);
  assert.match(settings, /id="reset-llm"[^>]*>Reset</);
  assert.match(settings, /id="configure-autobro-later"[^>]*>Connect</);
  assert.match(settings, /id="reset-autobro"[^>]*>Reset</);
  assert.match(settings, /id="settings-autobro-status"[^>]*role="status"/);
  assert.match(settings, /href="https:\/\/fapstaff\.com\/downloads\/autobro-web-bridge-2026\.07\.29\.6\.zip" download/);
  assert.match(settings, />Download AutoBro Chrome extension 2026\.07\.29\.6<\/a>/);
  assert.match(settings, /href="https:\/\/fapstaff\.com\/skills\/guidewire-policycenter-1\.0\.0\.zip" download/);
  assert.match(settings, />Download Guidewire PolicyCenter skills 1\.0\.0<\/a>/);
  assert.match(settings, /id="load-voice"[^>]*>Load</);
  assert.match(settings, /id="reset-voice"[^>]*>Reset</);
});

test('project and file controls share one Assets transfer section', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  const start = settings.indexOf('<h3 id="assets-transfer-settings-title">Assets transfer</h3>');
  const end = settings.indexOf('</section>', start);
  const assets = settings.slice(start, end);
  assert.ok(start >= 0);
  for (const id of ['import-project', 'export-project', 'import-file', 'export-file']) {
    assert.match(assets, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(settings, />Project transfer<|>File transfer</);
});

test('Settings connects AutoBro in place without opening VM setup', () => {
  const handler = html.slice(
    html.indexOf('document.getElementById("configure-autobro-later").onclick'),
    html.indexOf('document.getElementById("load-voice").onclick'),
  );
  assert.match(handler, /oneClickConnectAutoBro\(statusElement\)/);
  assert.doesNotMatch(handler, /openSetupStep|setup-step-autobro/);
});

test('AutoBro Connect closes Settings after pairing succeeds', () => {
  assert.match(html, /configure-autobro-later"\)\.textContent = "Connected"/);
  assert.match(html, /const connected = await oneClickConnectAutoBro\(statusElement\);[\s\S]*if \(connected\) settingsDialog\.close\(\)/);
  assert.match(html, /button\.textContent = autobroReady \? "Connected" : "Connect"/);
  assert.doesNotMatch(html, /autobroClient\.command\("openPanelWindow"\)/);
});

test('the cached-model selector uses the real OPFS model list', () => {
  assert.match(html, /await webGpuLlmClient\?\.cachedModelNames\?\.\(\) \|\| \[\]/);
  assert.match(html, /row\.hidden = names\.length < 2/);
  assert.match(html, /await webGpuLlmClient\.loadCachedModel\(name\)/);
  assert.match(html, /vmAgentController\?\.resetHarness\(\)/);
});

test('Settings offers downloads only for Gemma models missing from the cache', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  assert.match(settings, /id="settings-model-downloads" class="model-downloads"/);
  for (const model of ['gemma-4-E2B-it-web.litertlm', 'gemma-4-E4B-it-web.litertlm', 'gemma-4-12B-it-web.litertlm']) {
    assert.ok(settings.includes(`data-model-file="${model}"`), `missing Settings download for ${model}`);
  }
  assert.match(html, /const cachedNames = new Set\(names\.map\(name => name\.toLowerCase\(\)\)\)/);
  assert.match(html, /link\.hidden = cachedNames\.has\(link\.dataset\.modelFile\.toLowerCase\(\)\)/);
  assert.match(html, /downloads\.hidden = missingCount === 0/);
});

test('Settings Voice has no manual model download link', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  assert.doesNotMatch(settings, /moonshine-tiny-quantized-0\.1\.29\.zip|Download Moonshine Tiny voice model ZIP/);
  assert.doesNotMatch(settings, /id="voice-mode"|Run as command/);
  assert.match(html, /handleTerminalData\(transcript \+ " "\)/);
});

test('Help is the last Settings item before Close', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  assert.ok(settings.lastIndexOf('<strong>Help</strong>') > settings.lastIndexOf('id="diagnostics-settings-title"'));
  assert.ok(settings.lastIndexOf('<strong>Help</strong>') > settings.lastIndexOf('<strong>Remote agent</strong>'));
  assert.ok(settings.lastIndexOf('<strong>Help</strong>') < settings.lastIndexOf('id="close-settings"'));
});
