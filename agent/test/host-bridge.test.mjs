import test from 'node:test';
import assert from 'node:assert/strict';
import { V86HostBridge } from '../../network/browser/v86-host-bridge.js';

test('host bridge handles each agent RPC request id only once', async () => {
  const listeners = new Map();
  const emulator = {
    add_listener(name, listener) { listeners.set(name, listener); },
    serial_send_bytes() {},
  };
  const calls = [];
  const bridge = new V86HostBridge(emulator, { agentHandler: async (...args) => calls.push(args) });
  const prompt = btoa('perform task');
  await bridge.handle(`AGENT_RUN\trequest-123\t${prompt}`);
  await bridge.handle(`AGENT_RUN\trequest-123\t${prompt}`);
  assert.deepEqual(calls, [['run', 'perform task']]);
});

test('host bridge replays agent RPC requests received during initialization', async () => {
  const emulator = {
    add_listener() {},
    serial_send_bytes() {},
  };
  const calls = [];
  const bridge = new V86HostBridge(emulator);
  const prompt = btoa('generate factorial.js');

  await bridge.handle(`AGENT_MASTRA_CODE\trequest-early\t${prompt}`);
  await bridge.handle(`AGENT_MASTRA_CODE\trequest-early\t${prompt}`);
  assert.deepEqual(calls, []);

  bridge.setAgentHandler(async (...args) => calls.push(args));
  assert.deepEqual(calls, [['mastra_code', 'generate factorial.js']]);
});

test('host bridge formats page-local completions as OpenAI SSE', () => {
  const emulator = { add_listener() {}, serial_send_bytes() {} };
  const bridge = new V86HostBridge(emulator);
  const output = bridge.openAiSse({
    id: 'local-1', model: 'webgpu',
    choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read', arguments: '{"path":"README.md"}' } }] }, finish_reason: 'tool_calls' }],
  });
  assert.match(output, /data: .*"tool_calls"/);
  assert.match(output, /"finish_reason":"tool_calls"/);
  assert.match(output, /data: \[DONE\]/);
});

test('browser eval supports CommonJS exports and returns console output', async () => {
  const emulator = { add_listener() {}, serial_send_bytes() {} };
  const bridge = new V86HostBridge(emulator);
  const replies = [];
  bridge.reply = async (_id, kind, value = '') => replies.push([kind, value]);

  await bridge.eval('eval-1', btoa([
    'function factorial(n) { return n < 2 ? 1 : n * factorial(n - 1); }',
    'console.log("Factorial of 5 is:", factorial(5));',
    'module.exports = factorial;',
  ].join('\n')));

  const encoded = replies.filter(([kind]) => kind === 'DATA').map(([, value]) => value).join('');
  assert.equal(atob(encoded), 'Factorial of 5 is: 120');
  assert.deepEqual(replies.at(-1), ['END', '0']);
});
