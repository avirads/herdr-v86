// The vm*/AutoBro tools must behave identically to the Deep Agents tier —
// same guest command strings, same approval contract, same fallbacks. These
// assert on the command actually sent to the guest, not on tool return text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVmTools, shellQuote, commandResult, coerceStringBody } from '../src/vm-tools.js';
import { createMastraVMAgent } from '../src/mastra-browser.js';

function stubGuest(log = []) {
  return {
    log,
    async execute(command) { log.push(command); return '__V86AGENT_EXIT__0\nok'; },
    async read() { return ''; }, async list() { return ''; },
    async write() { return 'ok'; }, async delete() { return 'ok'; },
    async grep() { return ''; }, async glob() { return ''; }, async test() { return 'ok'; },
  };
}
const alwaysYolo = { isYolo: () => true };
const run = (tool, args) => tool.execute(args, {});

test('helpers match the Deep Agents implementations', () => {
  assert.equal(shellQuote(`it's`), `'it'"'"'s'`);
  assert.equal(commandResult('__V86AGENT_EXIT__0\nhello'), 'hello');
  assert.throws(() => commandResult('__V86AGENT_EXIT__7\nboom'), /exited 7/);
  assert.equal(coerceStringBody({}), undefined, 'empty object means no body');
  assert.equal(coerceStringBody({ a: 1 }), '{"a":1}');
  assert.equal(coerceStringBody('raw'), 'raw');
});

test('vm* tools are registered, and AutoBro tools only when a browser client is present', () => {
  const withoutBrowser = createVmTools({ guest: stubGuest(), ...alwaysYolo });
  assert.deepEqual(Object.keys(withoutBrowser),
    ['vmfetch', 'vmgithub', 'vmclip', 'vmexport', 'vmai', 'vmllm_info']);

  const withBrowser = createVmTools({
    guest: stubGuest(),
    browserClient: { async command() { return {}; } },
    llmClient: { async chat() { return {}; } },
    ...alwaysYolo,
  });
  assert.deepEqual(Object.keys(withBrowser), [
    'vmfetch', 'vmgithub', 'vmclip', 'vmexport', 'vmai', 'vmllm_info',
    'browser_search', 'autobro_command', 'autobro_automate',
  ]);
});

test('vmfetch builds the same command string as the Deep Agents tier', async () => {
  const guest = stubGuest();
  const tools = createVmTools({ guest, ...alwaysYolo });
  await run(tools.vmfetch, { url: 'https://example.com/a', output: '-', method: 'GET', headers: [] });
  assert.equal(guest.log.at(-1), `vmfetch -o '-' -X 'GET' 'https://example.com/a'`);

  await run(tools.vmfetch, {
    url: 'https://example.com/p', output: 'out.json', method: 'POST',
    headers: ['X-A: 1'], data: { k: 'v' },
  });
  assert.equal(guest.log.at(-1),
    `vmfetch -o 'out.json' -X 'POST' -H 'X-A: 1' -d '{"k":"v"}' 'https://example.com/p'`);
});

test('vmfetch sends interactive search sites to AutoBro instead of fetching them', async () => {
  const guest = stubGuest();
  const calls = [];
  const tools = createVmTools({
    guest,
    browserClient: { async command(name, params) { calls.push(name); return { tabId: 1, url: params?.url, title: 'G' }; } },
    ...alwaysYolo,
  });
  const result = await run(tools.vmfetch, { url: 'https://www.google.com/search?q=x', output: '-', method: 'GET', headers: [] });
  assert.match(result, /switchedProvider":"autobro/);
  assert.deepEqual(guest.log, [], 'must not shell out for an interactive site');
  assert.deepEqual(calls, ['newTab', 'waitForLoad', 'pageInfo']);
});

test('approval is enforced when YOLO is off, and bypassed when on', async () => {
  const guest = stubGuest();
  const asked = [];
  const denying = createVmTools({
    guest,
    approveAction: async (name, detail) => { asked.push([name, detail]); return false; },
    isYolo: () => false,
  });
  const rejected = await run(denying.vmexport, { path: 'a.txt' });
  assert.equal(rejected, 'Operation rejected by user.');
  assert.deepEqual(guest.log, [], 'denied tool must not touch the guest');
  assert.equal(asked[0][0], 'vmexport');

  const yolo = createVmTools({ guest, approveAction: async () => false, isYolo: () => true });
  await run(yolo.vmexport, { path: 'a.txt' });
  assert.equal(guest.log.at(-1), `vmexport 'a.txt'`);
});

