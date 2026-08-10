import test from 'node:test';
import assert from 'node:assert/strict';
import { createClineModel, createClineVMAgent } from '../src/cline-browser.js';

test('Cline AgentModel adapts VMVM chat responses and usage', async () => {
  const requests = [];
  const model = createClineModel({
    modelName: 'test-model',
    async chat(request) {
      requests.push(request);
      return {
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ready' } }],
        usage: { prompt_tokens: 4, completion_tokens: 2 },
      };
    },
  });
  const events = [];
  for await (const event of model.stream({
    systemPrompt: 'system',
    messages: [{ id: 'u1', role: 'user', createdAt: 1, content: [{ type: 'text', text: 'hello' }] }],
    tools: [],
  })) events.push(event);
  assert.equal(requests[0].messages[0].content, 'system');
  assert.equal(requests[0].tool_choice, undefined);
  assert.deepEqual(events.map(event => event.type), ['text-delta', 'usage', 'finish']);
  assert.equal(events[0].text, 'ready');
  assert.equal(events[1].usage.outputTokens, 2);
});

test('official Cline runtime runs in the browser harness without Node tools', async () => {
  const workspaces = [];
  const harness = createClineVMAgent({
    guest: {
      setWorkspace(path) { workspaces.push(path); },
      async read() { return ''; }, async list() { return ''; }, async grep() { return ''; },
      async write() {}, async execute() { return '__V86AGENT_EXIT__0\n'; },
    },
    llmClient: {
      modelName: 'test-model',
      async chat({ messages }) {
        const reminded = messages.some(message => /finish_task/.test(String(message.content || '')));
        return reminded
          ? { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'finish-1', type: 'function', function: { name: 'finish_task', arguments: '{"summary":"verified"}' } }] } }] }
          : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'inspect' } }] };
      },
    },
  });
  const result = await harness.run('inspect');
  assert.deepEqual(workspaces, ['/root/project']);
  assert.equal(result.outputText, 'verified');
  assert.equal(result.status, 'completed');
});

test('Cline does not report an echoed task as completion and executes the requested write', async () => {
  const writes = [];
  let turn = 0;
  const harness = createClineVMAgent({
    guest: {
      setWorkspace() {}, async read() { return ''; }, async list() { return ''; }, async grep() { return ''; },
      async write(path, content) { writes.push({ path, content }); },
      async execute() { return '__V86AGENT_EXIT__0\n'; },
    },
    llmClient: {
      modelName: 'test-model',
      async chat() {
        turn++;
        if (turn === 1) return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'write a file named test.txt and write text hello' } }] };
        if (turn === 2) return { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-1', type: 'function', function: { name: 'write_file', arguments: '{"path":"test.txt","content":"hello"}' } }] } }] };
        return { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'finish-1', type: 'function', function: { name: 'finish_task', arguments: '{"summary":"Created test.txt"}' } }] } }] };
      },
    },
  });
  const result = await harness.run('write a file named test.txt and write text hello');
  assert.deepEqual(writes, [{ path: 'test.txt', content: 'hello' }]);
  assert.equal(result.outputText, 'Created test.txt');
  assert.equal(result.iterations, 3);
});

test('Cline requires a tool call whenever tools are available', async () => {
  let request;
  const model = createClineModel({
    async chat(value) {
      request = value;
      return { choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'x', function: { name: 'finish_task', arguments: '{"summary":"ok"}' } }] } }] };
    },
  });
  for await (const _ of model.stream({ messages: [], tools: [{ name: 'finish_task', description: 'finish', inputSchema: { type: 'object' } }] })) {}
  assert.equal(request.tool_choice, 'required');
});

test('matching write and read-back evidence completes without a finish_task handshake', async () => {
  const files = new Map();
  let turn = 0;
  const harness = createClineVMAgent({
    guest: {
      setWorkspace() {}, async list() { return ''; }, async grep() { return ''; },
      async write(path, content) { files.set(path, content); },
      async read(path) { return files.get(path) || ''; },
      async execute() { return '__V86AGENT_EXIT__0\n'; },
    },
    llmClient: {
      async chat() {
        turn++;
        if (turn === 1) return { choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'w', function: { name: 'write_file', arguments: '{"path":"test2.txt","content":"hello2"}' } }] } }] };
        if (turn === 2) return { choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'r', function: { name: 'read_file', arguments: '{"path":"test2.txt"}' } }] } }] };
        return { choices: [{ finish_reason: 'stop', message: { content: '[SYSTEM] completion reminder' } }] };
      },
    },
  });
  const result = await harness.run('create test2.txt containing hello2, then read it back');
  assert.equal(turn, 3, 'verified evidence stops the retry loop immediately');
  assert.equal(result.status, 'completed');
  assert.equal(result.outputText, 'Verified test2.txt by reading back the written content.');
});
