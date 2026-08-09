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
      async chat() { return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'verified' } }] }; },
    },
  });
  const result = await harness.run('inspect');
  assert.deepEqual(workspaces, ['/root/project']);
  assert.equal(result.outputText, 'verified');
  assert.equal(result.status, 'completed');
});