test('vmgithub, vmclip, vmai and vmllm_info issue the expected guest commands', async () => {
  const guest = stubGuest();
  const tools = createVmTools({ guest, ...alwaysYolo });

  await run(tools.vmgithub, { action: 'repo', repository: 'a/b', path: '', ref: 'HEAD', output: 'source.tar.gz' });
  assert.equal(guest.log.at(-1), `vmgithub repo 'a/b'`);
  await run(tools.vmgithub, { action: 'archive', repository: 'a/b', path: '', ref: 'main', output: 'o.tgz' });
  assert.equal(guest.log.at(-1), `vmgithub archive 'a/b' 'main' 'o.tgz'`);

  await run(tools.vmclip, { action: 'read' });
  assert.equal(guest.log.at(-1), 'vmclip read');
  await run(tools.vmclip, { action: 'write', text: 'hi' });
  assert.equal(guest.log.at(-1), `printf %s 'hi' | vmclip write`);

  await run(tools.vmai, { prompt: 'p', model: 'm' });
  assert.equal(guest.log.at(-1), `OPENAI_MODEL='m' vmai 'p'`);

  await run(tools.vmllm_info, { operation: 'status' });
  assert.equal(guest.log.at(-1), 'vmllm status');
});

test('autobro_command falls back to vmfetch when navigation fails', async () => {
  const guest = stubGuest();
  const tools = createVmTools({
    guest,
    browserClient: { async command() { throw new Error('extension unavailable'); } },
    ...alwaysYolo,
  });
  const result = await run(tools.autobro_command, { command: 'gotoUrl', parameters: { url: 'https://example.com/d' } });
  assert.match(result, /switchedProvider":"vmfetch/);
  assert.equal(guest.log.at(-1), `vmfetch -o - 'https://example.com/d'`);
});

test('autobro_automate derives an instruction from autobro_command-shaped args', async () => {
  const seen = [];
  const tools = createVmTools({
    guest: stubGuest(),
    browserClient: {
      async command(name, params) {
        seen.push(name);
        if (name === 'inventoryCurrentPage') return { url: 'https://example.com', controls: [] };
        if (name === 'relatedActions' || name === 'skills') return [];
        if (name === 'pageInfo') return { url: 'https://example.com', title: 'Example' };
        return { ok: true };
      },
    },
    llmClient: {
      async chat({ messages }) {
        // The derived instruction must reach the planner.
        assert.match(messages.at(-1).content, /gotoUrl https:\/\/example\.com/);
        return { choices: [{ message: { content: '{"steps":[{"command":"gotoUrl","args":["https://example.com"]}]}' } }] };
      },
    },
    ...alwaysYolo,
  });
  const result = await run(tools.autobro_automate, { command: 'gotoUrl', parameters: { url: 'https://example.com' } });
  assert.match(result, /AUTOBRO_EXECUTION_COMPLETE/);
  assert.ok(seen.includes('gotoUrl'), 'planned step must actually execute');
});

test('a browser task runs at most once per turn, and resetTurn clears the guard', async () => {
  let navigations = 0;
  const tools = createVmTools({
    guest: stubGuest(),
    browserClient: {
      async command(name, params) {
        if (name === 'newTab') { navigations += 1; return { tabId: 1, url: params.url }; }
        return { tabId: 1, title: 'T' };
      },
    },
    ...alwaysYolo,
  });
  await run(tools.browser_search, { query: 'a', engine: 'google' });
  const second = await run(tools.browser_search, { query: 'b', engine: 'google' });
  assert.equal(navigations, 1, 'second search must reuse the completed result');
  assert.match(second, /AUTOBRO_EXECUTION_COMPLETE/);

  tools.resetTurn();
  await run(tools.browser_search, { query: 'c', engine: 'google' });
  assert.equal(navigations, 2, 'resetTurn allows the next turn to browse again');
});

test('parity tools are opt-in, and the prompt cost of enabling them is measurable', async () => {
  const guest = stubGuest();
  const llmClient = { modelName: 'p', async chat() { return { choices: [{ message: { content: '{"final":"x"}' } }] }; } };
  const browserClient = { async command() { return { ok: true }; } };

  const base = createMastraVMAgent({ guest, llmClient });
  assert.equal((await base.listTools()).length, 9, 'default stays lean for a 16k window');
  assert.ok((await base.listTools()).includes('glob'), 'glob is a default, not a parity extra');

  const full = createMastraVMAgent({
    guest, llmClient, browserClient, enableVmTools: true, enablePlanning: true,
  });
  const names = await full.listTools();
  for (const expected of ['vmfetch', 'vmgithub', 'vmclip', 'vmexport', 'vmai', 'vmllm_info',
    'browser_search', 'autobro_command', 'autobro_automate', 'taskWrite', 'taskUpdate']) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
  assert.equal(names.length, 20, 'full parity surface (Deep Agents exposes 18)');

  const baseCost = await base.systemPromptCost();
  const fullCost = await full.systemPromptCost();
  assert.ok(fullCost.approxTokens > baseCost.approxTokens);
  // Guard the budget: full parity measured ~5.7k tokens (~35% of 16k). If a
  // change pushes it past half the window, that is a deliberate decision.
  assert.ok(fullCost.approxTokens < 8192,
    `full-parity prompt is ${fullCost.approxTokens} tokens — over half a 16k window`);
});
