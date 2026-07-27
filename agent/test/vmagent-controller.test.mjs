import test from 'node:test';
import assert from 'node:assert/strict';
import { VmAgentController } from '../../network/browser/vmagent-controller.js';

test('vmlang command controller runs a persistent harness and reports in the terminal', async () => {
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

test('vmlang reset and YOLO remain command-controlled and session-local', async () => {
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

test('vmlang reports an unloaded model instead of stalling at "conversation started"', async () => {
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

test('vmlang surfaces model-not-ready states: missing WebGPU and still-loading', async () => {
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

test('vmlang reports when the agent returns empty output rather than showing nothing', async () => {
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

test('vmmastra runs as a third tier: lazy harness, reused across runs, YOLO propagated', async () => {
  const outputs = [];
  const prompts = [];
  let created = 0;
  let yoloSeen = null;
  const controller = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'deepagents' }) }),
    createMastraAgent: async options => {
      created += 1;
      return {
        run: async task => { prompts.push(task); return `mastra: ${task}`; },
        setYolo(value) { yoloSeen = value; },
      };
    },
    getLlmClient: () => ({ status: async () => ({ modelName: 'test-model' }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });

  // Not constructed until first use — the bundle must stay unimported.
  assert.equal(created, 0);

  await controller.handle('mastra', 'inspect the project');
  assert.equal(created, 1);
  assert.deepEqual(prompts, ['inspect the project']);
  assert.equal(outputs.at(-1), 'mastra: inspect the project');

  await controller.handle('mastra', 'second task');
  assert.equal(created, 1, 'harness is reused, not rebuilt');

  // One YOLO setting governs every tier.
  await controller.handle('yolo', 'off');
  assert.equal(yoloSeen, false);

  // Deep Agents is untouched by any of this.
  await controller.handle('run', 'deep task');
  assert.equal(outputs.at(-1), 'deepagents');
});

test('vmmastra reports a missing model rather than failing silently, and is optional', async () => {
  const outputs = [];
  const noModel = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'x' }) }),
    createMastraAgent: async () => ({ run: async () => 'should not run' }),
    getLlmClient: () => ({ status: async () => ({ modelName: '', webgpu: true }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });
  await noModel.handle('mastra', 'hi');
  assert.match(outputs.at(-1), /no model loaded/i);

  // A build without the tier says so instead of throwing.
  const absent = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'x' }) }),
    getLlmClient: () => ({ status: async () => ({ modelName: 'm' }) }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });
  await absent.handle('mastra', 'hi');
  assert.match(outputs.at(-1), /not available in this build/i);
});

function mastraController({ model = { modelName: 'm' }, onOutput } = {}) {
  const outputs = [];
  const runs = [];
  let built = 0;
  let lastOptions = null;
  const controller = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'deepagents' }) }),
    createMastraAgent: async options => {
      built += 1;
      lastOptions = options;
      return {
        run: async (task, runOptions = {}) => { runs.push({ task, ...runOptions }); return `ran: ${task}`; },
        setYolo() {},
        listTools: async () => (options.fullTools ? ['a', 'b', 'c'] : ['a']),
        systemPromptCost: async () => ({ approxTokens: options.fullTools ? 5537 : 2621, chars: 100, toolCount: options.fullTools ? 20 : 9 }),
      };
    },
    getLlmClient: () => ({ status: async () => model }),
    getGuest: () => ({}),
    approveAction: async () => true,
    onOutput: onOutput || (o => outputs.push(o)),
  });
  return { controller, outputs, runs, built: () => built, lastOptions: () => lastOptions };
}

test('vmmastra batch asks for the one-shot path, and plain vmmastra does not', async () => {
  const { controller, runs } = mastraController();

  await controller.handle('mastra_batch', 'count the files');
  assert.deepEqual(runs.at(-1), { task: 'count the files', batchFirst: true });

  await controller.handle('mastra', 'count the files');
  assert.equal(runs.at(-1).batchFirst, false, 'plain run must stay on the tool loop');
});

