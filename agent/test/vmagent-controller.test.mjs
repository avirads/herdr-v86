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
  await controller.handle('run', 'run tests');
  assert.equal(creations, 1);
  assert.deepEqual(prompts, ['inspect project', 'run tests']);
  assert.match(outputs.at(-1), /done: run tests/);
  assert.deepEqual(busy, [true, false, true, false]);
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
  assert.equal(controller.yolo, true);
  assert.match(outputs.at(-1), /YOLO is on by default/);
});
