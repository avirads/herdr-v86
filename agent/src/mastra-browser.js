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
import { createVmTools, createGlobTool, createGrepTool } from './vm-tools.js';

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
  // on-device model has a 16k window. Measured ~3.0k tokens with all eleven.
  enableLsp = false,
  enableDelete = false,
  // Parity with the Deep Agents tier: the browser-backed vm* commands and the
  // AutoBro tools. Off by default — they roughly double the system prompt, and
  // the agent can already reach most of them via execute_command. Measure with
  // listTools()/systemPromptCost() before enabling on a 16k-window model.
  enableVmTools = false,
  // Mastra's own planning tools, the equivalent of Deep Agents' write_todos.
  enablePlanning = false,
  // On by default, unlike the two above. list_files can already filter by
  // pattern, but it walks the tree with one round-trip per directory and
  // truncates at depth 2; glob answers the same question in one trip and
  // misses nothing. The cheapest tool here in prompt tokens.
  enableGlob = true,
  // Also on by default, and it REPLACES Mastra's workspace grep rather than
  // adding to it — two tools called "grep" would just make the model guess.
  // Mastra's own grep reads every file over the bridge to search it here:
  // measured at 34 round-trips and 6576 ms against 468 ms and one round-trip
  // for the guest's grep, same results. Set false to get Mastra's back, which
  // buys context lines and regex at that price.
  fastGrep = true,
  // Passed to V86Filesystem: cacheTtlMs and prefetchMaxBytes. The defaults are
  // what bring per-operation round-trips down to the Deep Agents tier's; set
  // { cacheTtlMs: 0 } to measure or restore the uncached behaviour.
  filesystemOptions = {},
  // Passed to V86Sandbox. The one that matters for speed is
  // { captureStderr: false }: separating stderr costs a temp file plus two
  // extra process spawns inside the guest, measured at ~900 ms per command
  // against ~400 ms unwrapped. Deep Agents does not separate stderr at all,
  // which is most of why its execute looks faster.
  sandboxOptions = {},
} = {}) {
  if (!guest) throw new Error('createMastraVMAgent requires the guest bridge');
  if (!llmClient?.chat) throw new Error('createMastraVMAgent requires an LLM client with chat()');

  const requireApproval = async ({ args } = {}) => {
    if (yolo) return false;
    onActivity({ approval: true, args });
    return !(await approveAction('workspace', args ?? {}));
  };

  const workspace = new Workspace({
    filesystem: new V86Filesystem({ guest, ...filesystemOptions }),
    sandbox: new V86Sandbox({ guest, defaultTimeout: SANDBOX_TIMEOUT_MS, ...sandboxOptions }),
    tools: {
      hooks: {
        beforeToolCall: ({ toolName, input }) => onActivity({ tool: toolName, input }),
        afterToolCall: ({ toolName, error }) => onActivity({ tool: toolName, done: true, error }),
      },
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval },
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval, requireReadBeforeWrite: false },
      [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireApproval },
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: enableDelete, requireApproval },
      [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: !fastGrep },
      [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: enableLsp },
    },
  });

  const extraTools = {
    // Always on: one round-trip for a pattern match, against list_files'
    // one-per-directory walk.
    ...(enableGlob ? createGlobTool({ guest }) : {}),
    ...(fastGrep ? createGrepTool({ guest }) : {}),
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

  // One model call, one script, one round-trip — the shape `rig --codeact`
  // uses to finish the tier benchmark in 950 ms where the tool loop needs
  // 2667 ms. That 2.8x is far larger than anything left to win inside the tool
  // loop, and it comes from collapsing round-trips rather than making them
  // cheaper.
  //
  // The difference from `rig --codeact`, which runs the script and returns
  // whatever it printed: `set -e` is prepended, so a command failing halfway
  // exits non-zero instead of reporting partial output as success. That turns
  // the exit code into a signal worth branching on, which is what lets
  // run({ batchFirst: true }) fall back.
  //
  // Know exactly how far that guarantee reaches. Measured on real weights
  // across eight one-script tasks: 7 worked, 1 was wrong, and `set -e` caught
  // ZERO — because a small model's characteristic failure is not a crash but
  // a plausible script that exits 0 doing the wrong thing (asked to put
  // `uname -m` in a file, it wrote `printf "uname -m\n" > ARCH.txt`). The
  // fallback covers crashes. It does not make batch mode's answers
  // trustworthy, which is why this is an opt-in verb and why callers must
  // still verify by side effect.
  const runBatch = async (task) => {
    const completion = await llmClient.chat({
      model: llmClient.modelName || 'webgpu',
      temperature: 0,
      max_tokens: 1000,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: BATCH_PROMPT },
        { role: 'user', content: String(task) },
      ],
    });
    const script = stripFence(completion?.choices?.[0]?.message?.content);
    if (!script) return { ok: false, script: '', output: '', exitCode: null, reason: 'no script' };

    onActivity({ tool: 'batch', input: { script } });
    if (!yolo && !(await approveAction('execute', { script }))) {
      return { ok: false, script, output: '', exitCode: null, reason: 'rejected' };
    }

    await workspace.init();
    const result = await workspace.sandbox.executeCommand(`set -e\n${script}`);
    onActivity({ tool: 'batch', done: true, error: result.success ? undefined : result.exitCode });
    return {
      ok: result.success,
      script,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
      exitCode: result.exitCode,
      reason: result.success ? 'ok' : `exit ${result.exitCode}`,
    };
  };

  return {
    agent,
    workspace,
    setYolo(value) {
      yolo = Boolean(value);
    },
    listTools: allToolNames,
    // The callable tools, not just their names. @mastra/core is only reachable
    // through this bundle, so a page that wants to exercise a single tool
    // (benchmarks, diagnostics) has no other way to reach one.
    async toolMap() {
      await workspace.init();
      return { ...(await createWorkspaceTools(workspace)), ...extraTools };
    },
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
    runBatch,
    // batchFirst tries the one-shot script and falls back to the tool loop if
    // it does not exit clean. The fallback is the point: a 2B model writes a
    // correct script often enough to be worth trying and not often enough to
    // trust, so this buys codeact's speed without codeact's failure mode.
    async run(task, { batchFirst = false } = {}) {
      extraTools.resetTurn?.();
      if (batchFirst) {
        const batch = await runBatch(task);
        if (batch.ok) return batch.output;
        if (batch.reason === 'rejected') return 'Operation rejected.';
        onActivity({ batchFallback: batch.reason });
        extraTools.resetTurn?.();
      }
      const result = await agent.generate(task);
      return result.text ?? result?.response?.text ?? '';
    },
  };
}

const BATCH_PROMPT = [
  'You are a coding agent working in a project directory on a 32-bit Linux VM running inside a browser tab.',
  'Accomplish the task by writing ONE POSIX sh script using BusyBox-available tools (cat, ls, grep, sed, awk, printf, test, mkdir, etc.).',
  'Paths are relative to the project directory, which is already the working directory.',
  'Output ONLY the script body — no explanation, no markdown fences.',
].join('\n');

/** Models wrap scripts in ```sh fences about half the time; unwrap if so. */
function stripFence(content) {
  const text = String(content ?? '').trim();
  const fenced = text.match(/^```(?:sh|bash)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : text).trim();
}

export const GUEST_RPC_TIMEOUT_MS_EXPORTED = GUEST_RPC_TIMEOUT_MS;
