import assert from 'node:assert/strict';
import test from 'node:test';
import { StreamingTextFilter } from '../../shared/litert-lm-client.js';

test('stream filter allows startup padding but stops a confirmed pad loop', () => {
  const filter = new StreamingTextFilter();
  assert.deepEqual(filter.push('<bos><pad>Hello '), { text: 'Hello ', stop: false });
  assert.deepEqual(filter.push('<pad><pad><pad>'), { text: '', stop: false });
  assert.deepEqual(filter.push('<pad><pad><pad><pad><pad>'), { text: '', stop: true });
  assert.deepEqual(filter.push('<pad>'), { text: '', stop: true });
});

test('stream filter recognizes a terminal token split across chunks', () => {
  const filter = new StreamingTextFilter();
  assert.deepEqual(filter.push('<bo'), { text: '', stop: false });
  assert.deepEqual(filter.push('s>Answer<eo'), { text: 'Answer', stop: false });
  assert.deepEqual(filter.push('s>ignored'), { text: '', stop: true });
});

test('stream filter preserves ordinary angle-bracket text', () => {
  const filter = new StreamingTextFilter();
  const parts = [filter.push('Use <path'), filter.push('> here'), filter.flush()];
  assert.equal(parts.map(part => typeof part === 'string' ? part : part.text).join(''), 'Use <path> here');
  assert.equal(parts[1].stop, false);
});
