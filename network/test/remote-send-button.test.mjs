import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../remote.html', import.meta.url), 'utf8');

test('mobile Send becomes prominent only when text is ready', () => {
  assert.match(html, /<button id="send" type="submit" disabled>Send<\/button>/);
  assert.match(html, /#send\.ready \{[^}]*background: #1f6feb[^}]*border-color: #388bfd[^}]*color: #fff/);
  assert.match(html, /const ready = Boolean\(prompt\.value\.trim\(\)\) && !sendBusy/);
  assert.match(html, /sendButton\.classList\.toggle\('ready', ready\)/);
  assert.match(html, /prompt\.addEventListener\('input', updateSendButton\)/);
});

test('text and voice requests keep Send state synchronized', () => {
  assert.match(html, /prompt\.value = '';[\s\S]*sendBusy = true;[\s\S]*updateSendButton\(\)/);
  assert.match(html, /finally \{[\s\S]*sendBusy = false;[\s\S]*updateSendButton\(\)/);
  assert.doesNotMatch(html, /document\.getElementById\('send'\)\.disabled/);
});
