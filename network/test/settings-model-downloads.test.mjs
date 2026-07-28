import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

const models = [
  ['E2B', 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm?download=true'],
  ['E4B', 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm'],
  ['12B', 'https://huggingface.co/litert-community/gemma-4-12B-it-litert-lm/resolve/main/gemma-4-12B-it-web.litertlm'],
];

test('Settings offers all three Gemma 4 LiteRT-LM downloads', () => {
  const section = html.slice(html.indexOf('id="ai-model-settings-title"'), html.indexOf('id="autobro-settings-title"'));
  assert.match(section, /class="model-downloads"/);
  for (const [size, url] of models) {
    assert.ok(section.includes(`href="${url}"`), `missing ${size} download URL`);
    assert.ok(section.includes(`Download Gemma 4 ${size}`), `missing ${size} label`);
  }
});

test('model download choices remain touch-friendly on mobile', () => {
  assert.match(html, /\.model-downloads \{ grid-template-columns: 1fr; \}/);
  assert.match(html, /\.model-downloads \.tool-link \{ min-height: 48px; \}/);
});

test('Settings More info links to the LiteRT-LM article in a new tab', () => {
  const section = html.slice(html.indexOf('id="ai-model-settings-title"'), html.indexOf('id="autobro-settings-title"'));
  assert.match(section, /<details class="model-more-info">[\s\S]*<summary>More info<\/summary>/);
  assert.match(section, /href="https:\/\/developers\.googleblog\.com\/blazing-fast-on-device-genai-with-litert-lm\/"/);
  assert.match(section, /target="_blank" rel="noopener noreferrer"/);
});

test('VM boot opens the shell directly without a setup wizard', () => {
  assert.doesNotMatch(html, /id="setup-overlay"|id="setup-step-/);
  const finishBoot = html.slice(html.indexOf('function finishBoot()'), html.indexOf('function failBoot('));
  assert.match(finishBoot, /bootReady = true/);
  assert.match(finishBoot, /shellReady = true/);
  assert.match(finishBoot, /term"\)\.style\.visibility = "visible"/);
  assert.match(finishBoot, /status\("Shell ready"\)/);
});
