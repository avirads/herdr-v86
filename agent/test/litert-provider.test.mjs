import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LiteRtLanguageModel,
  createLiteRt,
  convertPrompt,
  extractToolCall,
  parseCompletion,
  toolProtocolInstruction,
} from '../src/litert-provider.js';

// --- fakes ----------------------------------------------------------------

function fakeClient(reply, { stream = null } = {}) {
  const calls = [];
  const client = {
    calls,
    async chat(body) {
      calls.push(body);
      return typeof reply === 'function' ? reply(body) : reply;
    },
  };
  if (stream) {
    client.chatStream = async (body, onChunk) => {
      calls.push(body);
      for (const chunk of stream) await onChunk(chunk);
    };
  }
  return client;
}

const completion = content => ({
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
});

const TOOLS = [
  {
    type: 'function',
    name: 'vmfetch',
    description: 'Browser-backed HTTP client',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  },
];

async function drain(stream) {
  const parts = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return parts;
}

// --- spec conformance -----------------------------------------------------

test('declares the v2 provider interface', () => {
  const model = createLiteRt({ client: fakeClient(completion('hi')) })('gemma-4-e2b');
  assert.equal(model.specificationVersion, 'v2');
  assert.equal(model.provider, 'litert-lm');
  assert.equal(model.modelId, 'gemma-4-e2b');
  assert.deepEqual(model.supportedUrls, {});
  assert.equal(typeof model.doGenerate, 'function');
  assert.equal(typeof model.doStream, 'function');
});

test('rejects a client without chat()', () => {
  assert.throws(() => new LiteRtLanguageModel({}), /requires a client/);
});

// --- prompt conversion ----------------------------------------------------

test('converts every prompt role into engine turns', () => {
  const messages = convertPrompt([
    { role: 'system', content: 'be brief' },
    { role: 'user', content: [{ type: 'text', text: 'list files' }] },
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'ls', input: '{"path":"/"}' }],
    },
    {
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: 'c1', toolName: 'ls', output: { type: 'text', value: 'a.txt' } },
      ],
    },
  ]);

  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].content, 'list files');
  assert.match(messages[2].content, /\[tool call\] ls/);
  // tool results are folded into a user turn: the engine has no tool role
  assert.equal(messages[3].role, 'user');
  assert.match(messages[3].content, /a\.txt/);
});

test('drops file parts with a placeholder rather than crashing', () => {
  const [message] = convertPrompt([
    { role: 'user', content: [{ type: 'file', data: 'x', mediaType: 'image/png' }] },
  ]);
  assert.match(message.content, /file omitted: image\/png/);
});

// --- tool protocol --------------------------------------------------------

test('injects the protocol into an existing system message', async () => {
  const client = fakeClient(completion('{"final":"done"}'));
  const model = createLiteRt({ client })();
  await model.doGenerate({ prompt: [{ role: 'system', content: 'be brief' }], tools: TOOLS });

  const sent = client.calls[0].messages[0];
  assert.equal(sent.role, 'system');
  assert.match(sent.content, /^be brief/);
  assert.match(sent.content, /tool_call/);
  assert.match(sent.content, /vmfetch/);
  assert.match(sent.content, /put every tool parameter inside "arguments"/i);
});

test('toolChoice none suppresses the protocol entirely', async () => {
  const client = fakeClient(completion('plain answer'));
  const model = createLiteRt({ client })();
  await model.doGenerate({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    tools: TOOLS,
    toolChoice: { type: 'none' },
  });
  assert.equal(client.calls[0].messages.some(m => /tool_call/.test(m.content)), false);
});

test('toolChoice required and specific tool are stated in the prompt', () => {
  assert.match(toolProtocolInstruction(TOOLS, { type: 'required' }), /MUST call one of the tools/);
  assert.match(toolProtocolInstruction(TOOLS, { type: 'tool', toolName: 'vmfetch' }), /MUST call the tool "vmfetch"/);
});

