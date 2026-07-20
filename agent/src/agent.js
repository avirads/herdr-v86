import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { createDeepAgent } from 'deepagents/browser';
import { z } from 'zod';

function contentText(message) {
  if (typeof message.content === 'string') return message.content;
  return JSON.stringify(message.content);
}

function parseDecision(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return { final: cleaned };
}

export class WebGpuToolChatModel extends BaseChatModel {
  constructor(client, fields = {}) {
    super(fields);
    this.client = client;
    this.modelName = fields.modelName || 'webgpu';
    this.maxTokens = fields.maxTokens || 1400;
    this.boundTools = fields.boundTools || [];
  }

  _llmType() { return 'autobro-webgpu'; }
  bindTools(tools, kwargs = {}) {
    const merged = [...this.boundTools, ...tools];
    const wrapped = merged.map(definition => ({
      type: 'function',
      function: { name: definition.name, description: definition.description, parameters: toJsonSchema(definition.schema) },
    }));
    const next = new WebGpuToolChatModel(this.client, { modelName: this.modelName, maxTokens: this.maxTokens, boundTools: merged });
    return next.withConfig({ ...kwargs, tools: wrapped });
  }

  async _generate(messages, options = {}) {
    const tools = options.tools || this.boundTools;
    const toolCatalog = tools.map(definition => ({
      name: definition.function?.name || definition.name,
      description: definition.function?.description || definition.description,
      parameters: definition.function?.parameters || definition.schema,
    }));
    const protocol = toolCatalog.length ? `\nYou have tools. Decide one step at a time. Respond with exactly one JSON object and no prose:\n` +
      `{"tool":"tool_name","args":{...}} to call a tool, or {"final":"answer"} when done.\n` +
      `Available tools: ${JSON.stringify(toolCatalog)}` : '';
    const body = {
      model: this.modelName,
      temperature: 0,
      max_tokens: this.maxTokens,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: `You are a careful read-only coding agent.${protocol}` },
        ...messages.map(message => ({ role: message._getType?.() === 'human' ? 'user' : message._getType?.() === 'ai' ? 'assistant' : 'user', content: `${message.name ? `[${message.name}] ` : ''}${contentText(message)}` })),
      ],
    };
    const completion = await this.client.chat(body);
    const raw = completion?.choices?.[0]?.message?.content ?? completion;
    const decision = parseDecision(raw);
    let message;
    if (decision.tool) {
      message = new AIMessage({ content: '', tool_calls: [{ id: crypto.randomUUID(), name: decision.tool, args: decision.args || {}, type: 'tool_call' }] });
    } else {
      message = new AIMessage(String(decision.final ?? raw));
    }
    return { generations: [{ text: contentText(message), message }], llmOutput: { model: this.modelName } };
  }
}

export function createHerdrReadonlyAgent({ llmClient, guest, onActivity = () => {}, approveTest = async () => false }) {
  const guestList = tool(async ({ path }) => {
    onActivity({ tool: 'guest_list', input: { path } });
    return await guest.list(path);
  }, { name: 'guest_list', description: 'List files under the guest workspace. Read-only. Paths are relative to /root/project.', schema: z.object({ path: z.string().default('.') }) });

  const guestRead = tool(async ({ path }) => {
    onActivity({ tool: 'guest_read', input: { path } });
    return await guest.read(path);
  }, { name: 'guest_read', description: 'Read one text file from the guest workspace, maximum 64 KiB. Read-only.', schema: z.object({ path: z.string() }) });

  const guestGrep = tool(async ({ pattern, path }) => {
    onActivity({ tool: 'guest_grep', input: { pattern, path } });
    return await guest.grep(pattern, path);
  }, { name: 'guest_grep', description: 'Search guest workspace files for a fixed literal string. Read-only.', schema: z.object({ pattern: z.string(), path: z.string().default('.') }) });

  const guestTest = tool(async ({ recipe }) => {
    onActivity({ tool: 'guest_test', input: { recipe }, approval: true });
    if (!await approveTest(recipe)) return 'Test execution rejected by user.';
    return await guest.test(recipe);
  }, { name: 'guest_test', description: 'Run an explicitly approved fixed test recipe. Valid recipes: make-test, make-check, shell-tests.', schema: z.object({ recipe: z.enum(['make-test', 'make-check', 'shell-tests']) }) });

  const model = new WebGpuToolChatModel(llmClient);
  const agent = createDeepAgent({
    name: 'herdr-readonly',
    model,
    tools: [guestList, guestRead, guestGrep, guestTest],
    permissions: [{ operations: ['write'], paths: ['/**'], mode: 'deny' }],
    subagents: [],
    systemPrompt: {
      prefix: 'Inspect the guest project using only guest_list, guest_read, guest_grep, and approved guest_test. Never write, edit, delete, install, download, or claim that you changed files. Cite inspected paths in the final answer.',
      suffix: 'The real project is rooted at /root/project. Built-in virtual filesystem tools do not access it; use only guest_* tools for project evidence.',
    },
  });
  return {
    agent,
    async run(prompt, { signal } = {}) {
      onActivity({ state: 'running', prompt });
      const result = await agent.invoke({ messages: [{ role: 'user', content: prompt }] }, { signal, recursionLimit: 30 });
      const finalMessage = result.messages?.at(-1);
      const output = contentText(finalMessage || { content: 'Agent completed without a final message.' });
      onActivity({ state: 'complete', output });
      return { output, result };
    },
  };
}
