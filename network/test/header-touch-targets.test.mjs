import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('header tools have comfortable pointer and mobile touch targets', () => {
  assert.match(html, /#tools button \{ min-height: 44px; min-width: 52px;/);
  assert.match(html, /#tools button \{ min-height: 48px; min-width: 58px;/);
  assert.match(html, /touch-action: manipulation/);
});

test('the enlarged tool group contains the four requested controls', () => {
  const tools = html.slice(html.indexOf('<div id="tools">'), html.indexOf('</header>'));
  for (const id of ['copy-terminal', 'paste-terminal', 'voice-button', 'open-settings']) {
    assert.match(tools, new RegExp(`id="${id}"`));
  }
});
