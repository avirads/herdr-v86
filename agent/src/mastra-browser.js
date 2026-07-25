// Browser entry for the Mastra agent tier.
//
// Takes the objects index.html already constructs — `V86GuestAgentClient` and
// the LiteRT-LM / AutoBro WebGPU client — and returns a Mastra Agent wired to
// them. Bundle with build-browser.sh; the shim layer is required (see
// shims/README.md), in particular the injected `setImmediate`, without which
// every tool call fails silently.

import { Agent } from '@mastra/core/agent';
import { Workspace, WORKSPACE_TOOLS, createWorkspaceTools } from '@mastra/core/workspace';
import { taskWriteTool, taskUpdateTool } from '@mastra/core/tools';
import { createLiteRt } from './litert-provider.js';
import { V86Filesystem, V86Sandbox } from './v86-workspace.js';
import { createVmTools } from './vm-tools.js';

// V86GuestAgentClient defaults to a 30 s per-RPC timeout and serializes every
// call through one queue. Time out just under that so a slow command surfaces
// as a CommandResult with exitCode 124 rather than a transport-level throw.
const GUEST_RPC_TIMEOUT_MS = 30_000;
const SANDBOX_TIMEOUT_MS = 25_000;

export function createMastraVMAgent({
  guest,
  llmClient,
  browserClient = null,
  modelId = 'gemma-4-e2b',
  // Real-inference testing showed the default matters. Given only "you work in
  // /root/project", the on-device model calls read_file("README.md"), the
  // workspace rejects it with "workspace path must be absolute", and the model
  // concludes the file does not exist and stops — a confident wrong answer
  // after zero guest calls. Stating the path rule up front is what makes the
  // tier usable with a 2B model. The batching line is here for the same
  // reason: every tool call is one serial round-trip on an emulated CPU.
  instructions = [
    'You are a coding agent working in a project directory on a 32-bit Linux VM running inside a browser tab.',
    'Workspace paths are ABSOLUTE and rooted at the project directory: use "/README.md", never "README.md" or "./README.md".',
    'The shell runs BusyBox sh, so prefer portable POSIX commands over bash-isms or GNU-only flags.',
    'Each tool call is a slow round-trip to the VM. Prefer few, batched commands over many small ones, and do not re-read a file you have already read.',
  ].join('\n'),
  approveAction = async () => false,
  yolo = true,
  onActivity = () => {},
  // Trimmed by default: every enabled tool costs system-prompt tokens, and the
  // on-device model has a 16k window. Measured ~2.9k tokens with all ten.
  enableLsp = false,
  enableDelete = false,
  // Parity with the Deep Agents tier: the browser-backed vm* commands and the
  // AutoBro tools. Off by default — they roughly double the system prompt, and
  // the agent can already reach most of them via execute_command. Measure with
  // listTools()/systemPromptCost() before enabling on a 16k-window model.
  enableVmTools = false,
  // Mastra's own planning tools, the equivalent of Deep Agents' write_todos.
  enablePlanning = false,
} = {}) {
  if (!guest) throw new Error('createMastraVMAgent requires the guest bridge');
  if (!llmClient?.chat) throw new Error('createMastraVMAgent requires an LLM client with chat()');

  const requireApproval = async ({ args } = {}) => {
    if (yolo) return false;
    onActivity({ approval: true, args });
    return !(await approveAction('workspace', args ?? {}));
  };

  const workspace = new Workspace({
    filesystem: new V86Filesystem({ guest }),
    sandbox: new V86Sandbox({ guest, defaultTimeout: SANDBOX_TIMEOUT_MS }),
    tools: {
      hooks: {
        beforeToolCall: ({ toolName, input }) => onActivity({ tool: toolName, input }),
        afterToolCall: ({ toolName, error }) => onActivity({ tool: toolName, done: true, error }),
      },
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval },
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval, requireReadBeforeWrite: false },
      [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireApproval },
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: enableDelete, requireApproval },
      [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: enableLsp },
    },
  });

  const extraTools = {
    ...(enableVmTools
      ? createVmTools({
          guest,
          browserClient,
          llmClient,
          approveAction,
          isYolo: () => yolo,
          onActivity,
        })
      : {}),
    ...(enablePlanning ? { taskWrite: taskWriteTool, taskUpdate: taskUpdateTool } : {}),
  };

  const agent = new Agent({
    id: 'vm-agent-mastra',
    name: 'vm-agent-mastra',
    instructions,
    model: createLiteRt({ client: llmClient })(modelId),
    workspace,
    ...(Object.keys(extraTools).length ? { tools: extraTools } : {}),
  });

  const allToolNames = async () => {
    await workspace.init();
    return [...Object.keys(await createWorkspaceTools(workspace)), ...Object.keys(extraTools)];
  };

  return {
    agent,
    workspace,
    setYolo(value) {
      yolo = Boolean(value);
    },
    listTools: allToolNames,
    // Prompt budget is the live constraint on a 16k-window on-device model, so
    // make it measurable rather than a guess. char/4 is a floor, not an
    // estimate — real tokenisers run higher on JSON-ish schema text.
    async systemPromptCost() {
      const tools = await allToolNames();
      const descriptions = await createWorkspaceTools(workspace);
      const chars = [
        instructions,
        ...Object.values(descriptions).map(tool => `${tool.id ?? ''}${tool.description ?? ''}${JSON.stringify(tool.inputSchema ?? '')}`),
        ...Object.values(extraTools).map(tool => `${tool.id ?? ''}${tool.description ?? ''}${JSON.stringify(tool.inputSchema ?? '')}`),
      ].join('').length;
      return { toolCount: tools.length, chars, approxTokens: Math.ceil(chars / 4) };
    },
    async run(task) {
      extraTools.resetTurn?.();
      const result = await agent.generate(task);
      return result.text ?? result?.response?.text ?? '';
    },
  };
}

export const GUEST_RPC_TIMEOUT_MS_EXPORTED = GUEST_RPC_TIMEOUT_MS;
