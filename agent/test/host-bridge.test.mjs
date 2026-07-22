import test from 'node:test';
import assert from 'node:assert/strict';
import { V86HostBridge } from '../../network/browser/v86-host-bridge.js';

test('host bridge handles each vmagent RPC request id only once', async () => {
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