test('vmmastra CLI exposes status, tools, cost, yolo, reset and stop', async () => {
  const { controller, outputs } = mastraController();

  await controller.handle('mastra_status');
  assert.match(outputs.at(-1), /idle/);
  assert.match(outputs.at(-1), /model:\s+m/);
  assert.match(outputs.at(-1), /profile: full/);
  assert.match(outputs.at(-1), /session: not built/);

  await controller.handle('mastra_tools');
  assert.match(outputs.at(-1), /3 tools active/);

  await controller.handle('mastra_cost');
  assert.match(outputs.at(-1), /~5537 tokens/);
  assert.match(outputs.at(-1), /34% of a 16k window/);

  await controller.handle('mastra_yolo', 'off');
  assert.equal(controller.yolo, false);
  assert.match(outputs.at(-1), /YOLO off/);

  await controller.handle('mastra_reset');
  assert.equal(controller.mastraHarness, null);
  assert.match(outputs.at(-1), /session reset/);

  await controller.handle('mastra_stop');
  assert.match(outputs.at(-1), /no task is running/);
});

test('vmmastra tools lean|full switches profile and rebuilds the harness', async () => {
  const { controller, outputs, built, lastOptions } = mastraController();

  await controller.handle('mastra', 'first');
  assert.equal(built(), 1);
  assert.equal(lastOptions().fullTools, true, 'defaults to the full surface');

  await controller.handle('mastra_tools', 'lean');
  assert.match(outputs.at(-1), /lean \(9 workspace tools\)/);
  assert.equal(controller.mastraHarness, null, 'profile change must discard the harness');

  await controller.handle('mastra', 'second');
  assert.equal(built(), 2, 'harness rebuilt with the new profile');
  assert.equal(lastOptions().fullTools, false);
  assert.equal((await controller.handle('mastra_cost'), outputs.at(-1)).includes('~2621 tokens'), true);

  // Asking for the profile already active must not throw the session away.
  await controller.handle('mastra_tools', 'lean');
  assert.notEqual(controller.mastraHarness, null);
});

test('vmmastra status and reset work before any model is loaded', async () => {
  // status must be able to explain WHY the tier is not ready, so it cannot
  // itself require a model.
  const { controller, outputs } = mastraController({ model: { modelName: '' } });

  await controller.handle('mastra_status');
  assert.match(outputs.at(-1), /not configured/);

  await controller.handle('mastra_reset');
  assert.match(outputs.at(-1), /session reset/);

  await controller.handle('mastra_yolo', 'off');
  assert.match(outputs.at(-1), /YOLO off/);

  // Commands that genuinely need the model still refuse clearly.
  await controller.handle('mastra', 'do a thing');
  assert.match(outputs.at(-1), /no model loaded/i);
  await controller.handle('mastra_tools');
  assert.match(outputs.at(-1), /no model loaded/i);
});

test('vmmastra code uses the directory where the guest command was invoked', async () => {
  const outputs = [];
  const workspaces = [];
  let creations = 0;
  let resets = 0;
  const guest = { setWorkspace(path) { workspaces.push(path); } };
  const controller = new VmAgentController({
    createAgent: async () => ({ run: async () => ({ output: 'unused' }) }),
    createCodeAgent: async () => {
      creations += 1;
      return {
        setYolo() {},
        async run(task) { return { content: `ran: ${task}` }; },
        async reset() { resets += 1; },
      };
    },
    getLlmClient: () => ({ chat: async () => ({}) }),
    getGuest: () => guest,
    approveAction: async () => true,
    onOutput: output => outputs.push(output),
  });

  await controller.handle('mastra_code', 'run:first task', '/root');
  assert.deepEqual(workspaces, ['/root']);
  assert.equal(creations, 1);
  assert.equal(outputs.at(-1), 'ran: first task');

  await controller.handle('mastra_code', 'run:second task', '/root/project');
  assert.deepEqual(workspaces, ['/root', '/root/project']);
  assert.equal(resets, 1, 'changing workspace must discard the old code harness');
  assert.equal(creations, 2);
});
