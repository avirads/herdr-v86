import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../browser/remote-llm-peer.js', import.meta.url), 'utf8');

test('a blank LiteRT stream retries through non-streaming chat', () => {
  assert.match(source, /if \(client\.chatStream && !streamedContent\.trim\(\) && client\.chat\)/);
  assert.match(source, /completion = await client\.chat\(body\)/);
  assert.match(source, /client\.chatStream && streamedContent \? \{ type: 'llm\.done', id \} : response/);
});
