// Conformance against the real AI SDK rather than our own assumptions.
// ai@5 resolves @ai-sdk/provider@2.0.3 — the same spec-v2 package Mastra
// bundles as `@ai-sdk/provider-v5`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, streamText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { createLiteRt } from '../src/litert-provider.js';

function scriptedClient(replies) {
  const queue = [...replies];
  const calls = [];
  return {
    calls,
    async chat(body) {
      calls.push(body);
      const next = queue.shift() ?? 'done';
      return {
        choices: [{ index: 0, message: { role: 'assistant', content: next }, finish_reason: 'stop' }],
      };
    },
    async chatStream(body, onChunk) {
      calls.push(body);
      for (const piece of (queue.shift() ?? 'done').match(/.{1,4}/g) || []) await onChunk(piece);
    },
  };
}

test('generateText accepts the provider and returns text', async () => {
  const model = createLiteRt({ client: scriptedClient(['hello from the vm']) })('gemma-4-e2b');
  const result = await generateText({ model, prompt: 'say hi' });
  assert.equal(result.text, 'hello from the vm');
  assert.equal(result.finishReason, 'stop');
});

test('full tool loop: AI SDK calls the tool and feeds the result back', async () => {
  const executed = [];
  const client = scriptedClient([
    '{"tool_call":{"name":"vmfetch","arguments":{"url":"https://example.com"}}}',
    '{"final":"fetched 200 OK"}',
  ]);
  const model = createLiteRt({ client })('gemma-4-e2b');

  const result = await generateText({
    model,
    prompt: 'fetch example.com',
    stopWhen: stepCountIs(5),
    tools: {
      vmfetch: tool({
        description: 'Browser-backed HTTP client',
        inputSchema: z.object({ url: z.string() }),
        execute: async ({ url }) => {
          executed.push(url);
          return '200 OK';
        },
      }),
    },
  });

  // the model asked for the tool, the SDK ran it, the model saw the result
  assert.deepEqual(executed, ['https://example.com']);
  assert.equal(result.text, 'fetched 200 OK');
  assert.equal(result.steps.length, 2);

  // second turn must carry the tool result back into the prompt
  const secondTurn = JSON.stringify(client.calls[1].messages);
  assert.match(secondTurn, /200 OK/);
});

test('the JSON Schema the SDK derives from zod reaches the prompt catalog', async () => {
  const client = scriptedClient(['{"final":"ok"}']);
  const model = createLiteRt({ client })();
  await generateText({
    model,
    prompt: 'go',
    tools: {
      vmexport: tool({
        description: 'Download a guest file',
        inputSchema: z.object({ path: z.string().describe('absolute guest path') }),
        execute: async () => 'ok',
      }),
    },
  });
  const system = client.calls[0].messages.find(m => m.role === 'system').content;
  assert.match(system, /vmexport/);
  assert.match(system, /absolute guest path/);
});

test('streamText produces a usable text stream', async () => {
  const model = createLiteRt({ client: scriptedClient(['streamed output here']) })();
  const result = streamText({ model, prompt: 'stream please' });
  let text = '';
  for await (const chunk of result.textStream) text += chunk;
  assert.equal(text, 'streamed output here');
});

test('SDK surfaces our unsupported-setting warnings', async () => {
  const model = createLiteRt({ client: scriptedClient(['x']) })();
  const result = await generateText({ model, prompt: 'hi', topK: 40 });
  assert.ok(result.warnings.some(w => w.setting === 'topK'));
});

test('toolChoice required is honoured through the SDK', async () => {
  const client = scriptedClient(['{"tool_call":{"name":"ping","arguments":{}}}']);
  const model = createLiteRt({ client })();
  await generateText({
    model,
    prompt: 'go',
    toolChoice: 'required',
    stopWhen: stepCountIs(1),
    tools: { ping: tool({ inputSchema: z.object({}), execute: async () => 'pong' }) },
  });
  const system = client.calls[0].messages.find(m => m.role === 'system').content;
  assert.match(system, /MUST call one of the tools/);
});
