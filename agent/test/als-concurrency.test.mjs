// Guards the AsyncLocalStorage shim (shims/async_hooks.js), which is a
// SYNCHRONOUS stub: it does not propagate a store across `await`.
//
// The handoff flagged this as a latent hazard — "concurrent agent runs could
// leak requestContext between them, silently". Testing the actual package
// shows that is not how Mastra works: requestContext is threaded explicitly
// (input.requestContext, buildRequestContext(...)), and the single
// AsyncLocalStorage instance in @mastra/core is `spanContextStorage`, i.e.
// tracing span parentage. Nothing on the agent's data path reads it.
//
// This test pins that down. If a future @mastra/core moves anything that
// matters onto AsyncLocalStorage, two concurrent runs will start crossing
// over and this fails — which is the warning the stub actually needs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { createLiteRt } from '../src/litert-provider.js';
import { V86Filesystem, V86Sandbox } from '../src/v86-workspace.js';

function taggedGuest(tag, log) {
  return {
    async execute(command) { log.push(`${tag}:${command}`); return `__V86AGENT_EXIT__0\n${tag}`; },
    async read() { return `${tag} content`; },
    async list() { return `regular file\t${tag}.txt\t10`; },
    async write() { return 'ok'; },
    async delete() { return 'ok'; },
    async grep() { return ''; },
    async glob() { return ''; },
    async test() { return 'ok'; },
  };
}

// Each turn awaits before answering, so the store is guaranteed to be crossed
// by the other run if the stub leaks.
function scriptedClient(tag) {
  let turn = 0;
  return {
    modelName: tag,
    async chat() {
      turn += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      const content = turn === 1
        ? JSON.stringify({ tool: 'mastra_workspace_execute_command', args: { command: `echo ${tag}` } })
        : JSON.stringify({ final: `${tag} done` });
      return { choices: [{ message: { content } }] };
    },
  };
}

function buildAgent(tag, log) {
  const workspace = new Workspace({
    filesystem: new V86Filesystem({ guest: taggedGuest(tag, log) }),
    sandbox: new V86Sandbox({ guest: taggedGuest(tag, log), defaultTimeout: 5000 }),
  });
  return new Agent({
    id: `concurrent-${tag}`,
    name: `concurrent-${tag}`,
    instructions: 'test agent',
    model: createLiteRt({ client: scriptedClient(tag) })(tag),
    workspace,
  });
}

test('concurrent agent runs do not leak context across the synchronous ALS stub', async () => {
  const logA = [];
  const logB = [];
  const [resultA, resultB] = await Promise.all([
    buildAgent('AAA', logA).generate('run A'),
    buildAgent('BBB', logB).generate('run B'),
  ]);

  // Each agent's tool call must have reached its OWN guest, and only its own.
  assert.equal(logA.length, 1, 'agent A ran exactly one guest command');
  assert.equal(logB.length, 1, 'agent B ran exactly one guest command');
  assert.match(logA[0], /^AAA:/);
  assert.match(logB[0], /^BBB:/);
  assert.deepEqual(logA.filter(entry => entry.includes('BBB')), [], 'B leaked into A');
  assert.deepEqual(logB.filter(entry => entry.includes('AAA')), [], 'A leaked into B');

  assert.equal(resultA.text, 'AAA done');
  assert.equal(resultB.text, 'BBB done');
});

test('the ALS stub is synchronous-only — documented, and nothing on the agent path depends on it', async () => {
  const { AsyncLocalStorage } = await import('../shims/async_hooks.js');
  const storage = new AsyncLocalStorage();

  // Synchronous use works.
  const sync = storage.run('inner', () => storage.getStore());
  assert.equal(sync, 'inner');

  // Across an await it does NOT propagate. This is the stub's known limit;
  // asserting it means the behaviour can never change silently.
  let afterAwait;
  await storage.run('inner', async () => {
    await Promise.resolve();
    afterAwait = storage.getStore();
  });
  assert.equal(afterAwait, undefined, 'stub unexpectedly propagates across await — re-check the concurrency test above');
});
