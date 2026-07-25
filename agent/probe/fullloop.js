// Full loop, browser-targeted: a real @mastra/core Agent, our LiteRT
// LanguageModelV2 provider, and our V86 workspace providers — bundled with
// every node builtin aliased to a throwing stub. If this runs, nothing on the
// agent's happy path needs node.
import { Agent } from '@mastra/core/agent';
import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { createLiteRt } from '../src/litert-provider.js';
import { createV86Workspace } from '../src/v86-workspace.js';

function makeGuest() {
  const files = new Map([
    ['README.md', 'herdr-v86: linux in a browser tab\n'],
    ['src/main.rs', 'fn main() { println!("hi"); }\n'],
  ]);
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
    async read(p) {
      if (!files.has(p)) throw new Error(`not found: ${p}`);
      return files.get(p);
    },
    async write(p, c) {
      files.set(p, c);
    },
    async delete(p) {
      files.delete(p);
    },
    async grep(pattern) {
      const rows = [];
      for (const [p, c] of files) {
        c.split('\n').forEach((line, i) => {
          if (line.includes(pattern)) rows.push(`${p}:${i + 1}:${line}`);
        });
      }
      return rows.join('\n');
    },
    async execute(cmd) {
      log.push(cmd);
      const inner = cmd.match(/\{ ([\s\S]*?); \} 2>/)?.[1] ?? cmd;
      let m;
      if ((m = inner.match(/^\[ -e (.+) \]$/))) return exit(files.has(unquote(m[1])) ? 0 : 1);
      if ((m = inner.match(/^stat -c .* -- (.+)$/))) {
        const p = unquote(m[1]);
        return files.has(p)
          ? exit(0, `regular file|${files.get(p).length}|1700000000\n`)
          : exit(1, 'no such file\n');
      }
      if (inner.includes('uname')) return exit(0, 'i686\n');
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
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: queue.shift() ?? '{"final":"done"}' },
            finish_reason: 'stop',
          },
        ],
      };
    },
  };
}

globalThis.__runFullLoop = async () => {
  const guest = makeGuest();
  const client = scriptedClient([
    // turn 1: read a file
    '{"tool_call":{"name":"mastra_workspace_read_file","arguments":{"path":"/README.md"}}}',
    // turn 2: run a command
    '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"uname -m"}}}',
    // turn 3: write a file
    '{"tool_call":{"name":"mastra_workspace_write_file","arguments":{"path":"/NOTES.md","content":"arch is i686\\n"}}}',
    // turn 4: done
    '{"final":"Read the README, checked the arch (i686), and wrote NOTES.md."}',
  ]);

  const workspace = new Workspace({
    ...createV86Workspace({ guest }),
    tools: {
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval: false },
      [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: false },
    },
  });

  const agent = new Agent({
    id: 'vm-agent',
    name: 'vm-agent',
    instructions: 'You operate a Linux guest running inside a browser tab.',
    model: createLiteRt({ client })('gemma-4-e2b'),
    workspace,
  });

  const result = await agent.generate('Read the README, check the architecture, and write NOTES.md.');

  return {
    text: result.text ?? result?.response?.text ?? '',
    modelTurns: client.calls.length,
    guestCommands: guest.log.length,
    sawUname: guest.log.some(c => c.includes('uname')),
    notesWritten: guest.files.get('NOTES.md') ?? null,
    systemPromptChars: client.calls[0]?.messages?.find(m => m.role === 'system')?.content?.length ?? 0,
    turn2Observation: (client.calls[1]?.messages ?? []).map(m => m.content).join(' | ').slice(-600),
  };
};
