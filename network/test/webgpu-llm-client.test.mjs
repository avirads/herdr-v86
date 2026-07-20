import assert from 'node:assert/strict';
import { WebGpuLlmClient } from '../browser/webgpu-llm-client.js';

const calls = [];
globalThis.chrome = {
  runtime: {
    lastError: null,
    sendMessage(extensionId, message, callback) {
      calls.push({ extensionId, message });
      const result = message.command === 'pair'
        ? { paired: true }
        : message.command === 'llmStatus'
          ? { webgpu: true, modelName: 'test-model' }
          : { choices: [{ message: { content: 'hello from webgpu' } }] };
      callback({ ok: true, result });
    },
  },
};

const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
const client = new WebGpuLlmClient({ extensionId, token: 'secret-token' });
assert.deepEqual(await client.pair(), { webgpu: true, modelName: 'test-model' });
assert.equal(calls[0].message.command, 'pair');
assert.equal(calls[0].message.token, 'secret-token');
assert.equal(calls[1].message.command, 'llmStatus');
assert.equal(calls[1].message.token, 'secret-token');
const completion = await client.chat({ messages: [{ role: 'user', content: 'hello' }] });
assert.equal(completion.choices[0].message.content, 'hello from webgpu');
assert.equal(calls[2].message.command, 'llmChatCompletions');
console.log(JSON.stringify({ ok: true, calls: calls.length }));
