import test from 'node:test';
import assert from 'node:assert/strict';
import { createVMAgent, WebGpuToolChatModel } from '../src/agent.js';

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
  const harness = createVMAgent({ llmClient, guest, browserClient: { command: async () => ({ ok: true }) }, onActivity: event => activities.push(event) });
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
  const harness = createVMAgent({
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
  const harness = createVMAgent({
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
  const harness = createVMAgent({
    llmClient: scriptedClient([
      { tool: 'autobro_automate', args: { instruction: 'Type test in the Search field' } },
      { steps: [
        { command: 'fillInput', args: ['[name="query"]', 'test'] },
        { command: 'fillInput', args: ['[name="query"]', 'test'] },
      ] },
      { final: 'Entered test in the Search field.' },
    ]),
    guest: fallbackGuest(async () => '__V86AGENT_EXIT__0\nok'),
    browserClient,
    approveAction: async () => true,
  });
  const result = await harness.run('Type test in the Search field.');
  assert.match(result.output, /AutoBro task completed/);
  assert.match(result.output, /fillInput: \{"changed":true\}/);
  assert.deepEqual(browserCalls.map(call => call[0]), ['inventoryCurrentPage', 'relatedActions', 'skills', 'fillInput', 'pageInfo']);
  assert.deepEqual(browserCalls.at(-2)[1], { args: ['[name="query"]', 'test'] });
});

test('duplicate AutoBro automation calls return the first execution result without rerunning', async () => {
  const executed = [];
  const browserClient = { async command(command) {
    if (command === 'inventoryCurrentPage') return { url: 'https://example.com' };
    if (command === 'relatedActions' || command === 'skills') return [];
    if (command === 'pressKey') executed.push(command);
    if (command === 'pageInfo') return { url: 'https://example.com/results' };
    return {};
  } };
  const instruction = 'Submit the search form';
  const harness = createVMAgent({
    llmClient: scriptedClient([
      { tool: 'autobro_automate', args: { instruction } },
      { steps: [{ command: 'pressKey', args: ['ENTER'] }] },
      { tool: 'autobro_automate', args: { instruction: 'Press Enter to submit this form now' } },
      { final: 'The form was submitted and the browser reached the results page.' },
    ]),
    guest: fallbackGuest(async () => '__V86AGENT_EXIT__0\nok'),
    browserClient,
    approveAction: async () => true,
  });
  const result = await harness.run(instruction);
  assert.match(result.output, /AutoBro task completed/);
  assert.match(result.output, /example\.com\/results/);
  assert.doesNotMatch(result.output, /The form was submitted/);
  assert.deepEqual(executed, ['pressKey']);
});

test('vmfetch coerces an empty object body to no body instead of rejecting the tool call', async () => {
  const guestCommands = [];
  const guest = fallbackGuest(async command => { guestCommands.push(command); return '__V86AGENT_EXIT__0\nok'; });
  const harness = createVMAgent({
    llmClient: scriptedClient([
      { tool: 'vmfetch', args: { url: 'https://example.com/api', output: '-', method: 'POST', headers: [], data: {} } },
      { final: 'Request sent.' },
    ]),
    guest,
    browserClient: { async command() { return {}; } },
    approveAction: async () => true,
  });
  const result = await harness.run('Ping the API with no body.');
  assert.match(result.output, /Request sent/);
  assert.doesNotMatch(guestCommands.at(-1), /-d /);
});

test('vmfetch serializes a non-empty object body instead of rejecting the tool call', async () => {
  const guestCommands = [];
  const guest = fallbackGuest(async command => { guestCommands.push(command); return '__V86AGENT_EXIT__0\nok'; });
  const harness = createVMAgent({
    llmClient: scriptedClient([
      { tool: 'vmfetch', args: { url: 'https://example.com/api', output: '-', method: 'POST', headers: [], data: { foo: 'bar' } } },
      { final: 'Request sent.' },
    ]),
    guest,
    browserClient: { async command() { return {}; } },
    approveAction: async () => true,
  });
  const result = await harness.run('Post {foo: bar} to the API.');
  assert.match(result.output, /Request sent/);
  assert.match(guestCommands.at(-1), /-d '\{"foo":"bar"\}'/);
});

test('autobro_automate derives an instruction when the model uses autobro_command\'s {command, parameters} shape', async () => {
  const browserCalls = [];
  const browserClient = { async command(command, parameters) {
    browserCalls.push([command, parameters]);
    if (command === 'inventoryCurrentPage') return { url: 'https://example.com', controls: [] };
    if (command === 'relatedActions') return [];
    if (command === 'skills') return [];
    if (command === 'gotoUrl') return { ok: true };
    if (command === 'pageInfo') return { url: 'https://example.com', title: 'Example' };
    return {};
  } };
  const harness = createVMAgent({
    llmClient: scriptedClient([
      { tool: 'autobro_automate', args: { command: 'gotoUrl', parameters: { url: 'https://example.com' } } },
      { steps: [{ command: 'gotoUrl', args: ['https://example.com'] }] },
      { final: 'Navigated to example.com.' },
    ]),
    guest: fallbackGuest(async () => '__V86AGENT_EXIT__0\nok'),
    browserClient,
    approveAction: async () => true,
  });
  const result = await harness.run('open new browser tab to example.com');
  assert.match(result.output, /AutoBro task completed/);
  assert.match(result.output, /Task: gotoUrl https:\/\/example\.com/);
  assert.match(result.output, /gotoUrl: \{"ok":true\}/);
  assert.deepEqual(browserCalls.map(call => call[0]), ['inventoryCurrentPage', 'relatedActions', 'skills', 'gotoUrl', 'pageInfo']);
});

// --- decision parsing ------------------------------------------------------
//
// The model answers in its own trained tool-call syntax no matter which of the
// three protocols it was handed, so every tier has to read that syntax. These
// pin the vmlang tier's half of it.

const human = text => ({ _getType: () => 'human', content: text });

/** Drive one _generate turn with a canned completion. */
async function decide(completion) {
  const model = new WebGpuToolChatModel({ chat: async () => completion });
  const { generations } = await model._generate([human('build greet.js')]);
  return generations[0].message;
}

const textCompletion = content => ({ choices: [{ message: { role: 'assistant', content } }] });

test('the vmlang protocol shape still decides a tool call', async () => {
  const message = await decide(textCompletion('{"tool":"write_file","args":{"path":"greet.js"}}'));
  assert.equal(message.tool_calls?.[0]?.name, 'write_file');
  assert.deepEqual(message.tool_calls[0].args, { path: 'greet.js' });
});

test('a client-recovered tool call is used, not stringified', async () => {
  // LiteRtLmClient sets content:null once it recovers a call from the model's
  // native syntax. Reading content and falling back to the completion object
  // turned that into the literal text "[object Object]" and spent the turn.
  const message = await decide({
    choices: [{
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'write_file', arguments: '{"path":"greet.js","content":"x"}' } }],
      },
    }],
  });
  assert.equal(message.tool_calls?.[0]?.name, 'write_file');
  assert.deepEqual(message.tool_calls[0].args, { path: 'greet.js', content: 'x' });
  assert.notEqual(String(message.content), '[object Object]');
});

