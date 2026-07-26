import test from 'node:test';
import assert from 'node:assert/strict';
import { createMastraVMAgent } from '../src/mastra-browser.js';

function guestFake() {
  const files = new Map([['README.md', 'hello\n']]);
  const log = [];
  let queue = Promise.resolve();
  const exit = (code, out = '') => `__V86AGENT_EXIT__${code}\n${out}`;
  const unquote = s => s.replace(/^'(.*)'$/s, '$1').replace(/'"'"'/g, "'");
  const serialize = fn => { const r = queue.then(fn, fn); queue = r.catch(() => {}); return r; };
  return {
    files, log,
    list: () => serialize(() => [...files].map(([p, c]) => `file\t${p}\t${c.length}`).join('\n')),
    glob() { return this.list(); },
    read: p => serialize(() => { if (!files.has(p)) throw new Error(`not found: ${p}`); return files.get(p); }),
    write: (p, c) => serialize(() => { files.set(p, c); return ''; }),
    delete: p => serialize(() => { files.delete(p); return ''; }),
    grep: () => serialize(() => ''),
    execute: cmd => serialize(() => {
      log.push(cmd);
      const inner = cmd.match(/\{ ([\s\S]*?); \} 2>/)?.[1] ?? cmd;
      let m;
      if ((m = inner.match(/^\[ -e (.+) \]$/))) return exit(files.has(unquote(m[1])) ? 0 : 1);
      if ((m = inner.match(/^stat -c .* -- (.+)$/))) {
        const p = unquote(m[1]);
        return files.has(p) ? exit(0, `regular file|${files.get(p).length}|1700000000\n`) : exit(1, 'no such\n');
      }
      return exit(0, `ok: ${inner}\n`);
    }),
  };
}

const scripted = replies => {
  let turn = 0;
  const client = {
    get turns() { return turn; },
    async chat() {
      return { choices: [{ index: 0, message: { role: 'assistant', content: replies[turn++] ?? '{"final":"done"}' }, finish_reason: 'stop' }] };
    },
  };
  return client;
};

test('requires both a guest and an llm client', () => {
  assert.throws(() => createMastraVMAgent({ llmClient: { chat() {} } }), /guest bridge/);
  assert.throws(() => createMastraVMAgent({ guest: guestFake() }), /LLM client/);
});

test('trims delete and lsp by default to save prompt tokens', async () => {
  const vm = createMastraVMAgent({ guest: guestFake(), llmClient: scripted([]) });
  const tools = await vm.listTools();
  assert.equal(tools.includes('mastra_workspace_delete'), false);
  assert.equal(tools.includes('mastra_workspace_lsp_inspect'), false);
  assert.ok(tools.includes('mastra_workspace_execute_command'));
});

test('opting delete back in restores the tool', async () => {
  const vm = createMastraVMAgent({ guest: guestFake(), llmClient: scripted([]), enableDelete: true });
  assert.ok((await vm.listTools()).includes('mastra_workspace_delete'));
});

test('yolo true runs a command without consulting approveAction', async () => {
  const guest = guestFake();
  let asked = 0;
  const vm = createMastraVMAgent({
    guest,
    llmClient: scripted([
      '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"uname -m"}}}',
      '{"final":"ok"}',
    ]),
    yolo: true,
    approveAction: async () => { asked += 1; return true; },
  });
  await vm.run('check arch');
  assert.equal(asked, 0, 'approval was requested despite yolo');
  assert.ok(guest.log.some(c => c.includes('uname -m')), 'command never reached the guest');
});

test('setYolo(false) routes mutations through approveAction', async () => {
  const guest = guestFake();
  const seen = [];
  const vm = createMastraVMAgent({
    guest,
    llmClient: scripted([
      '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"rm -rf /"}}}',
      '{"final":"stopped"}',
    ]),
    yolo: true,
    approveAction: async (operation, args) => { seen.push({ operation, args }); return false; },
  });
  vm.setYolo(false);
  await vm.run('do something destructive');
  assert.equal(seen.length > 0, true, 'approveAction was never consulted');
});

test('tool hooks report before and after each call', async () => {
  const events = [];
  const vm = createMastraVMAgent({
    guest: guestFake(),
    llmClient: scripted([
      '{"tool_call":{"name":"mastra_workspace_read_file","arguments":{"path":"/README.md"}}}',
      '{"final":"done"}',
    ]),
    onActivity: e => events.push(e),
  });
  await vm.run('read it');
  assert.ok(events.some(e => e.tool && !e.done), 'no beforeToolCall event');
  assert.ok(events.some(e => e.tool && e.done), 'no afterToolCall event');
});

test('sandbox timeout stays under the guest RPC timeout', async () => {
  // V86GuestAgentClient rejects at 30s. The sandbox must fire first so a slow
  // command surfaces as exitCode 124 rather than a transport-level throw.
  const vm = createMastraVMAgent({ guest: guestFake(), llmClient: scripted([]) });
  assert.ok(vm.workspace.sandbox.defaultTimeout < 30_000);
});

test('sandboxOptions reach the sandbox without clobbering the timeout', async () => {
  // index.html ships { captureStderr: false } through here; that flag is worth
  // ~900ms per command, so a spread that silently dropped it would cost the
  // tier its performance lead with every test still green.
  const vm = createMastraVMAgent({
    guest: guestFake(),
    llmClient: scripted([]),
    sandboxOptions: { captureStderr: false },
  });
  assert.equal(vm.workspace.sandbox.captureStderr, false);
  assert.ok(vm.workspace.sandbox.defaultTimeout < 30_000, 'timeout still applied');
});
