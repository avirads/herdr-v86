import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('header tools have comfortable pointer and mobile touch targets', () => {
  assert.match(html, /#tools button \{ width: 44px; height: 44px; min-height: 44px; min-width: 44px;/);
  assert.match(html, /#tools button \{ width: 48px; height: 48px; min-height: 48px; min-width: 48px;/);
  assert.match(html, /touch-action: manipulation/);
});

test('the enlarged tool group contains the four requested controls', () => {
  const tools = html.slice(html.indexOf('<div id="tools">'), html.indexOf('</header>'));
  for (const id of ['copy-terminal', 'paste-terminal', 'voice-button', 'open-settings']) {
    assert.match(tools, new RegExp(`id="${id}"`));
  }
});

test('Copy falls back to visible terminal text when touch selection is unavailable', () => {
  assert.match(html, /function visibleTerminalText\(\)/);
  assert.match(html, /const buffer = term\.buffer\.active/);
  assert.match(html, /const text = selection \|\| visibleTerminalText\(\)/);
  assert.match(html, /Visible terminal copied/);
  assert.doesNotMatch(html, /Select terminal text before copying/);
});
