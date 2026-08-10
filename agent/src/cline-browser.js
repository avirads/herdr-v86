// Browser-hosted Cline SDK runtime for the i386 v86 guest.
//
// The official Cline CLI is only distributed for x64/arm64.  The actual
// agent loop, however, is browser-safe.  Keep it here and expose only a tiny
// shell launcher in the guest so no Node runtime is added to the VM image.

import { Agent, createTool } from '@cline/agents';

const DEFAULT_PROMPT = [
  'You are Cline, a coding agent working in /root/project on a 32-bit Alpine Linux VM.',
  'Inspect before editing. Make focused changes and use the available tools rather than guessing.',
  'Every response during a task MUST call exactly one available tool. Never echo or paraphrase the user request and never answer with plain prose.',
  'Installed commands and environment limits are documented in /usr/local/share/vm-agent-capabilities.md.',
  'After creating or editing executable code, run it or an appropriate syntax checker, inspect the exit code and output, and repair failures.',
  'For JavaScript, test with both time qjs FILE and time vmjs < FILE and report both elapsed times.',
  'Report success only after verification. When the task is complete, call finish_task with a concise verified summary.',
].join('\n');

const jsonSchema = (properties, required = Object.keys(properties)) => ({
  type: 'object', properties, required, additionalProperties: false,
});
const textOf = content => (Array.isArray(content) ? content : [])
  .filter(part => part?.type === 'text' || part?.type === 'reasoning')
  .map(part => part.text).join('\n');

function toOpenAiMessages(messages) {
  const output = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      for (const part of message.content || []) if (part.type === 'tool-result') {
        output.push({
          role: 'tool',
          tool_call_id: part.toolCallId,
          name: part.toolName,
          content: typeof part.output === 'string' ? part.output : JSON.stringify(part.output),
        });
      }
      continue;
    }
    const toolCalls = (message.content || []).filter(part => part.type === 'tool-call').map(part => ({
      id: part.toolCallId,
      type: 'function',
      function: { name: part.toolName, arguments: JSON.stringify(part.input ?? {}) },
    }));
    const converted = { role: message.role, content: textOf(message.content) || null };
    if (toolCalls.length) converted.tool_calls = toolCalls;
    output.push(converted);
  }
  return output;
}

/** Adapt VMVM's OpenAI-compatible browser client to Cline's AgentModel. */
export function createClineModel(llmClient) {
  if (!llmClient?.chat) throw new Error('Cline requires an LLM client with chat()');
  return {
    id: llmClient.modelName || 'webgpu',
    provider: 'vmvm',
    async *stream(request) {
      const messages = toOpenAiMessages(request.messages);
      if (request.systemPrompt) messages.unshift({ role: 'system', content: request.systemPrompt });
      const tools = request.tools.map(tool => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
      }));
      const completion = await llmClient.chat({
        model: llmClient.modelName || 'webgpu',
        temperature: 0,
        max_tokens: 1400,
        chat_template_kwargs: { enable_thinking: false },
        messages,
        ...(tools.length ? { tools, tool_choice: 'required' } : {}),
      });
      const choice = completion?.choices?.[0] || {};
      const message = choice.message || {};
      if (message.content) yield { type: 'text-delta', text: String(message.content) };
      for (const [index, call] of (message.tool_calls || []).entries()) {
        yield {
          type: 'tool-call-delta',
          index,
          toolCallId: call.id || `cline-tool-${Date.now()}-${index}`,
          toolName: call.function?.name,
          inputText: call.function?.arguments || '{}',
        };
      }
      const usage = completion?.usage;
      if (usage) yield {
        type: 'usage',
        usage: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || 0,
          cacheWriteTokens: 0,
        },
      };
      yield { type: 'finish', reason: message.tool_calls?.length ? 'tool-calls' : (choice.finish_reason === 'length' ? 'max-tokens' : 'stop') };
    },
  };
}

