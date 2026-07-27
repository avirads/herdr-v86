import test from 'node:test';
import assert from 'node:assert/strict';
import { createMastraVMAgent, DEFAULT_INSTRUCTIONS } from '../src/mastra-browser.js';

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

test('default instructions require executable code verification and repair', () => {
  assert.match(DEFAULT_INSTRUCTIONS, /run it or an appropriate syntax checker/i);
  assert.match(DEFAULT_INSTRUCTIONS, /inspect the exit code and output/i);
  assert.match(DEFAULT_INSTRUCTIONS, /repair the code and rerun verification/i);
  assert.match(DEFAULT_INSTRUCTIONS, /Report success only after verification passes/i);
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

test('glob ships by default and costs exactly one round-trip', async () => {
  // The last capability Deep Agents had that this tier did not. If it ever
  // stops being on by default, the feature table in docs/agent-tiers.md is
  // wrong again.
  const guest = guestFake();
  const calls = [];
  guest.glob = async (pattern, path) => {
    calls.push({ pattern, path });
    return 'file\tdocs/a.md\t10\ndirectory\tdocs\t0\nfile\tsrc/b.md\t20\n';
  };
  const vm = createMastraVMAgent({ guest, llmClient: scripted([]), yolo: true });
  const tools = await vm.toolMap();
  assert.ok(tools.glob, 'glob is not in the default tool set');

  const out = await tools.glob.execute({ pattern: '**/*.md' }, {});
  assert.deepEqual(calls, [{ pattern: '**/*.md', path: '.' }], 'one glob call, path normalised');
  assert.match(out, /docs\/a\.md/);
  assert.match(out, /src\/b\.md/);
  assert.doesNotMatch(out, /^directory/m, 'directories are noise in a file match');
  assert.match(out, /2 matches/);
});

test('glob reports no match plainly rather than returning an empty string', async () => {
  const guest = guestFake();
  guest.glob = async () => '';
  const vm = createMastraVMAgent({ guest, llmClient: scripted([]), yolo: true });
  const out = await (await vm.toolMap()).glob.execute({ pattern: '**/*.rs' }, {});
  // An empty tool result reads to the model as a broken tool, not as "none".
  assert.match(out, /No files match \*\*\/\*\.rs/);
});

test('fastGrep replaces Mastra grep rather than sitting beside it', async () => {
  // Two tools named grep would just make the model pick one at random. The
  // workspace one is disabled so there is exactly one, and it is the cheap
  // one: measured on a real guest at 468 ms / 1 round-trip against Mastra's
  // 6576 ms / 34, because Mastra reads every file over the bridge to search.
  const guest = guestFake();
  const calls = [];
  guest.grep = async (pattern, path) => {
    calls.push({ pattern, path });
    return 'README.md:1:hello\nsub/n.md:3:hello\n';
  };
  const tools = await createMastraVMAgent({
    guest, llmClient: scripted([]), yolo: true,
  }).toolMap();

  assert.ok(tools.grep, 'no grep tool');
  assert.equal(tools.mastra_workspace_grep, undefined, 'Mastra grep must be disabled');

  const out = await tools.grep.execute({ pattern: 'hello' }, {});
  assert.deepEqual(calls, [{ pattern: 'hello', path: '.' }], 'exactly one guest grep');
  assert.match(out, /2 matches/);
  assert.match(out, /README\.md:1:hello/);
});

test('fastGrep:false hands grep back to Mastra', async () => {
  const tools = await createMastraVMAgent({
    guest: guestFake(), llmClient: scripted([]), fastGrep: false,
  }).toolMap();
  assert.equal(tools.grep, undefined);
  assert.ok(tools.mastra_workspace_grep, 'workspace grep should return when opted out');
});

test('glob can be turned off for prompt budget', async () => {
  const vm = createMastraVMAgent({ guest: guestFake(), llmClient: scripted([]), enableGlob: false });
  assert.equal((await vm.toolMap()).glob, undefined);
});

test('glob parses the guest wire format and returns paths at any depth', async () => {
  // Verbatim shape from a booted guest: literal backslash-t separators, and
  // "regular file" rather than "file" as the type. The first version of this
  // tool split on a real tab, got a list of empty strings, and reported "no
  // files match" against a tree full of matches.
  const guest = guestFake();
  guest.glob = async () =>
    'regular file\tdocs/g.md\t2\n' +
    'directory\tsub\t4096\n' +
    'regular file\tsub/deep/d.md\t2\n' +
    'regular file\tREADME.md\t2\n';
  const tools = await createMastraVMAgent({ guest, llmClient: scripted([]), yolo: true }).toolMap();
  const out = await tools.glob.execute({ pattern: '*.md' }, {});

  assert.match(out, /docs\/g\.md/);
  assert.match(out, /sub\/deep\/d\.md/, 'a file three levels down must appear');
  assert.match(out, /README\.md/);
  assert.doesNotMatch(out, /^sub$/m, 'directories are noise in a file match');
  assert.match(out, /3 matches/);
});

test('the glob tool description warns that * crosses directories here', async () => {
  // The guest matches with find -path, where "*" spans "/". That inverts the
  // usual convention: measured against a real guest, "*.md" found all four .md
  // files in the tree while "**/*.md" found three, silently missing the one at
  // the top level. A model trained on ordinary globs reaches for the wrong one
  // unless the description says this out loud.
  const tools = await createMastraVMAgent({
    guest: guestFake(), llmClient: scripted([]), yolo: true,
  }).toolMap();
  const description = String(tools.glob.description);
  assert.match(description, /matches across directories/i);
  assert.match(description, /\*\*\//, 'must name the pattern that silently under-matches');
});

test('batch mode does the whole task in one model call and one round-trip', async () => {
  // The point of the mode. rig --codeact finishes the tier benchmark in 950ms
  // against the tool loop's 2667ms purely by collapsing round-trips, so if
  // this ever costs more than one of each, the mode has no reason to exist.
  const guest = guestFake();
  const llm = scripted(['cat README.md > NOTES.md']);
  const vm = createMastraVMAgent({ guest, llmClient: llm, yolo: true });
  const result = await vm.runBatch('copy the readme');

  assert.equal(result.ok, true);
  assert.equal(llm.turns, 1, 'one model call');
  assert.equal(guest.log.length, 1, 'one guest round-trip');
  assert.match(guest.log[0], /set -e/, 'set -e must be prepended');
  assert.match(guest.log[0], /cat README\.md > NOTES\.md/);
});

test('batch mode strips a markdown fence the model wrapped the script in', async () => {
  const guest = guestFake();
  const vm = createMastraVMAgent({
    guest, yolo: true, llmClient: scripted(['```sh\nuname -m\n```']),
  });
  await vm.runBatch('check arch');
  assert.doesNotMatch(guest.log[0], /```/, 'fence leaked into the guest');
  assert.match(guest.log[0], /uname -m/);
});

test('a script that fails halfway is reported as failure, not partial success', async () => {
  // This is what separates the mode from rig --codeact, which returns whatever
  // the script printed regardless of how it exited. Without a trustworthy exit
  // code there is nothing safe to branch on, and batchFirst could not fall
  // back.
  const guest = guestFake();
  guest.execute = async (cmd) => {
    guest.log.push(cmd);
    return `__V86AGENT_EXIT__1\nsed: no such file\n`;
  };
  const vm = createMastraVMAgent({
    guest, yolo: true, llmClient: scripted(['sed -i s/a/b/ missing.txt']),
  });
  const result = await vm.runBatch('edit it');
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 1);
  assert.equal(result.reason, 'exit 1');
});

test('batchFirst falls back to the tool loop when the script does not exit clean', async () => {
  const guest = guestFake();
  let calls = 0;
  guest.execute = async (cmd) => {
    guest.log.push(cmd);
    calls += 1;
    // Fail only the batch attempt; let the tool loop's commands succeed.
    return calls === 1 ? '__V86AGENT_EXIT__1\nboom\n' : '__V86AGENT_EXIT__0\nok\n';
  };
  const events = [];
  const vm = createMastraVMAgent({
    guest,
    yolo: true,
    onActivity: e => events.push(e),
    llmClient: scripted([
      'false',
      '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"uname -m"}}}',
      '{"final":"done"}',
    ]),
  });
  await vm.run('do the thing', { batchFirst: true });
  assert.ok(events.some(e => e.batchFallback === 'exit 1'), 'no fallback event');
  assert.ok(guest.log.length > 1, 'tool loop never ran after the failed batch');
});

test('batchFirst returns the batch output directly when the script exits clean', async () => {
  const llm = scripted(['echo hi']);
  const vm = createMastraVMAgent({ guest: guestFake(), llmClient: llm, yolo: true });
  const out = await vm.run('say hi', { batchFirst: true });
  assert.match(out, /echo hi/);
  assert.equal(llm.turns, 1, 'the tool loop must not run after a clean batch');
});

test('batch mode honours a rejected approval instead of running the script', async () => {
  const guest = guestFake();
  const vm = createMastraVMAgent({
    guest,
    yolo: false,
    approveAction: async () => false,
    llmClient: scripted(['rm -rf /']),
  });
  const result = await vm.runBatch('clean up');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'rejected');
  assert.equal(guest.log.length, 0, 'a rejected script must never reach the guest');
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
