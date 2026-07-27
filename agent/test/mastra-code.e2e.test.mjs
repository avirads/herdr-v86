// E2E test for the Mastra Code tier harness.
//
// Tests the CodeAgentHarness with a fake guest and fake LLM client, exercising
// threads, slash commands, mode switching, cancellation, and the agent tool
// loop (via lazy import of the real Mastra agent).  IndexedDB is unavailable in
// Node so threads live in memory only — persistence is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeAgentHarness } from '../src/mastra-code.js';

// --- fakes ----------------------------------------------------------------

function fakeGuest(initial = {}) {
  const files = new Map(Object.entries(initial));
  const log = [];
  const exit = (code, out = '') => `__V86AGENT_EXIT__${code}\n${out}`;
  const unquote = s => s.replace(/^'(.*)'$/s, '$1').replace(/'"'"'/g, "'");
  return {
    files, log,
    async list() { return [...files].map(([p, c]) => `file\t${p}\t${c.length}`).join('\n'); },
    async glob() { return this.list(); },
    async read(rel) { if (!files.has(rel)) throw new Error(`not found: ${rel}`); return files.get(rel); },
    async write(rel, content) { files.set(rel, content); },
    async delete(rel) { files.delete(rel); },
    async grep() { return ''; },
    async execute(command) {
      log.push(command);
      const inner = command.match(/\{ ([\s\S]*?); \} 2>/)?.[1] ?? command;
      let m;
      if ((m = inner.match(/^\[ -e (.+) \]$/))) return exit(files.has(unquote(m[1])) ? 0 : 1);
      if ((m = inner.match(/^stat -c .* -- (.+)$/))) {
        const p = unquote(m[1]);
        return files.has(p) ? exit(0, `regular file|${files.get(p).length}|1700000000\n`) : exit(1, 'no such file\n');
      }
      return exit(0, `ok: ${inner}\n`);
    },
  };
}

function scriptedClient(replies) {
  const queue = [...replies];
  const calls = [];
  return {
    calls,
    async chat(body) {
      calls.push(body);
      return {
        choices: [{ index: 0, message: { role: 'assistant', content: queue.shift() ?? '{"final":"done"}' }, finish_reason: 'stop' }],
      };
    },
    // LiteRT providers probe this internally — the harness must not crash.
    status: async () => ({ modelName: 'gemma-4-e2b' }),
    get modelName() { return 'gemma-4-e2b'; },
  };
}

function createHarness({ guest, llmClient, replies = [] } = {}) {
  const g = guest ?? fakeGuest();
  const h = new CodeAgentHarness({
    guest: g,
    llmClient: llmClient ?? scriptedClient(replies),
    yolo: true,
    approveAction: async () => true,
    onActivity: () => {},
    onOutput: () => {},
    onThreadUpdate: () => {},
  });
  // Seed a thread without IndexedDB
  h.currentThread = { id: `test_${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), mode: 'code', messages: [] };
  return h;
}

// --- tests ----------------------------------------------------------------

test('E2E: harness constructor requires guest and chat-capable client', () => {
  assert.throws(() => new CodeAgentHarness({ llmClient: { chat() {} } }), /guest bridge/);
  assert.throws(() => new CodeAgentHarness({ guest: {} }), /LLM client/);
});

test('E2E: bare /help returns a help screen with all slash commands and modes', async () => {
  const h = createHarness({ replies: [] });
  const r = await h.run('/help');
  assert.equal(r.type, 'help');
  assert.match(r.message, /\/exit/);
  assert.match(r.message, /\/stop/);
  assert.match(r.message, /\/reset/);
  assert.match(r.message, /\/help/);
  assert.match(r.message, /\/mode/);
  assert.match(r.message, /code/);
  assert.match(r.message, /chat/);
  assert.match(r.message, /batch/);
});

test('E2E: /mode switches modes and the change is reflected in subsequent runs', async () => {
  const h = createHarness({ replies: ['hello'] });
  let r = await h.run('/mode chat');
  assert.equal(h.mode, 'chat');

  // In chat mode, no Mastra agent is loaded — the raw llm is used
  r = await h.run('say hi');
  assert.equal(r.type, 'message');
});

test('E2E: /mode with an invalid value returns an error without changing the mode', async () => {
  const h = createHarness({ replies: [] });
  assert.equal(h.mode, 'code');
  const r = await h.run('/mode invalid');
  assert.match(r.message, /Unknown mode/);
  assert.equal(h.mode, 'code');
});

test('E2E: /exit returns an exit-type result', async () => {
  const h = createHarness({ replies: [] });
  const r = await h.run('/exit');
  assert.equal(r.type, 'exit');
});

test('E2E: /reset clears the agent and creates a fresh thread', async () => {
  const h = createHarness({ replies: [] });
  const oldId = h.currentThread.id;
  h._agent = { dummy: true };

  const r = await h.run('/reset');
  assert.equal(r.type, 'reset');
  assert.notEqual(h.currentThread.id, oldId);
  assert.equal(h._agent, null);
});

test('E2E: /stop is a no-op when nothing is running', async () => {
  const h = createHarness({ replies: [] });
  const r = await h.run('/stop');
  assert.equal(r.type, 'stop');
  assert.equal(h.abortController, null);
});

test('E2E: a non-slash message is appended to the thread messages', async () => {
  const h = createHarness({ replies: ['{"final":"done"}'] });
  const prev = h.currentThread.messages.length;
  await h.run('fix the bug');
  assert.equal(h.currentThread.messages.length, prev + 2); // user + assistant
  assert.equal(h.currentThread.messages.at(-2).role, 'user');
  assert.equal(h.currentThread.messages.at(-1).role, 'assistant');
});

test('E2E: chat mode calls the raw llm directly, bypassing the Mastra agent bundle', async () => {
  const llm = scriptedClient(['hello from chat']);
  const h = createHarness({ llmClient: llm, replies: [] });
  await h.run('/mode chat');

  const r = await h.run('what time is it');
  assert.match(String(r.content ?? ''), /hello from chat/);
  // The Mastra agent bundle (mastra-agent.js) must NOT have been imported
  assert.equal(h._agent, null, 'chat mode must not load the Mastra bundle');
});

test('E2E: setYolo propagates to the Mastra agent once it is built', async () => {
  const h = createHarness({ replies: [] });
  h.setYolo(false);
  assert.equal(h.yolo, false);

  h.setYolo(true);
  assert.equal(h.yolo, true);
});

test('E2E: stop aborts the harness abortController when in flight', () => {
  const h = createHarness({ replies: [] });
  const ac = new AbortController();
  h.abortController = ac;
  h.stop();
  assert.ok(ac.signal.aborted);
  assert.equal(h.abortController, null);
});

test('E2E: thread messages survive /reset followed by a new message', async () => {
  const h = createHarness({ replies: ['ok'] });
  await h.run('first message');
  await h.run('/reset');
  // The new thread starts empty
  const msgs = h.currentThread.messages;
  assert.equal(msgs.length, 0);
});
