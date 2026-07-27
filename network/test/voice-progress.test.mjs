import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('voice model loading is prominent and accessible on every viewport', () => {
  assert.match(html, /id="voice-progress" role="status" aria-live="assertive"/);
  assert.match(html, /#voice-progress \{[^}]*position: fixed/);
  assert.match(html, /#voice-progress \{ top: auto; bottom:/);
  assert.match(html, /showVoiceProgress\("Loading Moonshine Tiny\. The first load is about 42 MiB\."\)/);
  assert.match(html, /voiceButton\.setAttribute\("aria-busy", String\(!error\)\)/);
});

test('voice progress follows model, permission, listening, and error states', () => {
  assert.match(html, /Downloading and loading Moonshine Tiny/);
  assert.match(html, /Voice model loaded\. Allow microphone access/);
  assert.match(html, /Starting local speech recognition/);
  assert.match(html, /onTranscribeStarted\(\) \{[\s\S]*hideVoiceProgress\(\)/);
  assert.match(html, /showVoiceProgress\(error\.message, \{ error: true \}\)/);
});
