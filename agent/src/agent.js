import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { MemorySaver } from '@langchain/langgraph';
import { createDeepAgent } from 'deepagents/browser';
import { V86DeepAgentsBackend } from './guest-backend.js';

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
        { role: 'system', content: `You are a capable coding agent operating in a sandboxed 32-bit Linux guest. Use tools methodically and obtain required approvals.${protocol}` },
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

export function createHerdrAgent({ llmClient, guest, onActivity = () => {}, approveAction = async () => false, sessionId = crypto.randomUUID() }) {
  const model = new WebGpuToolChatModel(llmClient);
  const backend = new V86DeepAgentsBackend(guest, { approve: approveAction, onActivity });
  const agent = createDeepAgent({
    name: 'herdr-coding-agent',
    model,
    backend,
    checkpointer: new MemorySaver(),
    generalPurposeAgent: true,
    memory: ['/AGENTS.md'],
    skills: ['/skills/'],
    systemPrompt: {
      prefix: 'Work autonomously on the project using Deep Agents planning, filesystem, shell, and delegation tools. Inspect before editing, make focused changes, run relevant verification, and report evidence. Mutations and shell commands require user approval at execution time.',
      suffix: 'The backend maps Deep Agents path / to the real guest workspace /root/project. The guest is Alpine Linux i386 with BusyBox sh. Do not claim success without reading results and running proportionate checks.',
    },
  });
  return {
    agent,
    async run(prompt, { signal } = {}) {
      onActivity({ state: 'running', prompt });
      const result = await agent.invoke({ messages: [{ role: 'user', content: prompt }] }, { signal, recursionLimit: 60, configurable: { thread_id: sessionId } });
      const finalMessage = result.messages?.at(-1);
      const output = contentText(finalMessage || { content: 'Agent completed without a final message.' });
      onActivity({ state: 'complete', output });
      return { output, result, sessionId };
    },
  };
}

// Backward-compatible export for existing integrations. It now creates the
// full-capability agent and still requires approval for every mutating action.
export const createHerdrReadonlyAgent = createHerdrAgent;
