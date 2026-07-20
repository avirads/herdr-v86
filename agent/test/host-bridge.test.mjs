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
