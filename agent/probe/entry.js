// Exercises the real browser entry (createMastraVMAgent) against a guest that
// mimics V86GuestAgentClient: same method names, and every call serialized
// through one queue the way the real serial RPC is.
import { createMastraVMAgent } from '../src/mastra-browser.js';

function fakeGuestClient() {
  const files = new Map([['README.md', 'herdr-v86: linux in a browser tab\n']]);
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
      if (inner.includes('uname')) return exit(0, 'i686\n');
      return exit(0, `ok: ${inner}\n`);
    }),
  };
}

globalThis.__runEntry = async () => {
  const guest = fakeGuestClient();
  let turn = 0;
  const replies = [
    '{"tool_call":{"name":"mastra_workspace_read_file","arguments":{"path":"/README.md"}}}',
    '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"uname -m"}}}',
    '{"tool_call":{"name":"mastra_workspace_write_file","arguments":{"path":"/NOTES.md","content":"arch checked\\n"}}}',
    '{"final":"Read README, checked arch, wrote NOTES.md."}',
  ];
  const activity = [];
  const vm = createMastraVMAgent({
    guest,
    llmClient: { async chat(){ return { choices:[{ index:0, message:{ role:'assistant', content: replies[turn++] ?? '{"final":"done"}' }, finish_reason:'stop' }] }; } },
    yolo: true,
    onActivity: e => activity.push(e),
  });
  const tools = await vm.listTools();
  const text = await vm.run('Read README.md, check the architecture, write NOTES.md.');
  return {
    tools, text, modelTurns: turn,
    guestCommands: guest.log.length,
    sawUname: guest.log.some(c => c.includes('uname')),
    notesWritten: guest.files.get('NOTES.md') ?? null,
    toolHookEvents: activity.filter(a => a.tool).length,
  };
};