test('gemma native call syntax decides a tool call on this tier too', async () => {
  const message = await decide(textCompletion(
    '<|tool_call>call:write_file{path: "/root/project/greet.js", content: "hello"}<tool_call|>',
  ));
  assert.equal(message.tool_calls?.[0]?.name, 'write_file');
  assert.equal(message.tool_calls[0].args.path, '/root/project/greet.js');
});

test('the other tiers\' protocol shape is honoured rather than lost', async () => {
  const message = await decide(textCompletion('{"tool_call":{"name":"read_file","arguments":{"path":"a.js"}}}'));
  assert.equal(message.tool_calls?.[0]?.name, 'read_file');
  assert.deepEqual(message.tool_calls[0].args, { path: 'a.js' });
});

test('a final answer and plain prose both stay text', async () => {
  const final = await decide(textCompletion('{"final":"all done"}'));
  assert.equal(final.tool_calls?.length ?? 0, 0);
  assert.equal(String(final.content), 'all done');

  const prose = await decide(textCompletion('I have finished the task.'));
  assert.equal(prose.tool_calls?.length ?? 0, 0);
  assert.equal(String(prose.content), 'I have finished the task.');
});

// --- Deep Agents path mapping ----------------------------------------------

test('the virtual root and the real workspace name the same directory', async () => {
  // The model writes /root/project/greet.js because that is the path every
  // prompt quotes at it. Uncollapsed, that nested to
  // /root/project/root/project/greet.js — the agent could not then see its own
  // file, ran `mkdir -p /root/project`, wrote it again, and looped until
  // LangGraph's recursion limit. Ten identical cycles, each step reasonable.
  const writes = [];
  const guest = {
    workspace: '/root/project',
    write: async path => { writes.push(path); return 'ok'; },
    read: async () => 'x',
    list: async () => '',
  };
  const { V86DeepAgentsBackend } = await import('../src/guest-backend.js');
  const backend = new V86DeepAgentsBackend(guest, { approve: async () => true });

  await backend.write('/root/project/greet.js', 'x');
  await backend.write('/greet.js', 'x');
  await backend.write('/root/project/context_handoff/envelope.json', 'x');
  assert.deepEqual(writes, ['greet.js', 'greet.js', 'context_handoff/envelope.json']);
});

test('collapsing the workspace prefix does not weaken the path guards', async () => {
  const guest = { workspace: '/root/project', write: async () => 'ok', read: async () => 'x' };
  const { V86DeepAgentsBackend } = await import('../src/guest-backend.js');
  const backend = new V86DeepAgentsBackend(guest, { approve: async () => true });

  assert.match((await backend.write('/root/project/../escape.js', 'x')).error, /cannot contain \.\./);
  assert.match((await backend.write('relative.js', 'x')).error, /must be absolute/);
});

test('a sibling sharing the workspace name as a prefix is not collapsed', async () => {
  const writes = [];
  const guest = { workspace: '/root/project', write: async path => { writes.push(path); return 'ok'; } };
  const { V86DeepAgentsBackend } = await import('../src/guest-backend.js');
  const backend = new V86DeepAgentsBackend(guest, { approve: async () => true });

  // /root/projectile is a different directory, so the prefix must not match.
  await backend.write('/root/projectile/x.js', 'x');
  assert.deepEqual(writes, ['root/projectile/x.js']);
});
