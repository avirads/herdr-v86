// First-party LiteRT-LM WebGPU provider. Models are stored in this page's OPFS;
// no extension, native process, API key, or guest network is involved.
import { parseNamedCall, relaxedJsonParse, stripToolDelimiters } from '../agent/src/tool-call-syntax.js';

const LAST_MODEL_KEY = 'vm.litert.lastModel';
const MAX_CONTEXT_TOKENS = 16384;
const STREAM_END_TOKENS = ['<eos>', '<end_of_turn>', '<|end_of_text|>', '<|eot_id|>'];
const STREAM_SKIP_TOKENS = ['<pad>', '<bos>'];
const MAX_CONSECUTIVE_PAD_TOKENS = 8;
const MAX_STREAM_CHARS = 65536;

// LiteRT normally consumes model control tokens internally, but some model /
// runtime combinations surface them as text and can emit <pad> indefinitely.
// Retain a possible partial token between chunks so none of it reaches the UI.
export class StreamingTextFilter {
  constructor(endTokens = STREAM_END_TOKENS, skipTokens = STREAM_SKIP_TOKENS) {
    this.endTokens = endTokens.map(token => token.toLowerCase());
    this.skipTokens = skipTokens.map(token => token.toLowerCase());
    this.tokens = [...this.endTokens, ...this.skipTokens];
    this.pending = '';
    this.stopped = false;
    this.consecutivePads = 0;
  }

  push(value) {
    if (this.stopped) return { text: '', stop: true };
    let combined = this.pending + String(value ?? '');
    let output = '';
    this.pending = '';
    for (;;) {
      const lower = combined.toLowerCase();
      let match = null;
      for (const token of this.tokens) {
        const index = lower.indexOf(token);
        if (index >= 0 && (!match || index < match.index)) match = { token, index };
      }
      if (!match) break;
      const visible = combined.slice(0, match.index);
      if (visible) {
        output += visible;
        this.consecutivePads = 0;
      }
      combined = combined.slice(match.index + match.token.length);
      if (this.endTokens.includes(match.token)) {
        this.stopped = true;
        return { text: output, stop: true };
      }
      if (match.token === '<pad>') {
        this.consecutivePads++;
        if (this.consecutivePads >= MAX_CONSECUTIVE_PAD_TOKENS) {
          this.stopped = true;
          return { text: output, stop: true };
        }
      }
    }
    let retained = 0;
    const lower = combined.toLowerCase();
    const max = Math.min(combined.length, Math.max(...this.tokens.map(token => token.length)) - 1);
    for (let length = 1; length <= max; length++) {
      const suffix = lower.slice(-length);
      if (this.tokens.some(token => token.startsWith(suffix))) retained = length;
    }
    this.pending = retained ? combined.slice(-retained) : '';
    const visible = retained ? combined.slice(0, -retained) : combined;
    if (visible) this.consecutivePads = 0;
    return { text: output + visible, stop: false };
  }

  flush() {
    const text = this.stopped ? '' : this.pending;
    this.pending = '';
    return text;
  }
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(item => item?.text ?? '').join('');
  return String(content ?? '');
}

function messageToText(message) {
  if (message?.role === 'tool') {
    return `[tool result${message.name ? ` from ${message.name}` : ''}]: ${contentToText(message.content)}`;
  }
  if (message?.tool_calls?.length) {
    return `[assistant tool calls]: ${JSON.stringify(message.tool_calls)}`;
  }
  return contentToText(message?.content);
}

/**
 * Recover a tool call from whatever the model actually emitted.
 *
 * The grammar this accepts, and why, lives in tool-call-syntax.js — shared with
 * the vmlang tier so the two cannot drift on what counts as a tool call.
 */
export function parseToolCall(content) {
  const raw = String(content ?? '').trim();
  if (!raw) return undefined;
  const unfenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] || raw;
  const { text: stripped, delimited } = stripToolDelimiters(unfenced);
  if (!stripped) return undefined;

  const named = parseNamedCall(stripped);
  if (named) return named;

  const value = relaxedJsonParse(stripped);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  // Unwrapped `{"name":…,"arguments":…}` counts only when the model framed it
  // as a tool call. Without that signal it is indistinguishable from a JSON
  // answer that happens to carry a `name` field.
  const call = value.tool_call || value.toolCall || (delimited ? value : undefined);
  if (!call?.name) return undefined;

  // Real gemma-4-E2B output sometimes omits the arguments wrapper and puts the
  // parameters straight on the call: {"tool_call":{"name":"x","path":"/a.md"}}.
  // Bailing out here turned that into plain assistant text and the tool never
  // ran, so treat the leftover keys as the arguments.
  let callArguments = call.arguments;
  if (typeof callArguments !== 'object' || callArguments === null || Array.isArray(callArguments)) {
    const leftover = Object.fromEntries(
      Object.entries(call).filter(([key]) => key !== 'name' && key !== 'arguments'),
    );
    if (!Object.keys(leftover).length) return undefined;
    callArguments = leftover;
  }
  return { name: call.name, arguments: callArguments };
}

