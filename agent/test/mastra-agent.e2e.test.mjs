// Step 1 + step 2 together: a real `@mastra/core` Agent, using the LiteRT
// LanguageModelV2 provider as its model and the v86 providers as its
// workspace. Nothing here is stubbed except the guest bridge and the model's
// HTTP-shaped `chat()` reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent, isSupportedLanguageModel, supportedLanguageModelSpecifications } from '@mastra/core/agent';
import { Workspace, WORKSPACE_TOOLS, createWorkspaceTools } from '@mastra/core/workspace';
import { createLiteRt } from '../src/litert-provider.js';
import { createV86Workspace } from '../src/v86-workspace.js';

// --- fakes ----------------------------------------------------------------

function fakeGuest(initial = {}) {
  const files = new Map(Object.entries(initial));
  const log = [];
  const exit = (code, out = '') => `__V86AGENT_EXIT__${code}\n${out}`;
  const unquote = s => s.replace(/^'(.*)'$/s, '$1').replace(/'"'"'/g, "'");
  return {
    files,
    log,
    async list() {
      return [...files].map(([p, c]) => `file\t${p}\t${c.length}`).join('\n');
    },
    async glob() {
      return this.list();
    },
    async read(rel) {
      if (!files.has(rel)) throw new Error(`not found: ${rel}`);
      return files.get(rel);
    },
    async write(rel, content) {
      files.set(rel, content);
    },
    async delete(rel) {
      files.delete(rel);
    },
    async grep() {
      return '';
    },
    async execute(command) {
      log.push(command);
      const inner = command.match(/\{ ([\s\S]*?); \} 2>/)?.[1] ?? command;
      let m;
      if ((m = inner.match(/^\[ -e (.+) \]$/))) return exit(files.has(unquote(m[1])) ? 0 : 1);
      if ((m = inner.match(/^stat -c .* -- (.+)$/))) {
        const p = unquote(m[1]);
        return files.has(p)
          ? exit(0, `regular file|${files.get(p).length}|1700000000\n`)
          : exit(1, 'no such file\n');
      }
      return exit(0, `ok: ${inner}\n`);
    },
  };
}

/** Returns each scripted reply in turn; records the bodies it was sent. */
function scriptedClient(replies) {
  const queue = [...replies];
  const calls = [];
  return {
    calls,
    async chat(body) {
      calls.push(body);
      return {
        choices: [
          { index: 0, message: { role: 'assistant', content: queue.shift() ?? '{"final":"done"}' }, finish_reason: 'stop' },
        ],
      };
    },
  };
}

function buildAgent({ replies, guest, tools, instructions = 'You operate a browser VM.' }) {
  const client = scriptedClient(replies);
  const workspace = new Workspace({ ...createV86Workspace({ guest }), ...(tools ? { tools } : {}) });
  const agent = new Agent({
    id: 'vm-agent',
    name: 'vm-agent',
    instructions,
    model: createLiteRt({ client })('gemma-4-e2b'),
    workspace,
  });
  return { agent, client, workspace };
}

// --- the questions that actually block step 3 ------------------------------

test('Mastra accepts a spec-v2 model natively (not via compat mode)', () => {
  assert.deepEqual(supportedLanguageModelSpecifications, ['v2', 'v3', 'v4']);
  const model = createLiteRt({ client: scriptedClient([]) })('gemma-4-e2b');
  assert.equal(isSupportedLanguageModel(model), true);
});

test('an Agent constructs with our model and our workspace', () => {
  const { agent } = buildAgent({ replies: [], guest: fakeGuest() });
  assert.equal(agent.id, 'vm-agent');
});

test('end to end: agent reads a guest file through the workspace tools', async () => {
  const guest = fakeGuest({ 'README.md': 'hello from the guest\n' });
  const { agent, client } = buildAgent({
    guest,
    replies: [
      '{"tool_call":{"name":"mastra_workspace_read_file","arguments":{"path":"/README.md"}}}',
      '{"final":"The file says: hello from the guest"}',
    ],
  });

  const result = await agent.generate('What does README.md say?');
  const text = result.text ?? result?.response?.text ?? '';

  assert.match(text, /hello from the guest/);
  assert.ok(client.calls.length >= 2, 'expected a tool turn and a final turn');

  // the tool result must be visible in the second prompt
  const secondTurn = JSON.stringify(client.calls[1].messages);
  assert.match(secondTurn, /hello from the guest/);
});

test('end to end: agent runs a command in the sandbox', async () => {
  const guest = fakeGuest();
  const { agent } = buildAgent({
    guest,
    replies: [
      '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"uname -m"}}}',
      '{"final":"ran it"}',
    ],
  });

  await agent.generate('check the architecture');
  assert.ok(guest.log.some(c => c.includes('uname -m')), `guest never saw the command: ${guest.log}`);
});

// --- the constraint that decides whether this is viable on-device ----------

test('MEASURE: system prompt size with the full workspace toolset', async () => {
  const guest = fakeGuest({ 'README.md': 'x' });
  const { agent, client } = buildAgent({ guest, replies: ['{"final":"ok"}'] });
  await agent.generate('hi');

  const system = client.calls[0].messages.find(m => m.role === 'system')?.content ?? '';
  const approxTokens = Math.ceil(system.length / 4);
  console.log(`    system prompt: ${system.length} chars ~= ${approxTokens} tokens`);
  console.log(`    share of a 16384-token window: ${((approxTokens / 16384) * 100).toFixed(1)}%`);

  // Not a pass/fail threshold, just a guard against silent explosion.
  assert.ok(system.length > 0);
});

test('MEASURE: prompt size with the toolset trimmed to essentials', async () => {
  const guest = fakeGuest({ 'README.md': 'x' });
  const { agent, client } = buildAgent({
    guest,
    replies: ['{"final":"ok"}'],
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: { enabled: false },
      [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: false },
    },
  });
  await agent.generate('hi');
  const system = client.calls[0].messages.find(m => m.role === 'system')?.content ?? '';
  console.log(`    trimmed system prompt: ${system.length} chars ~= ${Math.ceil(system.length / 4)} tokens`);
  assert.ok(system.length > 0);
});

// --- approval config replaces the hand-rolled gate -------------------------

test('requireApproval is declarative and reaches the generated tool', async () => {
  const guest = fakeGuest();
  const workspace = new Workspace({
    ...createV86Workspace({ guest }),
    tools: {
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval: true },
      [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { requireApproval: false },
    },
  });
  await workspace.init();
  const tools = await createWorkspaceTools(workspace);

  const execute = tools.mastra_workspace_execute_command;
  const read = tools.mastra_workspace_read_file;
  assert.ok(execute, 'execute_command tool missing');
  assert.ok(read, 'read_file tool missing');

  // The flag is carried on the tool definition rather than hand-checked in the
  // provider — this is what replaces V86DeepAgentsBackend.permitted().
  const flag = t => t.requireApproval ?? t.options?.requireApproval ?? t.config?.requireApproval;
  console.log('    execute_command requireApproval =', flag(execute));
  console.log('    read_file       requireApproval =', flag(read));
  assert.notEqual(flag(execute), flag(read));
});

test('tool name remapping shortens what the model must read', async () => {
  const guest = fakeGuest();
  const workspace = new Workspace({
    ...createV86Workspace({ guest }),
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { name: 'view' },
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { name: 'sh' },
    },
  });
  await workspace.init();
  const names = Object.keys(await createWorkspaceTools(workspace));
  assert.ok(names.includes('view'), names.join(', '));
  assert.ok(names.includes('sh'), names.join(', '));
});
