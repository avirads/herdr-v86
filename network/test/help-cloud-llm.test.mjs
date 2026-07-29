import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const help = await readFile(new URL('../../docs/guest-tools.md', import.meta.url), 'utf8');

test('Settings Help advertises local and cloud LLM connection guidance', () => {
  assert.match(html, /including local and cloud LLM connections/);
  assert.match(html, /window\.open\("docs\/guest-tools\.html"/);
});

test('Help documents supported cloud paths and local-agent defaults', () => {
  assert.match(help, /Rig, Zerostack, vmlang, and vmmastra use the model loaded/);
  assert.match(help, /OpenAI Responses API/);
  assert.match(help, /OpenAI-compatible cloud gateway/);
  assert.match(help, /Anthropic Claude native API/);
  assert.match(help, /Google Gemini native API/);
  assert.match(help, /POST `?\/responses`?/);
  assert.match(help, /api\.anthropic\.com\/v1\/messages/);
  assert.match(help, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(help, /If `ip route`\s+has no default route/);
  assert.match(help, /unset every credential variable/);
});
