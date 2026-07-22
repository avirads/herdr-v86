import test from 'node:test';
import assert from 'node:assert/strict';
import { completionWithToolCall } from '../../network/browser/litert-lm-client.js';

test('page-local JSON tool request becomes an OpenAI tool call', () => {
  const completion = completionWithToolCall({
    choices: [{ message: { role: 'assistant', content: '{"tool_call":{"name":"read","arguments":{"path":"README.md"}}}' }, finish_reason: 'stop' }],
  });
  assert.equal(completion.choices[0].message.tool_calls[0].function.name, 'read');
  assert.equal(completion.choices[0].message.tool_calls[0].function.arguments, '{"path":"README.md"}');
  assert.equal(completion.choices[0].finish_reason, 'tool_calls');
});
