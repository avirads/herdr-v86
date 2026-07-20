import test from 'node:test';
import assert from 'node:assert/strict';
import { createHerdrAgent, WebGpuToolChatModel } from '../src/agent.js';

test('WebGPU model advertises the LiteRT context budget for summarization', () => {
  const model = new WebGpuToolChatModel({ chat: async () => ({}) });
  assert.equal(model.profile.maxInputTokens, 16384);
  assert.equal(model.profile.maxOutputTokens, 1400);
});

test('Deep Agents invokes the native guest backend and returns evidence', async () => {
  let calls = 0;
  let firstRequest;
  const activities = [];
  const llmClient = {
    async chat(body) {
      calls += 1;
      if (calls === 1) firstRequest = body;
      const content = calls === 1
        ? JSON.stringify({ tool: 'ls', args: { path: '/' } })
        : JSON.stringify({ final: 'The workspace contains src/main.js.' });
      return { choices: [{ message: { content } }] };
    },
  };
  const guestCalls = [];
  const guest = {
    async list(path) { guestCalls.push(['list', path]); return 'regular file\tsrc/main.js\t20'; },
    async read(path) { guestCalls.push(['read', path]); return 'const value = 1;'; },
    async grep(pattern, path) { guestCalls.push(['grep', pattern, path]); return ''; },
    async glob(pattern, path) { guestCalls.push(['glob', pattern, path]); return ''; },
    async write(path, content) { guestCalls.push(['write', path, content]); return 'ok'; },
    async delete(path) { guestCalls.push(['delete', path]); return 'ok'; },
    async execute(command) { guestCalls.push(['execute', command]); return '__V86AGENT_EXIT__0\nok'; },
    async test(recipe) { guestCalls.push(['test', recipe]); return 'ok'; },
  };
  const harness = createHerdrAgent({ llmClient, guest, browserClient: { command: async () => ({ ok: true }) }, onActivity: event => activities.push(event) });
  const result = await harness.run('List the project.');
  assert.deepEqual(guestCalls, [['list', 'skills/'], ['read', 'AGENTS.md'], ['list', '.']]);
  assert.match(result.output, /src\/main\.js/);
  const protocol = firstRequest.messages[0].content;
  for (const name of ['write_todos', 'ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'execute', 'task', 'vmfetch', 'vmgithub', 'vmclip', 'vmexport', 'vmai', 'vmllm_info', 'browser_search', 'autobro_automate', 'autobro_command']) {
    assert.match(protocol, new RegExp(`"name":"${name}"`));
  }
});

test('guest backend gates writes, edits, deletes, and execution', async () => {
  const { V86DeepAgentsBackend } = await import('../src/guest-backend.js');
  let content = 'old value\n';
  const approvals = [];
  const guest = {
    async read() { return content; },
    async write(_path, value) { content = value; },
    async delete() {},
    async execute() { return '__V86AGENT_EXIT__7\nfailed check'; },
  };
  const backend = new V86DeepAgentsBackend(guest, { approve: async (operation, detail) => { approvals.push([operation, detail]); return true; } });
  assert.equal((await backend.write('/new.txt', 'created')).path, '/new.txt');
  content = 'old value\n';
  assert.equal((await backend.edit('/main.txt', 'old', 'new')).occurrences, 1);
  assert.equal(content, 'new value\n');
  assert.equal((await backend.delete('/old.txt')).path, '/old.txt');
  assert.deepEqual(await backend.execute('make test'), { output: 'failed check', exitCode: 7, truncated: false });
  assert.deepEqual(approvals.map(item => item[0]), ['write_file', 'edit_file', 'delete_file', 'execute']);
});

test('guest backend rejects mutations when approval is denied', async () => {
  const { V86DeepAgentsBackend } = await import('../src/guest-backend.js');
  const backend = new V86DeepAgentsBackend({}, { approve: async () => false });
  assert.match((await backend.write('/no.txt', 'no')).error, /rejected/);
  assert.equal((await backend.execute('rm -rf .')).exitCode, 126);
});

function scriptedClient(decisions) {
  let index = 0;
  return { async chat() { return { choices: [{ message: { content: JSON.stringify(decisions[index++]) } }] }; } };
}

function fallbackGuest(execute) {
  return {
    async list(path) { return path === 'skills/' ? '' : 'directory\t.\t0'; },
    async read() { return ''; },
    async grep() { return ''; },
    async glob() { return ''; },
    async write() { return 'ok'; },
    async delete() { return 'ok'; },
    execute,
    async test() { return 'ok'; },
  };
}

test('vmfetch automatically switches interactive sites to AutoBro', async () => {
  const browserCalls = [];
  const browserClient = { async command(command, parameters) {
    browserCalls.push([command, parameters]);
    if (command === 'newTab') return { tabId: 9, url: parameters.url };
    if (command === 'pageInfo') return { tabId: 9, title: 'Google' };
    return { ok: true };
  } };
  const guest = fallbackGuest(async () => { throw new Error('vmfetch must not run for an interactive site'); });
  const harness = createHerdrAgent({
    llmClient: scriptedClient([
      { tool: 'vmfetch', args: { url: 'https://www.google.com/search?q=test', output: '-', method: 'GET', headers: [] } },
      { final: 'Switched to the browser.' },
    ]),
    guest,
    browserClient,
    approveAction: async () => true,
  });
  const result = await harness.run('Open Google search.');
  assert.match(result.output, /Switched to the browser/);
  assert.deepEqual(browserCalls.map(call => call[0]), ['newTab', 'waitForLoad', 'pageInfo']);
});

test('failed AutoBro navigation automatically switches to vmfetch', async () => {
  const approvals = [];
  const guestCommands = [];
  const guest = fallbackGuest(async command => {
    guestCommands.push(command);
    return '__V86AGENT_EXIT__0\nraw page';
  });
  const harness = createHerdrAgent({
    llmClient: scriptedClient([
      { tool: 'autobro_command', args: { command: 'gotoUrl', parameters: { url: 'https://example.com/data' } } },
      { final: 'Fetched raw content.' },
    ]),
    guest,
    browserClient: { async command() { throw new Error('extension unavailable'); } },
    approveAction: async (operation, detail) => { approvals.push([operation, detail]); return true; },
  });
  const result = await harness.run('Open the resource.');
  assert.match(result.output, /Fetched raw content/);
  assert.match(guestCommands.at(-1), /^vmfetch -o - 'https:\/\/example\.com\/data'$/);
  assert.equal(approvals.at(-1)[1].fallback, 'vmfetch raw GET if AutoBro navigation fails');
});

test('AutoBro automation uses the page-local WebGPU LLM to plan exact commands', async () => {
  const browserCalls = [];
  const browserClient = { async command(command, parameters) {
    browserCalls.push([command, parameters]);
    if (command === 'inventoryCurrentPage') return { url: 'https://example.com', controls: [{ name: 'query', label: 'Search' }] };
    if (command === 'relatedActions') return [];
    if (command === 'skills') return [];
    if (command === 'fillInput') return { changed: true };
    return {};
  } };
  const harness = createHerdrAgent({
    llmClient: scriptedClient([
      { tool: 'autobro_automate', args: { instruction: 'Type test in the Search field' } },
      { steps: [{ command: 'fillInput', args: ['[name="query"]', 'test'] }] },
      { final: 'Entered test in the Search field.' },
    ]),
    guest: fallbackGuest(async () => '__V86AGENT_EXIT__0\nok'),
    browserClient,
    approveAction: async () => true,
  });
  const result = await harness.run('Type test in the Search field.');
  assert.match(result.output, /Entered test/);
  assert.deepEqual(browserCalls.map(call => call[0]), ['inventoryCurrentPage', 'relatedActions', 'skills', 'fillInput']);
  assert.deepEqual(browserCalls.at(-1)[1], { args: ['[name="query"]', 'test'] });
});
