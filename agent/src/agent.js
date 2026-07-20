import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { MemorySaver } from '@langchain/langgraph';
import { createDeepAgent } from 'deepagents/browser';
import { z } from 'zod';
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function commandResult(response) {
  const match = String(response).match(/^__V86AGENT_EXIT__(\d+)\n?/);
  const output = match ? response.slice(match[0].length) : String(response);
  if (match && Number(match[1]) !== 0) throw new Error(`guest command exited ${match[1]}: ${output}`);
  return output;
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
  get profile() { return { maxInputTokens: 16384, maxOutputTokens: this.maxTokens, toolCalling: true }; }
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

export function createHerdrAgent({ llmClient, guest, browserClient = null, onActivity = () => {}, approveAction = async () => false, sessionId = crypto.randomUUID() }) {
  const model = new WebGpuToolChatModel(llmClient);
  const backend = new V86DeepAgentsBackend(guest, { approve: approveAction, onActivity });
  const approvedCommand = async (toolName, detail, command) => {
    onActivity({ tool: toolName, detail, approval: true });
    if (!await approveAction(toolName, detail)) return 'Operation rejected by user.';
    try { return commandResult(await guest.execute(command)); }
    catch (error) { return `Error: ${error.message}`; }
  };
  const vmfetch = tool(async ({ url, output, method, headers, data }) => {
    if (/^https?:\/\/(?:www\.)?(?:google\.[^/]+|bing\.com|duckduckgo\.com)(?:\/|$)/i.test(url)) {
      return browserClient
        ? 'Interactive search sites cannot be fetched because of CORS. Use browser_search or autobro_command instead.'
        : 'Interactive search sites cannot be fetched because of CORS. AutoBro is not connected; use Connect AutoBro in the VM header.';
    }
    const command = ['vmfetch', '-o', shellQuote(output), '-X', shellQuote(method), ...headers.flatMap(header => ['-H', shellQuote(header)]), ...(data == null ? [] : ['-d', shellQuote(data)]), shellQuote(url)].join(' ');
    return await approvedCommand('vmfetch', { url, output, method, headers, hasBody: data != null }, command);
  }, { name: 'vmfetch', description: 'Fetch a CORS-enabled HTTP API/resource when the guest has no route. This cannot operate interactive websites, scrape Google Search, bypass CORS, click pages, or automate a browser. HTTPS/localhost only; 16 MiB limit. Requires approval.', schema: z.object({ url: z.string().url(), output: z.string().default('-'), method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'), headers: z.array(z.string()).default([]), data: z.string().optional() }) });
  const vmgithub = tool(async ({ action, repository, path, ref, output }) => {
    let command;
    if (action === 'repo') command = `vmgithub repo ${shellQuote(repository)}`;
    else if (action === 'api') command = `vmgithub api ${shellQuote(path)}`;
    else command = `vmgithub archive ${shellQuote(repository)} ${shellQuote(ref)} ${shellQuote(output)}`;
    return await approvedCommand('vmgithub', { action, repository, path, ref, output }, command);
  }, { name: 'vmgithub', description: 'Read GitHub metadata/API or download a repository archive through browser fetch. Not full Git; CORS/rate limits apply. Requires approval.', schema: z.object({ action: z.enum(['repo', 'api', 'archive']), repository: z.string().default(''), path: z.string().default(''), ref: z.string().default('HEAD'), output: z.string().default('source.tar.gz') }) });
  const vmclip = tool(async ({ action, text }) => {
    const command = action === 'read' ? 'vmclip read' : `printf %s ${shellQuote(text || '')} | vmclip write`;
    return await approvedCommand('vmclip', { action, textLength: text?.length || 0 }, command);
  }, { name: 'vmclip', description: 'Read or write the system clipboard through the browser. Browser permission/user gesture may be required. Requires approval.', schema: z.object({ action: z.enum(['read', 'write']), text: z.string().optional() }) });
  const vmexport = tool(async ({ path }) => await approvedCommand('vmexport', { path }, `vmexport ${shellQuote(path)}`), {
    name: 'vmexport', description: 'Download one guest file through the browser, maximum 8 MiB. Requires approval.', schema: z.object({ path: z.string() }),
  });
  const vmai = tool(async ({ prompt, model, baseUrl }) => {
    const environment = `${model ? `OPENAI_MODEL=${shellQuote(model)} ` : ''}${baseUrl ? `OPENAI_BASE_URL=${shellQuote(baseUrl)} ` : ''}`;
    return await approvedCommand('vmai', { model, baseUrl, promptLength: prompt.length }, `${environment}vmai ${shellQuote(prompt)}`);
  }, { name: 'vmai', description: 'Call an OpenAI-compatible Responses API using the guest OPENAI_API_KEY and browser fetch. Never exposes the key to the model. Requires approval.', schema: z.object({ prompt: z.string(), model: z.string().optional(), baseUrl: z.string().url().optional() }) });
  const vmllmInfo = tool(async ({ operation }) => commandResult(await guest.execute(`vmllm ${operation}`)), {
    name: 'vmllm_info', description: 'Inspect the page-local LiteRT-LM status or cached model list. Chat is intentionally excluded to avoid recursive inference.', schema: z.object({ operation: z.enum(['status', 'models']) }),
  });
  const browserTools = [];
  if (browserClient) browserTools.push(tool(async ({ query, engine }) => {
    const base = engine === 'bing' ? 'https://www.bing.com/search?q=' : engine === 'duckduckgo' ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q=';
    const url = base + encodeURIComponent(query);
    const detail = { engine, query, url };
    onActivity({ tool: 'browser_search', detail, approval: true });
    if (!await approveAction('browser_search', detail)) return 'Browser search rejected by user.';
    try {
      const tab = await browserClient.command('newTab', { url }, 120_000);
      await browserClient.command('waitForLoad', { tabId: tab.tabId, timeout: 20 }, 30_000).catch(() => undefined);
      const page = await browserClient.command('pageInfo', { tabId: tab.tabId }, 30_000).catch(() => tab);
      return JSON.stringify({ engine, query, tab, page });
    } catch (error) { return `Browser search error: ${error.message}`; }
  }, {
    name: 'browser_search', description: 'Search Google, Bing, or DuckDuckGo in a real AutoBro-controlled Chrome tab. Use this—not vmfetch—when asked to go to a search engine or search the web. Requires approval unless YOLO is active.', schema: z.object({ query: z.string(), engine: z.enum(['google', 'bing', 'duckduckgo']).default('google') }),
  }));
  if (browserClient) browserTools.push(tool(async ({ command, parameters }) => {
    const detail = { command, parameters };
    onActivity({ tool: 'autobro_command', detail, approval: true });
    if (!await approveAction('autobro_command', detail)) return 'Browser operation rejected by user.';
    let result;
    try { result = await browserClient.command(command, parameters, 120_000); }
    catch (error) { return `AutoBro error: ${error.message}`; }
    if (command === 'captureScreenshot' && result?.data) return JSON.stringify({ ...result, data: '<omitted from text context>', byteLength: Math.ceil(result.data.length * 3 / 4) });
    const output = typeof result === 'string' ? result : JSON.stringify(result);
    return output.length > 60000 ? `${output.slice(0, 60000)}\n[AutoBro result truncated]` : output;
  }, {
    name: 'autobro_command',
    description: 'Control the user-authorized Chrome browser through AutoBro bridge-v3. Commands: health, listTabs, newTab, switchTab, ensureRealTab, activeTab, currentTab, closeTab, gotoUrl, pageInfo, inventoryCurrentPage, visibleActions, relatedActions, extractMessages, extractGrids, findSearchAction, fillInput, setSelect, elementState, dispatchKey, showWidget, clickAtXY, typeText, pressKey, scroll, waitForLoad, waitForElement, waitNetworkIdle, pendingDialog, acceptDialog, captureScreenshot, highlightElement, js, cdp, uploadFile, localLogin, skills. Pass command fields in parameters (for example {url}, {tabId}, {x,y}, {text}, {selector}, or {args:[...]}). Every call requires approval unless YOLO is active.',
    schema: z.object({ command: z.string(), parameters: z.record(z.string(), z.unknown()).default({}) }),
  }));
  const agent = createDeepAgent({
    name: 'herdr-coding-agent',
    model,
    tools: [vmfetch, vmgithub, vmclip, vmexport, vmai, vmllmInfo, ...browserTools],
    backend,
    checkpointer: new MemorySaver(),
    generalPurposeAgent: true,
    memory: ['/AGENTS.md'],
    skills: ['/skills/'],
    systemPrompt: {
      prefix: 'Work autonomously on the project using Deep Agents planning, filesystem, shell, and delegation tools. Inspect before editing, make focused changes, run relevant verification, and report evidence. Mutations and shell commands require user approval at execution time. Use browser_search or autobro_command for search engines, rendered pages, navigation, clicks, and typing. Use vmfetch only for CORS-enabled HTTP APIs/resources; never use it for Google Search or interactive websites.',
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
