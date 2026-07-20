// First-party LiteRT-LM WebGPU provider. Models are stored in this page's OPFS;
// no extension, native process, API key, or guest network is involved.
const LAST_MODEL_KEY = 'herdr.litert.lastModel';
const MAX_CONTEXT_TOKENS = 16384;

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(item => item?.text ?? '').join('');
  return String(content ?? '');
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
  }

  activity(message, progress = null) {
    this.dispatchEvent(new CustomEvent('activity', { detail: { message, progress } }));
  }

  async initialize({ autoLoad = true } = {}) {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser');
    try {
      const runtime = await import('../../llm/vendor/litert-lm/dist/index.js');
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
    }
    return await this.status();
  }

  async ensureWasm() {
    if (this.wasmLoaded) return;
    this.activity('loading LiteRT-LM WebAssembly runtime');
    const wasmDirectory = new URL('../../llm/vendor/litert-lm/wasm/', import.meta.url).href;
    await this.loadLiteRtLm(wasmDirectory);
    this.wasmLoaded = true;
  }

  async modelsDirectory(create = false) {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle('herdr-litert-models', { create });
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

  async loadCachedModel(name) {
    const directory = await this.modelsDirectory();
    const file = await (await directory.getFileHandle(name)).getFile();
    await this.createEngine(file, name);
  }

  async createEngine(source, name) {
    await this.ensureWasm();
    if (this.engine) await this.engine.delete?.();
    this.engine = null;
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

  async chat(body) {
    if (!this.engine) throw new Error('no page-local LiteRT-LM model loaded; use Configure LLM');
    const messages = body?.messages || [];
    if (!messages.length) throw new Error('messages required');
    const last = messages[messages.length - 1];
    const preface = messages.slice(0, -1).map(message => ({ role: message.role, content: contentToText(message.content) }));
    const conversation = await this.engine.createConversation(preface.length ? { preface: { messages: preface } } : {});
    try {
      const response = await conversation.sendMessage(contentToText(last.content));
      const content = (response?.content || []).filter(item => item?.text !== undefined).map(item => item.text).join('');
      return {
        id: `litertlm-${Date.now()}`,
        object: 'chat.completion',
        model: this.modelName,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      };
    } finally {
      conversation.delete?.();
    }
  }
}
