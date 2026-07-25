// Browser entry for the Mastra agent tier.
//
// Takes the objects index.html already constructs — `V86GuestAgentClient` and
// the LiteRT-LM / AutoBro WebGPU client — and returns a Mastra Agent wired to
// them. Bundle with build-browser.sh; the shim layer is required (see
// shims/README.md), in particular the injected `setImmediate`, without which
// every tool call fails silently.

import { Agent } from '@mastra/core/agent';
import { Workspace, WORKSPACE_TOOLS, createWorkspaceTools } from '@mastra/core/workspace';
import { createLiteRt } from './litert-provider.js';
import { V86Filesystem, V86Sandbox } from './v86-workspace.js';

// V86GuestAgentClient defaults to a 30 s per-RPC timeout and serializes every
// call through one queue. Time out just under that so a slow command surfaces
// as a CommandResult with exitCode 124 rather than a transport-level throw.
const GUEST_RPC_TIMEOUT_MS = 30_000;
const SANDBOX_TIMEOUT_MS = 25_000;

export function createMastraVMAgent({
  guest,
  llmClient,
  modelId = 'gemma-4-e2b',
  instructions = 'You are a coding agent working in /root/project on a 32-bit Linux VM running inside a browser tab.',
  approveAction = async () => false,
  yolo = true,
  onActivity = () => {},
  // Trimmed by default: every enabled tool costs system-prompt tokens, and the
  // on-device model has a 16k window. Measured ~2.9k tokens with all ten.
  enableLsp = false,
  enableDelete = false,
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

  const agent = new Agent({
    id: 'vm-agent-mastra',
    name: 'vm-agent-mastra',
    instructions,
    model: createLiteRt({ client: llmClient })(modelId),
    workspace,
  });

  return {
    agent,
    workspace,
    setYolo(value) {
      yolo = Boolean(value);
    },
    async listTools() {
      await workspace.init();
      return Object.keys(await createWorkspaceTools(workspace));
    },
    async run(task) {
      const result = await agent.generate(task);
      return result.text ?? result?.response?.text ?? '';
    },
  };
}

export const GUEST_RPC_TIMEOUT_MS_EXPORTED = GUEST_RPC_TIMEOUT_MS;
