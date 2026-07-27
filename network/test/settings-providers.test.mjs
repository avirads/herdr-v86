import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('provider controls are grouped at the top of Settings', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  const providers = settings.indexOf('class="provider-settings"');
  const transfers = settings.indexOf('id="project-transfer-settings-title"');
  assert.ok(providers >= 0 && providers < transfers);
  for (const title of ['AI Model', 'AutoBro', 'Voice']) {
    assert.match(settings, new RegExp(`<h3[^>]*>${title}</h3>`));
  }
  assert.match(settings, /id="configure-llm-later"[^>]*>Load</);
  assert.match(settings, /id="reset-llm"[^>]*>Reset</);
  assert.match(settings, /id="configure-autobro-later"[^>]*>Connect</);
  assert.match(settings, /id="reset-autobro"[^>]*>Reset</);
  assert.match(settings, /id="load-voice"[^>]*>Load</);
  assert.match(settings, /id="reset-voice"[^>]*>Reset</);
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

test('Settings Voice links to the versioned Moonshine Tiny model ZIP on fapstaff', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  assert.match(settings, /href="https:\/\/fapstaff\.com\/downloads\/moonshine-tiny-quantized-0\.1\.29\.zip" download/);
  assert.match(settings, />Download Moonshine Tiny voice model ZIP<\/a>/);
});
