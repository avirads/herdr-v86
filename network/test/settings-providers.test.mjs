import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('provider controls are grouped at the top of Settings', () => {
  const settings = html.slice(html.indexOf('<dialog id="settings-dialog">'), html.indexOf('<dialog id="remote-dialog">'));
  const providers = settings.indexOf('class="provider-settings"');
  const files = settings.indexOf('<strong>Import file</strong>');
  assert.ok(providers >= 0 && providers < files);
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
