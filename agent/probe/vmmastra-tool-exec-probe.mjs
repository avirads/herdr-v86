// Probe: verify plain vmmastra (without "code") executes tool calls through the
// Mastra agent rather than echoing the raw model output.
//
// This simulates what happens when the user runs `vmmastra "write hello world"`
// (the MASTRA operation, not MASTRA_CODE).
import { createMastraVMAgent } from '../src/mastra-browser.js';
import { extractToolCall } from '../src/litert-provider.js';

function fakeGuest() {
  const files = new Map();
  const log = [];
  return {
    files, log,
    async list() { return ''; },
    async glob() { return ''; },
    async read(p) { throw new Error('not found'); },
    async write(p, c) { files.set(p, c); },
    async delete(p) { files.delete(p); },
    async grep() { return ''; },
    async execute(cmd) {
      log.push(cmd);
      return '__V86AGENT_EXIT__0\nok\n';
    },
  };
}

function client(replies) {
  const q = [...replies];
  return {
    modelName: 'gemma-4-e2b',
    async chat(b) {
      const reply = q.shift() || '{"final":"done"}';
      return {
        choices: [{
          index: 0,
          message: { role: 'assistant', content: reply },
          finish_reason: 'stop',
        }],
      };
    },
    status: async () => ({ modelName: 'gemma-4-e2b' }),
  };
}

// Scenario: model generates ONE tool call, Mastra should execute it and return
// the final text (not the raw tool JSON).
{
  const guest = fakeGuest();
  const llm = client([
    '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"echo hello"}}}',
    '{"final":"Hello from the guest"}',
  ]);
  const vm = createMastraVMAgent({ guest, llmClient: llm, yolo: true });
  const out = await vm.run('say hello');
  const executed = guest.log.length > 0;
  const isRawJson = out.includes('tool_call');
  console.log('Scenario 1: single tool call then final');
  console.log('  output:', JSON.stringify(out));
  console.log('  tool executed:', executed);
  console.log('  output is raw JSON:', isRawJson);
  if (isRawJson) console.log('  FAIL: tool JSON leaked into output');
  else if (executed) console.log('  PASS: tool executed, final text returned');
  else console.log('  FAIL: nothing was executed');
}

// Scenario: model generates multiple tool calls in one response (the pattern
// the user observed).  Mastra should only see the FIRST call per turn.
{
  const guest = fakeGuest();
  const llm = client([
    '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"mkdir src"}}}\n' +
    '{"tool_call":{"name":"mastra_workspace_execute_command","arguments":{"command":"mkdir main"}}}',
    '{"final":"done"}',
  ]);
  const vm = createMastraVMAgent({ guest, llmClient: llm, yolo: true });
  const out = await vm.run('create dirs');
  const executedCount = guest.log.length;
  console.log('\nScenario 2: multiple tool calls in one response');
  console.log('  output:', JSON.stringify(out));
  console.log('  tools executed:', executedCount);
  if (executedCount === 0) console.log('  FAIL: no tools were executed — raw JSON may have been echoed');
  else console.log('  PASS:', executedCount, 'tool(s) executed');
}

// Scenario 3: model puts args at top level alongside tool_call (observed on
// real Gemma 4 E2B output — path as sibling of tool_call).
{
  const input = '{"tool_call":{"name":"write_file","content":"echo hello"},"path":"test.sh"}';
  const call = extractToolCall(JSON.parse(input));
  const args = call?.arguments;
  const hasPath = args?.path === 'test.sh';
  const hasContent = args?.content === 'echo hello';
  console.log('\nScenario 3: top-level flattened args (path sibling of tool_call)');
  console.log('  extracted args:', JSON.stringify(args));
  if (hasPath && hasContent) console.log('  PASS: top-level path absorbed into args');
  else console.log('  FAIL: top-level keys not merged');
}

// Scenario 5: full end-to-end with top-level args (the exact observed pattern).
{
  const guest = fakeGuest();
  const llm = client([
    '{"tool_call":{"name":"mastra_workspace_execute_command","content":"echo hello"},"command":"echo hello"}',
    '{"final":"done"}',
  ]);
  const vm = createMastraVMAgent({ guest, llmClient: llm, yolo: true });
  const out = await vm.run('echo test');
  const executed = guest.log.length > 0;
  console.log('\nScenario 5: E2E with top-level command arg');
  console.log('  output:', JSON.stringify(out));
  console.log('  tool executed:', executed);
  if (executed) console.log('  PASS');
  else console.log('  FAIL');
}
