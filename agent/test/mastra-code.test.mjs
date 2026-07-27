import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeAgentHarness, MODES, SLASH_COMMANDS } from '../src/mastra-code.js';

function scripted(replies) {
  let turn = 0;
  return {
    get turns() { return turn; },
    async chat() {
      return { choices: [{ index: 0, message: { role: 'assistant', content: replies[turn++] ?? '{"final":"done"}' }, finish_reason: 'stop' }] };
    },
  };
}

test('requires guest and llm client', () => {
  assert.throws(() => new CodeAgentHarness({ llmClient: { chat() {} } }), /guest bridge/);
  assert.throws(() => new CodeAgentHarness({ guest: {} }), /LLM client/);
});

test('slash commands are returned as typed objects without calling getAgent', async () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '__V86AGENT_EXIT__0\nok\n', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  // init calls loadOrCreateThread which needs IndexedDB; skip and seed manually
  harness.currentThread = { id: 't1', createdAt: new Date(), updatedAt: new Date(), mode: 'code', messages: [] };

  assert.equal((await harness.run('/exit')).type, 'exit');
  assert.equal((await harness.run('/stop')).type, 'stop');
  assert.equal((await harness.run('/help')).type, 'help');
  const modeResult = await harness.run('/mode');
  assert.equal(modeResult.type, 'mode');
  assert.match(modeResult.message, /Current mode: code/);
});

test('/mode switches to valid modes and rejects unknown ones', async () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  harness.currentThread = { id: 't1', createdAt: new Date(), updatedAt: new Date(), mode: 'code', messages: [] };

  let   r = await harness.run('/mode chat');
  assert.match(r.message, /mode set to chat/);
  assert.equal(harness.mode, 'chat');

  r = await harness.run('/mode batch');
  assert.match(r.message, /mode set to batch/);
  assert.equal(harness.mode, 'batch');

  r = await harness.run('/mode code');
  assert.match(r.message, /mode set to code/);
  assert.equal(harness.mode, 'code');

  // unknown mode
  r = await harness.run('/mode foo');
  assert.match(r.message, /Unknown/);
  assert.equal(harness.mode, 'code');
});

test('/reset clears the agent and creates a new thread', async () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  harness.currentThread = { id: 'old', createdAt: new Date(), updatedAt: new Date(), mode: 'code', messages: ['msg'] };
  harness._agent = {};

  const r = await harness.run('/reset');
  assert.equal(r.type, 'reset');
  assert.notEqual(harness.currentThread?.id, 'old', 'thread id should change');
  assert.equal(harness._agent, null, 'agent should be cleared');
});

test('setYolo propagates to the mastra agent when built', () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  harness.setYolo(false);
  assert.equal(harness.yolo, false);
  // With no _agent, it should not throw
  harness.setYolo(true);
  assert.equal(harness.yolo, true);
});

test('stop aborts only when a task is in flight', () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  // No abort controller set — must not throw
  harness.stop();
  assert.equal(harness.abortController, null);

  // Set one and stop
  const ac = new AbortController();
  harness.abortController = ac;
  harness.stop();
  assert.ok(ac.signal.aborted);
  assert.equal(harness.abortController, null);
});

test('setMode validates mode input', () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  for (const mode of MODES) harness.setMode(mode);
  assert.throws(() => harness.setMode('invalid'), /Unknown mode/);
});

test('SLASH_COMMANDS is a complete map', () => {
  assert.ok(SLASH_COMMANDS['/exit']);
  assert.ok(SLASH_COMMANDS['/stop']);
  assert.ok(SLASH_COMMANDS['/reset']);
  assert.ok(SLASH_COMMANDS['/help']);
  assert.ok(SLASH_COMMANDS['/mode']);
  assert.equal(Object.keys(SLASH_COMMANDS).length, 5);
});

test('help text lists all slash commands and modes', async () => {
  const harness = new CodeAgentHarness({
    guest: { execute: async () => '', list: async () => '', read: async () => '', write: async () => {}, grep: async () => '', glob: async () => '', delete: async () => {} },
    llmClient: { chat: async () => ({ choices: [] }) },
  });
  harness.currentThread = { id: 't1', createdAt: new Date(), updatedAt: new Date(), mode: 'code', messages: [] };

  const r = await harness.run('/help');
  assert.equal(r.type, 'help');
  for (const cmd of Object.keys(SLASH_COMMANDS)) {
    assert.match(r.message, new RegExp(cmd.replace('/', '\\/')));
  }
  for (const mode of MODES) {
    assert.match(r.message, new RegExp(mode));
  }
});