function evidencePath(path, workspace) {
  const value = String(path || '').replace(/\\/g, '/');
  const prefix = String(workspace || '').replace(/\/$/, '') + '/';
  return value.startsWith(prefix) ? value.slice(prefix.length) : value.replace(/^\.\//, '');
}

function createTools({ guest, onActivity, evidence, workspace }) {
  const activity = (tool, input) => onActivity({ tool, input });
  return [
    createTool({
      name: 'read_file', description: 'Read a UTF-8 file in the current project.',
      inputSchema: jsonSchema({ path: { type: 'string', description: 'Project-relative or absolute path' } }),
      async execute({ path }) {
        activity('read_file', { path });
        evidence.toolCalls++;
        const content = await guest.read(path);
        const key = evidencePath(path, workspace);
        const expected = evidence.writes.get(key);
        if (expected !== undefined && String(content).trimEnd() === String(expected).trimEnd()) {
          evidence.verifiedWrites.add(key);
        }
        return content;
      },
    }),
    createTool({
      name: 'list_files', description: 'List files in a project directory.',
      inputSchema: jsonSchema({ path: { type: 'string', description: 'Directory path; use . for the project root' } }, []),
      async execute({ path = '.' }) { activity('list_files', { path }); evidence.toolCalls++; return await guest.list(path); },
    }),
    createTool({
      name: 'search_files', description: 'Search project text using the guest ripgrep implementation.',
      inputSchema: jsonSchema({ pattern: { type: 'string' }, path: { type: 'string' } }, ['pattern']),
      async execute({ pattern, path = '.' }) { activity('search_files', { pattern, path }); evidence.toolCalls++; return await guest.grep(pattern, path); },
    }),
    createTool({
      name: 'write_file', description: 'Create or replace a UTF-8 project file.',
      inputSchema: jsonSchema({ path: { type: 'string' }, content: { type: 'string' } }),
      async execute({ path, content }) {
        activity('write_file', { path });
        evidence.toolCalls++;
        await guest.write(path, content);
        evidence.writes.set(evidencePath(path, workspace), String(content));
        return `wrote ${path}`;
      },
    }),
    createTool({
      name: 'execute_command', description: 'Run a POSIX shell command in the current project and return its exit code and combined output.',
      inputSchema: jsonSchema({ command: { type: 'string' } }),
      async execute({ command }) {
        activity('execute_command', { command });
        evidence.toolCalls++;
        const raw = String(await guest.execute(command));
        const match = raw.match(/^__V86AGENT_EXIT__(\d+)\n?/);
        return { exitCode: match ? Number(match[1]) : 0, output: match ? raw.slice(match[0].length) : raw };
      },
    }),
    createTool({
      name: 'finish_task', description: 'Finish only after the requested work has been verified.',
      inputSchema: jsonSchema({ summary: { type: 'string' } }), lifecycle: { completesRun: true },
      async execute({ summary }) { return summary; },
    }),
  ];
}

export function createClineVMAgent({
  guest,
  llmClient,
  workspace = '/root/project',
  yolo = true,
  approveAction = async () => false,
  onActivity = () => {},
  systemPrompt = DEFAULT_PROMPT,
  initialMessages = [],
} = {}) {
  if (!guest) throw new Error('Cline requires the guest bridge');
  guest.setWorkspace?.(workspace);
  let autoApprove = Boolean(yolo);
  const evidence = { toolCalls: 0, writes: new Map(), verifiedWrites: new Set() };
  const evidenceComplete = () => evidence.verifiedWrites.size > 0 || (evidence.toolCalls > 0 && evidence.writes.size === 0);
  const verifiedResult = result => evidence.verifiedWrites.size ? {
    ...result,
    status: 'completed',
    error: undefined,
    outputText: `Verified ${[...evidence.verifiedWrites].join(', ')} by reading back the written content.`,
  } : result;
  const runtime = new Agent({
    agentId: 'vmvm-cline',
    conversationId: `vmvm-cline-${Date.now()}`,
    systemPrompt,
    model: createClineModel(llmClient),
    tools: createTools({ guest, onActivity, evidence, workspace }),
    initialMessages,
    maxIterations: 12,
    // Keep retrying until the model uses a tool. Once tool evidence proves a
    // read-only task or a matching write/read-back, plain text may close the
    // run even when a small local model cannot emit finish_task reliably.
    completionPolicy: {
      completionGuard: () => evidenceComplete() ? undefined : 'Use the appropriate tool now. Do not repeat the request or answer in prose.',
    },
    toolPolicies: {
      read_file: { autoApprove: true }, list_files: { autoApprove: true }, search_files: { autoApprove: true },
      write_file: { autoApprove: false }, execute_command: { autoApprove: false }, finish_task: { autoApprove: true },
    },
    requestToolApproval: async request => ({
      approved: autoApprove || await approveAction(request.toolName, request.input),
    }),
  });
  runtime.subscribe(event => {
    if (event.type === 'run-started') onActivity({ type: 'run-started' });
    if (event.type === 'turn-finished' && event.toolCallCount === 0 && !evidenceComplete()) {
      onActivity({ type: 'retry', iteration: event.iteration });
    }
  });
  return {
    runtime,
    setYolo(value) { autoApprove = Boolean(value); },
    stop() { runtime.abort('stopped by user'); },
    snapshot() { return runtime.snapshot(); },
    async run(task) { return verifiedResult(await runtime.run(String(task))); },
    async continue(task) { return verifiedResult(await runtime.continue(String(task))); },
  };
}