// --- tool-call shape tolerance -------------------------------------------

test('accepts every tool-call shape a small model emits', () => {
  const shapes = [
    { tool_call: { name: 'vmfetch', arguments: { url: 'https://x' } } },
    { toolCall: { name: 'vmfetch', arguments: { url: 'https://x' } } },
    { tool: 'vmfetch', args: { url: 'https://x' } },
    { name: 'vmfetch', arguments: { url: 'https://x' } },
    { function: { name: 'vmfetch', parameters: { url: 'https://x' } } },
  ];
  for (const shape of shapes) {
    const call = extractToolCall(shape);
    assert.ok(call, `failed to extract from ${JSON.stringify(shape)}`);
    assert.equal(call.name, 'vmfetch');
    assert.equal(call.arguments.url, 'https://x');
  }
});

test('stringified arguments are re-parsed, not double-encoded', () => {
  const call = extractToolCall({ tool_call: { name: 'v', arguments: '{"url":"https://x"}' } });
  assert.deepEqual(call.arguments, { url: 'https://x' });
});

test('parses a fenced JSON tool call into spec content', () => {
  const result = parseCompletion(
    completion('```json\n{"tool_call":{"name":"vmfetch","arguments":{"url":"https://x"}}}\n```'),
    { hasTools: true },
  );
  assert.equal(result.finishReason, 'tool-calls');
  assert.equal(result.content[0].type, 'tool-call');
  assert.equal(result.content[0].toolName, 'vmfetch');
  assert.equal(typeof result.content[0].input, 'string', 'input must be a JSON string per spec');
  assert.deepEqual(JSON.parse(result.content[0].input), { url: 'https://x' });
});

test('parses a tool call wrapped in stray prose', () => {
  const result = parseCompletion(
    completion('Sure! {"tool_call":{"name":"vmfetch","arguments":{"url":"https://x"}}} ok?'),
    { hasTools: true },
  );
  assert.equal(result.content[0].toolName, 'vmfetch');
});

test('honours tool_calls the client already normalized', () => {
  const result = parseCompletion(
    {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'vmclip', arguments: '{"mode":"read"}' } }],
          },
        },
      ],
    },
    { hasTools: true },
  );
  assert.equal(result.finishReason, 'tool-calls');
  assert.equal(result.content[0].toolCallId, 'call_1');
  assert.deepEqual(JSON.parse(result.content[0].input), { mode: 'read' });
});

test('{"final": ...} becomes text, not a tool call', () => {
  const result = parseCompletion(completion('{"final":"all done"}'), { hasTools: true });
  assert.equal(result.finishReason, 'stop');
  assert.deepEqual(result.content, [{ type: 'text', text: 'all done' }]);
});

test('non-JSON prose passes through as text', () => {
  const result = parseCompletion(completion('just an answer'), { hasTools: true });
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.content[0].text, 'just an answer');
});

test('JSON that is not a tool call stays text when tools are bound', () => {
  const result = parseCompletion(completion('{"note":"not a call"}'), { hasTools: true });
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.content[0].type, 'text');
});

test('gemma native call syntax becomes a tool call on the vmlang tier', () => {
  // Same verbatim reply that defeated the rig tier: opening delimiter, the
  // tool name outside the braces, bare keys. Before this it parsed as nothing
  // and the turn was spent as prose — the shape of a 60-step recursion limit.
  const reply =
    '<|tool_call>call:mastra_workspace_write_file{path: "greet.js", ' +
    'content: "export function greet(name) {\\n  return `hello, ${name}`;\\n}"\n}<tool_call|>';
  const result = parseCompletion(completion(reply), { hasTools: true });
  assert.equal(result.finishReason, 'tool-calls');
  assert.equal(result.content[0].toolName, 'mastra_workspace_write_file');
  const input = JSON.parse(result.content[0].input);
  assert.equal(input.path, 'greet.js');
  assert.equal(input.content, 'export function greet(name) {\n  return `hello, ${name}`;\n}');
});

