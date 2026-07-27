// Probe: verify the Mastra agent executes tool calls (not just echoes them).
import { Agent } from '@mastra/core/agent';
import { Workspace, WORKSPACE_TOOLS, createWorkspaceTools } from '@mastra/core/workspace';
import { createLiteRt } from '../src/litert-provider.js';
import { V86Filesystem, V86Sandbox } from '../src/v86-workspace.js';

function fakeGuest() {
  const files = new Map();
  const log = [];
  return {
    files, log,
    async list() { return [...files].map(([p, c]) => 'file\t' + p + '\t' + c.length).join('\n'); },
    async glob() { return this.list(); },
    async read(rel) { if (!files.has(rel)) throw new Error('not found: ' + rel); return files.get(rel); },
    async write(rel, c) { files.set(rel, c); },
    async delete(rel) { files.delete(rel); },
    async grep() { return ''; },
    async execute(cmd) { log.push(cmd); return '__V86AGENT_EXIT__0\nok\n'; },
  };
}

function scriptedClient(replies) {
  const queue = [...replies];
  const calls = [];
  return {
    calls,
    async chat(body) {
      calls.push(body);
      return { choices: [{ index: 0, message: { role: 'assistant', content: queue.shift() ?? '{"final":"done"}' }, finish_reason: 'stop' }] };
    },
    status: async () => ({ modelName: 'gemma-4-e2b' }),
    get modelName() { return 'gemma-4-e2b'; },
  };
}

const guest = fakeGuest();
const client = scriptedClient([
  '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"echo hello"}}}',
  '{"final":"done"}',
]);
const workspace = new Workspace({
  filesystem: new V86Filesystem({ guest }),
  sandbox: new V86Sandbox({ guest }),
});
const agent = new Agent({
  id: 'test-agent',
  name: 'test-agent',
  instructions: 'You are a coding agent.',
  model: createLiteRt({ client })('gemma-4-e2b'),
  workspace,
});

const result = await agent.generate('say hello');
console.log('result keys:', Object.keys(result));
console.log('text:', JSON.stringify(result.text));
console.log('response text:', JSON.stringify(result.response?.text));
console.log('guest log:', guest.log);
console.log('client calls:', client.calls.length, 'turns');
if (guest.log.length === 0) {
  console.log('ERROR: The tool was NEVER executed — the raw JSON was returned as text.');
} else {
  console.log('OK: Tool was executed.');
}