export function completionWithToolCall(completion) {
  const choice = completion?.choices?.[0];
  const call = parseToolCall(choice?.message?.content);
  if (!call) return completion;
  choice.message = {
    role: 'assistant',
    content: null,
    tool_calls: [{
      id: `call_${Date.now().toString(36)}`,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
    }],
  };
  choice.finish_reason = 'tool_calls';
  return completion;
}

export class LiteRtLmClient extends EventTarget {
  constructor() {
    super();
    this.Engine = null;
    this.loadLiteRtLm = null;
    this.wasmLoaded = false;
    this.engine = null;
    this.modelName = null;
    this.loading = null;
    this.runtimeError = null;
    // Reused across turns so the engine keeps the conversation's KV cache
    // instead of re-prefilling the whole history on every call.
    this._session = null;
    this._chatLock = Promise.resolve();
    this.reuseSessions = true;
  }

  activity(message, progress = null) {
    this.dispatchEvent(new CustomEvent('activity', { detail: { message, progress } }));
  }

  async initialize({ autoLoad = true, bundledModelUrl = '' } = {}) {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser');
    try {
      const runtime = await import('../llm/vendor/litert-lm/dist/index.js');
      this.Engine = runtime.Engine;
      this.loadLiteRtLm = runtime.loadLiteRtLm;
    } catch (error) {
      this.runtimeError = error?.message || String(error);
      throw new Error(`LiteRT-LM runtime failed to load: ${this.runtimeError}`);
    }
    if (autoLoad) {
      const models = await this.cachedModelNames();
      const remembered = localStorage.getItem(LAST_MODEL_KEY);
      const name = models.includes(remembered) ? remembered : models[0];
      if (name) await this.loadCachedModel(name);
      else if (bundledModelUrl) await this.loadBundledModel(bundledModelUrl);
    }
    return await this.status();
  }