test('a leading delimiter no longer costs the turn', () => {
  const result = parseCompletion(
    completion('<|tool_call>{"tool_call":{"name":"vmfetch","arguments":{"url":"/a"}}}<tool_call|>'),
    { hasTools: true },
  );
  assert.equal(result.finishReason, 'tool-calls');
  assert.equal(result.content[0].toolName, 'vmfetch');
});

test('a base64-encoded tool call is decoded, not leaked as junk text', () => {
  // The 2B model base64-encodes its protocol object to dodge escaping
  // embedded quotes and newlines. If we do not decode it, the base64 blob
  // leaks straight into the terminal as garbage.
  const encoded = Buffer.from(
    '{"tool_call":{"name":"mastra_workspace_write_file","arguments":{"path":"prime_checker.js","content":"function isPrime(n){ return n>1; }"}}}',
  ).toString('base64');
  const result = parseCompletion(completion(encoded), { hasTools: true });
  assert.equal(result.finishReason, 'tool-calls');
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].toolName, 'mastra_workspace_write_file');
  const input = JSON.parse(result.content[0].input);
  assert.equal(input.path, 'prime_checker.js');
  assert.match(input.content, /isPrime/);
});

test('base64 detection does not swallow ordinary prose', () => {
  const result = parseCompletion(completion('the file is at /root/project now'), { hasTools: true });
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.content[0].text, 'the file is at /root/project now');
});

// --- doGenerate -----------------------------------------------------------

test('doGenerate returns a spec-shaped result', async () => {
  const model = createLiteRt({ client: fakeClient(completion('hello')) })();
  const result = await model.doGenerate({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  });
  assert.deepEqual(result.content, [{ type: 'text', text: 'hello' }]);
  assert.equal(result.finishReason, 'stop');
  assert.deepEqual(Object.keys(result.usage).sort(), ['inputTokens', 'outputTokens', 'totalTokens']);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.request.body.messages);
});

test('warns on sampling controls the engine cannot honour', async () => {
  const model = createLiteRt({ client: fakeClient(completion('x')) })();
  const result = await model.doGenerate({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    topK: 40,
    seed: 7,
    responseFormat: { type: 'json' },
  });
  const settings = result.warnings.map(w => w.setting);
  assert.ok(settings.includes('topK'));
  assert.ok(settings.includes('seed'));
  assert.ok(settings.includes('responseFormat'));
});

test('maxOutputTokens and temperature reach the client body', async () => {
  const client = fakeClient(completion('x'));
  const model = createLiteRt({ client })();
  await model.doGenerate({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxOutputTokens: 64,
    temperature: 0.3,
  });
  assert.equal(client.calls[0].max_tokens, 64);
  assert.equal(client.calls[0].temperature, 0.3);
});

test('respects an already-aborted signal', async () => {
  const model = createLiteRt({ client: fakeClient(completion('x')) })();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      abortSignal: controller.signal,
    }),
  );
});

// --- doStream -------------------------------------------------------------

test('streams text deltas when no tools are bound', async () => {
  const client = fakeClient(completion('ignored'), { stream: ['he', 'llo'] });
  const model = createLiteRt({ client })();
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  });
  const parts = await drain(stream);
  assert.equal(parts[0].type, 'stream-start');
  assert.deepEqual(
    parts.filter(p => p.type === 'text-delta').map(p => p.delta),
    ['he', 'llo'],
  );
  assert.equal(parts.at(-1).type, 'finish');
  assert.equal(parts.at(-1).finishReason, 'stop');
});

