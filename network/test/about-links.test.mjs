import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const about = await readFile(new URL('../../docs/about.html', import.meta.url), 'utf8');
const componentTable = about.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
const componentCells = [...componentTable.matchAll(/<tr><td>([\s\S]*?)<\/td>/g)].map((match) => match[1]);

test('every About component links to its project in a safe new tab', () => {
  assert.ok(componentCells.length > 40);
  for (const cell of componentCells) {
    assert.match(cell, /<a\s/);
    for (const link of cell.matchAll(/<a\s[^>]*>/g)) {
      assert.match(link[0], /href="[^"]+"/);
      assert.match(link[0], /target="_blank"/);
      assert.match(link[0], /rel="noopener noreferrer"/);
    }
  }
});
