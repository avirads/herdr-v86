import test from 'node:test';
import assert from 'node:assert/strict';
import { VmAgentController } from '../../network/browser/vmagent-controller.js';

test('vmagent command controller runs a persistent harness and reports in the terminal', async () => {
  const outputs = [];
  const busy = [];
  const prompts = [];
  let creations = 0;
  const controller = new VmAgentController({
    createAgent: async () => {
      creations += 1;
      return { async run(prompt) { prompts.push(prompt); return { output: `done: ${prompt}` }; } };
    },
    getLlmClient: () => ({ status: async () => ({ modelName: 'test-model' }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
    onBusy: value => busy.push(value),
  });
  await controller.handle('run', 'inspect project');
  await controller.handle('run', 'inspect project');
  await controller.handle('run', 'run tests');
  assert.equal(controller.conversationActive, true);
  assert.equal(creations, 1);
  assert.deepEqual(prompts, ['inspect project', 'run tests']);
  assert.equal(outputs.filter(output => output === 'done: inspect project').length, 2);
  assert.match(outputs.at(-1), /done: run tests/);
  assert.deepEqual(busy, [true, false, false, true, false]);
  controller.closeConversation();
  assert.equal(controller.conversationActive, false);
});

test('vmagent reset and YOLO remain command-controlled and session-local', async () => {
  const outputs = [];
  const approvals = [];
  const controller = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'ok' }) }),
    getLlmClient: () => ({ status: async () => ({ modelName: 'test-model' }) }),
    getGuest: () => ({}),
    approveAction: async (operation, detail) => { approvals.push([operation, detail]); return true; },
    onOutput: output => outputs.push(output),
  });
  assert.equal(controller.yolo, true);
  await controller.handle('yolo', 'off');
  assert.equal(controller.yolo, false);
  await controller.handle('yolo', 'on');
  assert.equal(controller.yolo, true);
  assert.equal(approvals[0][0], 'enable_yolo');
  await controller.handle('reset');
  assert.equal(controller.conversationActive, false);
  assert.equal(controller.yolo, true);
  assert.match(outputs.at(-1), /YOLO is on by default/);
});

test('vmagent reports an unloaded model instead of stalling at "conversation started"', async () => {
  const outputs = [];
  let created = 0;
  const controller = new VmAgentController({
    createAgent: async () => { created += 1; return { run: async () => ({ output: 'should not run' }) }; },
    getLlmClient: () => ({ status: async () => ({ modelName: '', webgpu: true, loading: false }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });
  await controller.handle('run', 'hi');
  assert.equal(created, 0, 'harness must not be created without a model');
  assert.equal(controller.conversationActive, false, 'a not-ready run must not open a conversation (keeps the poll loop alive)');
  assert.match(outputs.at(-1), /no model loaded/i);
});

test('vmagent surfaces model-not-ready states: missing WebGPU and still-loading', async () => {
  const run = async status => {
    const outputs = [];
    const controller = new VmAgentController({
      createAgent: async () => ({ run: async () => ({ output: 'x' }) }),
      getLlmClient: () => ({ status: async () => status }),
      getGuest: () => ({}),
      approveAction: async () => true,
      onOutput: output => outputs.push(output),
    });
    await controller.handle('run', 'hi');
    return outputs.at(-1);
  };
  assert.match(await run({ webgpu: false, modelName: '' }), /WebGPU is unavailable/i);
  assert.match(await run({ webgpu: true, loading: true, modelName: '' }), /still loading/i);
});

test('vmagent reports when the agent returns empty output rather than showing nothing', async () => {
  const outputs = [];
  const controller = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: '' }) }),
    getLlmClient: () => ({ status: async () => ({ modelName: 'test-model', webgpu: true }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });
  await controller.handle('run', 'hi');
  assert.match(outputs.at(-1), /returned no output/i);
});
