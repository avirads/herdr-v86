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
  const harness = createHerdrAgent({ llmClient, guest, onActivity: event => activities.push(event) });
  const result = await harness.run('List the project.');
  assert.deepEqual(guestCalls, [['list', 'skills/'], ['read', 'AGENTS.md'], ['list', '.']]);
  assert.match(result.output, /src\/main\.js/);
  const protocol = firstRequest.messages[0].content;
  for (const name of ['write_todos', 'ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep', 'execute', 'task', 'vmfetch', 'vmgithub', 'vmclip', 'vmexport', 'vmai', 'vmllm_info']) {
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