test('buffers instead of streaming when tools are bound, and says so', async () => {
  const client = fakeClient(
    completion('{"tool_call":{"name":"vmfetch","arguments":{"url":"https://x"}}}'),
    { stream: ['nope'] },
  );
  const model = createLiteRt({ client })();
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }],
    tools: TOOLS,
  });
  const parts = await drain(stream);
  const start = parts.find(p => p.type === 'stream-start');
  assert.ok(start.warnings.some(w => /Streaming disabled/.test(w.message || '')));
  const call = parts.find(p => p.type === 'tool-call');
  assert.equal(call.toolName, 'vmfetch');
  assert.equal(parts.at(-1).finishReason, 'tool-calls');
});

test('falls back to buffered streaming when the client cannot stream', async () => {
  const model = createLiteRt({ client: fakeClient(completion('hello')) })();
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  });
  const parts = await drain(stream);
  assert.deepEqual(
    parts.filter(p => p.type === 'text-delta').map(p => p.delta),
    ['hello'],
  );
});

test('a client error becomes an error part plus a finish', async () => {
  const client = fakeClient(completion('x'), { stream: [] });
  client.chatStream = async () => {
    throw new Error('no model loaded');
  };
  const model = createLiteRt({ client })();
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  });
  const parts = await drain(stream);
  assert.equal(parts.find(p => p.type === 'error').error.message, 'no model loaded');
  assert.equal(parts.at(-1).finishReason, 'error');
});

test('extractToolCall accepts a flattened call, as real gemma-4-E2B emits', () => {
  // Observed live: the arguments wrapper is dropped and parameters sit on the
  // call itself. Previously the leftover keys were discarded, the tool ran
  // with {}, the schema rejected it, and the model reported the file missing.
  assert.deepEqual(
    extractToolCall({ tool_call: { name: 'mastra_workspace_read_file', path: '/README.md' } }),
    { name: 'mastra_workspace_read_file', arguments: { path: '/README.md' } },
  );
  assert.deepEqual(
    extractToolCall({ tool_call: { name: 'x', command: 'uname -m', timeout: 5 } }),
    { name: 'x', arguments: { command: 'uname -m', timeout: 5 } },
  );
  // The documented shape must keep working unchanged.
  assert.deepEqual(
    extractToolCall({ tool_call: { name: 'x', arguments: { path: '/a' } } }),
    { name: 'x', arguments: { path: '/a' } },
  );
  // A bare call with no parameters is still a valid call, not a mis-parse.
  assert.deepEqual(extractToolCall({ tool_call: { name: 'x' } }), { name: 'x', arguments: {} });
  // Non-calls stay non-calls.
  assert.equal(extractToolCall({ final: 'done' }), undefined);
});

test('the client turns a flattened tool call into a real OpenAI tool_calls message', async () => {
  const { LiteRtLmClient } = await import('../../shared/litert-lm-client.js');
  const client = new LiteRtLmClient();
  client.modelName = 'test';
  // Drive the real _chat path with the engine seam replaced.
  const replies = [
    '{"tool_call":{"name":"mastra_workspace_read_file","path":"/README.md"}}',
    '{"tool_call":{"name":"ok","arguments":{"a":1}}}',
    '{"final":"done"}',
  ];
  let turn = 0;
  client.engine = { async createConversation() { return { async sendMessage() { return { content: [{ text: replies[turn++] }] } ; } }; } };

  const flattened = await client.chat({ messages: [{ role: 'user', content: 'x' }] });
  const call = flattened?.choices?.[0]?.message?.tool_calls?.[0];
  assert.ok(call, 'flattened call must still become a tool call');
  assert.equal(call.function.name, 'mastra_workspace_read_file');
  assert.deepEqual(JSON.parse(call.function.arguments), { path: '/README.md' });

  const wrapped = await client.chat({ messages: [{ role: 'user', content: 'x' }] });
  assert.deepEqual(JSON.parse(wrapped.choices[0].message.tool_calls[0].function.arguments), { a: 1 });

  const final = await client.chat({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(final.choices[0].message.tool_calls, undefined, 'a final answer is not a tool call');
});