  async loadBundledModel(url) {
    const name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop()) || 'bundled-model.litertlm';
    this.activity(`loading bundled model ${name}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`bundled model request failed: HTTP ${response.status}`);
    const source = await response.blob();
    await this.createEngine(source, name);
  }

  async ensureWasm() {
    if (this.wasmLoaded) return;
    this.activity('loading LiteRT-LM WebAssembly runtime');
    const wasmDirectory = new URL('../llm/vendor/litert-lm/wasm/', import.meta.url).href;
    await this.loadLiteRtLm(wasmDirectory);
    this.wasmLoaded = true;
  }

  async modelsDirectory(create = false) {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle('vm-litert-models', { create });
  }

  async cachedModelNames() {
    const names = [];
    try {
      const directory = await this.modelsDirectory();
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === 'file' && /\.(litertlm|task)$/i.test(name)) names.push(name);
      }
    } catch (error) {
      if (error?.name !== 'NotFoundError') throw error;
    }
    return names.sort();
  }

  async importModel(file) {
    if (!/\.(litertlm|task)$/i.test(file.name)) throw new Error('select a .litertlm or .task model');
    const directory = await this.modelsDirectory(true);
    const handle = await directory.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    const reader = file.stream().getReader();
    let written = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        written += value.byteLength;
        this.activity(`caching ${file.name}: ${(written / 1e6).toFixed(0)} / ${(file.size / 1e6).toFixed(0)} MB`, file.size ? written / file.size : null);
      }
      await writable.close();
    } catch (error) {
      await writable.abort?.();
      await directory.removeEntry(file.name).catch(() => undefined);
      throw error;
    }
    await this.loadCachedModel(file.name);
  }

  async reset() {
    await this.engine?.delete?.();
    this.engine = null;
    this._session = null;
    this.modelName = null;
    this.loading = null;
    localStorage.removeItem(LAST_MODEL_KEY);
    try {
      const directory = await this.modelsDirectory();
      const names = [];
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === 'file') names.push(name);
      }
      for (const name of names) await directory.removeEntry(name);
    } catch (error) {
      if (error?.name !== 'NotFoundError') throw error;
    }
    this.activity('model configuration reset');
  }

  async loadCachedModel(name) {
    const directory = await this.modelsDirectory();
    const file = await (await directory.getFileHandle(name)).getFile();
    await this.createEngine(file, name);
  }

  async createEngine(source, name) {
    await this.ensureWasm();
    if (this.engine) await this.engine.delete?.();
    this.engine = null;
    this._session = null;
    this.modelName = null;
    this.loading = name;
    this.activity(`loading ${name}; first load compiles WebGPU kernels`);
    try {
      this.engine = await this.Engine.create({
        model: source,
        mainExecutorSettings: { maxNumTokens: MAX_CONTEXT_TOKENS },
      });
      this.modelName = name;
      localStorage.setItem(LAST_MODEL_KEY, name);
      await navigator.storage.persist?.();
      this.activity(`ready — ${name}`, 1);
    } finally {
      this.loading = null;
    }
  }

  async status() {
    return {
      runtimeLoaded: Boolean(this.Engine),
      webgpu: Boolean(navigator.gpu),
      modelName: this.modelName,
      loading: this.loading,
      provider: 'page-local-litert-lm',
      maxContextTokens: MAX_CONTEXT_TOKENS,
    };
  }

  async models() {
    const cached = await this.cachedModelNames();
    return { object: 'list', data: cached.map(id => ({ id, object: 'model', owned_by: 'page-local-litert-lm', loaded: id === this.modelName })) };
  }

  // OpenAI-compatible: takes the full messages array and returns a completion.
  // Internally it keeps the engine conversation alive across turns, so a growing
  // agent history is not re-prefilled from scratch on every call. Serialized so
  // concurrent callers cannot corrupt the shared session.
  async chat(body) {
    const run = this._chatLock.then(() => this._chat(body), () => this._chat(body));
    this._chatLock = run.then(() => {}, () => {});
    return run;
  }

  async _send(conversation, text) {
    const response = await conversation.sendMessage(text);
    return (response?.content || []).filter(item => item?.text !== undefined).map(item => item.text).join('');
  }

  _completion(content) {
    return completionWithToolCall({
      id: `litertlm-${Date.now()}`,
      object: 'chat.completion',
      model: this.modelName,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    });
  }

  // Flatten OpenAI messages into engine turns. `input` marks user/system-side
  // messages we actually send; assistant messages are model outputs the live
  // conversation already holds, so they are never re-sent, only compared.
  _normalize(body) {
    const messages = [...(body?.messages || [])];
    if (!messages.length) throw new Error('messages required');
    if (body?.tools?.length) {
      const tools = body.tools.map(tool => tool?.function || tool).filter(Boolean);
      const required = body.tool_choice === 'required' || body.toolChoice === 'required';
      messages.unshift({
        role: 'system',
        content: `${required ? 'You MUST call exactly one tool in this response. Do not answer with text.' : 'You can call tools. When a tool is needed,'} output only one JSON object with this exact shape: {"tool_call":{"name":"tool_name","arguments":{}}}. Never wrap it in prose. Available tools: ${JSON.stringify(tools)}`,
      });
    }
    return messages.map(message => {
      const role = message.role === 'tool' ? 'user' : message.role;
      const text = messageToText(message);
      return { role, text, key: `${role} ${text}`, input: role !== 'assistant' };
    });
  }

  async _rebuild(norm, systemKey) {
    await this._session?.conversation?.delete?.().catch(() => undefined);
    this._session = null;
    const preface = norm.slice(0, -1).map(unit => ({ role: unit.role, content: unit.text }));
    const conversation = await this.engine.createConversation(preface.length ? { preface: { messages: preface } } : {});
    const content = await this._send(conversation, norm[norm.length - 1].text);
    this._session = { conversation, norm: norm.slice(), systemKey };
    return this._completion(content);
  }

  async _chat(body) {
    if (!this.engine) throw new Error('no page-local LiteRT-LM model loaded; use Configure LLM');
    const norm = this._normalize(body);
    const systemKey = norm.filter(unit => unit.role === 'system').map(unit => unit.key).join('|');
    const session = this._session;
    const extendsSession = this.reuseSessions && session
      && session.systemKey === systemKey
      && session.norm.length < norm.length
      && session.norm.every((unit, index) => unit.key === norm[index].key);

    if (extendsSession) {
      const delta = norm.slice(session.norm.length);
      const inputs = delta.filter(unit => unit.input);
      // Only the standard "one new user/tool turn" increment can stream into the
      // live conversation; anything else re-prefaces to stay correct.
      if (inputs.length === 1 && delta[delta.length - 1].input) {
        try {
          const content = await this._send(session.conversation, inputs[0].text);
          session.norm = norm.slice();
          return this._completion(content);
        } catch (error) {
          this.activity(`session reuse fell back to rebuild: ${error?.message || error}`);
        }
      }
    }
    return this._rebuild(norm, systemKey);
  }

  async chatStream(body, onChunk) {
    if (!this.engine) throw new Error('no page-local LiteRT-LM model loaded; use Configure LLM');
    const messages = body?.messages || [];
    if (!messages.length) throw new Error('messages required');
    const last = messages[messages.length - 1];
    const preface = messages.slice(0, -1).map(message => ({ role: message.role, content: contentToText(message.content) }));
    const conversation = await this.engine.createConversation(preface.length ? { preface: { messages: preface } } : {});
    let content = '';
    const filter = new StreamingTextFilter();
    try {
      const reader = conversation.sendMessageStreaming(contentToText(last.content)).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const filtered = filter.push(contentToText(value?.content));
        const delta = filtered.text.slice(0, MAX_STREAM_CHARS - content.length);
        if (delta) {
          content += delta;
          await onChunk?.(delta);
        }
        const lengthLimitReached = content.length >= MAX_STREAM_CHARS;
        if (filtered.stop || lengthLimitReached) {
          await reader.cancel(filtered.stop ? 'model emitted a terminal token' : 'response length limit reached').catch(() => undefined);
          break;
        }
      }
      const tail = filter.flush();
      if (tail && content.length < MAX_STREAM_CHARS) {
        content += tail;
        await onChunk?.(tail);
      }
      return {
        id: `litertlm-${Date.now()}`,
        object: 'chat.completion',
        model: this.modelName,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      };
    } finally {
      await conversation.delete?.();
    }
  }
}
