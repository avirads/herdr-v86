import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const markdown = await readFile(new URL('../../docs/guest-tools.md', import.meta.url), 'utf8');
const html = await readFile(new URL('../../docs/guest-tools.html', import.meta.url), 'utf8');

const projects = [
  ['Rig', 'https://github.com/0xPlaygrounds/rig'],
  ['Zerostack', 'https://github.com/gi-dellav/zerostack'],
  ['DeepAgentsJS', 'https://github.com/langchain-ai/deepagentsjs'],
  ['Mastra', 'https://github.com/mastra-ai/mastra'],
];

test('help documents vmmastra commands and shared agent facilities', () => {
  assert.match(markdown, /## `vmmastra` — Mastra workspace agent/);
  assert.match(markdown, /vmmastra tools lean\|full/);
  assert.match(markdown, /vmmastra code threads/);
  assert.match(markdown, /Project file inspection and editing/);
  assert.match(markdown, /JavaScript is\s+tested with both `qjs` and `vmjs`/);
});

test('responsive help contains official upstream project links', () => {
  for (const [name, url] of projects) {
    assert.match(markdown, new RegExp(`\\[${name}\\]\\(${url.replaceAll('/', '\\/')}\\)`));
    assert.match(html, new RegExp(`href="${url.replaceAll('/', '\\/')}"`));
  }
});
