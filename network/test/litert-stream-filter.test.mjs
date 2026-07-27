import assert from 'node:assert/strict';
import test from 'node:test';
import { StreamingTextFilter } from '../browser/litert-lm-client.js';

test('stream filter stops and suppresses repeated pad tokens', () => {
  const filter = new StreamingTextFilter();
  assert.deepEqual(filter.push('Hello '), { text: 'Hello ', stop: false });
  assert.deepEqual(filter.push('<pad><pad><pad>'), { text: '', stop: true });
  assert.deepEqual(filter.push('<pad>'), { text: '', stop: true });
});

test('stream filter recognizes a terminal token split across chunks', () => {
  const filter = new StreamingTextFilter();
  assert.deepEqual(filter.push('Answer<pa'), { text: 'Answer', stop: false });
  assert.deepEqual(filter.push('d>ignored'), { text: '', stop: true });
  assert.equal(filter.flush(), '');
});

test('stream filter preserves ordinary angle-bracket text', () => {
  const filter = new StreamingTextFilter();
  const parts = [filter.push('Use <path'), filter.push('> here'), filter.flush()];
  assert.equal(parts.map(part => typeof part === 'string' ? part : part.text).join(''), 'Use <path> here');
  assert.equal(parts[1].stop, false);
});
