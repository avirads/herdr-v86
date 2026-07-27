import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../remote.html', import.meta.url), 'utf8');

test('a successfully connected pairing key is remembered and prefilled', () => {
  assert.match(html, /const SAVED_PAIRING_KEY = 'vm\.remotePairingKey'/);
  assert.match(html, /await remote\.connect\(rawKey\);[\s\S]*localStorage\.setItem\(SAVED_PAIRING_KEY, rawKey\)/);
  assert.match(html, /else \{[\s\S]*key\.value = localStorage\.getItem\(SAVED_PAIRING_KEY\) \|\| ''/);
});

test('a URL pairing key takes precedence over the remembered key', () => {
  const urlBranch = html.slice(html.indexOf("const urlKey ="), html.indexOf("// In-page scanner"));
  assert.match(urlBranch, /if \(urlKey\)/);
  assert.match(urlBranch, /key\.value = urlKey;[\s\S]*connectWithKey\(urlKey\.trim\(\)\);[\s\S]*\} else \{/);
});
