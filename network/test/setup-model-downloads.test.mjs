import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

const models = [
  ['E2B', 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm?download=true'],
  ['E4B', 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm'],
  ['12B', 'https://huggingface.co/litert-community/gemma-4-12B-it-litert-lm/resolve/main/gemma-4-12B-it-web.litertlm'],
];

test('VM setup offers all three Gemma 4 LiteRT-LM downloads', () => {
  const step = html.slice(html.indexOf('id="setup-step-llm"'), html.indexOf('id="setup-step-autobro"'));
  assert.match(step, /class="model-downloads"/);
  for (const [size, url] of models) {
    assert.ok(step.includes(`href="${url}"`), `missing ${size} download URL`);
    assert.ok(step.includes(`Download Gemma 4 ${size}`), `missing ${size} label`);
  }
});

test('model download choices remain touch-friendly on mobile', () => {
  assert.match(html, /\.model-downloads \{ grid-template-columns: 1fr; \}/);
  assert.match(html, /\.model-downloads \.tool-link \{ min-height: 48px; \}/);
});
