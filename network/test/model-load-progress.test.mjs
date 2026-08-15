import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('AI model loading exposes prominent accessible percentage progress', () => {
  assert.match(html, /id="model-progress" role="status" aria-live="assertive" aria-atomic="true"/);
  assert.match(html, /id="model-progress-percent">0%<\/span>/);
  assert.match(html, /<progress id="model-progress-bar" max="100" value="0"><\/progress>/);
  assert.match(html, /#model-progress \{[^}]*position: fixed[^}]*z-index: 1400/);
  assert.match(html, /#model-progress \{ top: max\(10px, env\(safe-area-inset-top\)\)/);
});

test('model activity updates byte and staged loading percentages', () => {
  assert.match(html, /message\.startsWith\("caching"\)[\s\S]*5 \+ detail\.progress \* 75/);
  assert.match(html, /message\.includes\("WebAssembly runtime"\)[\s\S]*showModelProgress\(85/);
  assert.match(html, /message\.includes\("compiles WebGPU kernels"\)[\s\S]*showModelProgress\(92/);
  assert.match(html, /message\.startsWith\("ready"\)[\s\S]*finishModelProgress/);
});

test('file selection shows progress and loading controls recover after completion', () => {
  assert.match(html, /modelLoadUiActive = true;[\s\S]*setModelLoadControlsBusy\(true\);[\s\S]*showModelProgress\(1,/);
  assert.match(html, /finishModelProgress\(imported\.cached[\s\S]*Ready — \$\{client\.modelName\}/);
  assert.match(html, /showModelProgress\(modelProgressBar\.value,[\s\S]*\{ error: true \}/);
  assert.match(html, /finally \{[\s\S]*modelLoadUiActive = false;[\s\S]*setModelLoadControlsBusy\(false\)/);
});

test('cache progress is not duplicated in the main-page model status', () => {
  assert.match(html, /if \(!\(modelLoadUiActive && event\.detail\.message\.startsWith\("caching "\)\)\) \{[\s\S]*llmStatus\(event\.detail\.message\)/);
  assert.match(html, /modelLoadUiActive = true;[\s\S]*llmStatus\("loading model…"\);[\s\S]*showModelProgress\(1,/);
});
