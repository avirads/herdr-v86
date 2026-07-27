// Browser-native Mastra Code harness.
//
// Implements the minimal Mastra Code MVP on top of the existing vm* bridge:
//   - Persistent threads in IndexedDB (one per tab, survives page reload)
//   - Slash commands: /exit, /stop, /reset, /help, /mode
//   - Cancellation via AbortController (wired to the controller's stop)
//   - Modes: "code" (default, tool loop), "chat" (no tools), "batch" (one-shot)
//   - Reuses the mastra-agent.js bundle's createMastraVMAgent lazily
//
// The harness is lazy: the mastra-agent.js bundle (9.7 MB) is only imported
// on the first tool-using run.  Resolve relative to this module's location —
// in the browser bundle both live in dist/, and when testing from source the
// built bundle is in ../dist/.
const MASTRA_AGENT_URLS = [
  new URL('./mastra-agent.js', import.meta.url).href,
];

const THREAD_DB_NAME = 'vmmastra-code';
const THREAD_STORE = 'threads';
const THREAD_DB_VERSION = 1;

const MODES = ['code', 'chat', 'batch'];

const SLASH_COMMANDS = {
  '/exit': { description: 'Exit the current thread and return to the shell', handler: 'exit' },
  '/stop': { description: 'Cancel the current in-flight agent response', handler: 'stop' },
  '/reset': { description: 'Drop the current thread; start fresh on next message', handler: 'reset' },
  '/help': { description: 'List available slash commands and modes', handler: 'help' },
  '/mode': { description: 'Switch mode: code | chat | batch', handler: 'mode' },
};

function openThreadDb() {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(THREAD_DB_NAME, THREAD_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(THREAD_STORE)) {
        db.createObjectStore(THREAD_STORE, { keyPath: 'id' });
      }
    };
  });
}

function generateThreadId() {
  return `thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class ThreadStore {
  constructor() {
    this.db = null;
    this.pending = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const db = await openThreadDb();
        if (!db) return null;
        this.db = db;
        return db;
      } catch (error) {
        this.pending = null;
        throw error;
      }
    })();
    return this.pending;
  }

  async save(thread) {
    if (!(await this.init())) return;
    const tx = this.db.transaction(THREAD_STORE, 'readwrite');
    tx.objectStore(THREAD_STORE).put({
      id: thread.id,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      mode: thread.mode,
      messages: thread.messages,
    });
    return tx.complete;
  }

  async load(id) {
    if (!(await this.init())) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(THREAD_STORE, 'readonly');
      const request = tx.objectStore(THREAD_STORE).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async list() {
    if (!(await this.init())) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(THREAD_STORE, 'readonly');
      const request = tx.objectStore(THREAD_STORE).getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id) {
    if (!(await this.init())) return;
    const tx = this.db.transaction(THREAD_STORE, 'readwrite');
    tx.objectStore(THREAD_STORE).delete(id);
    return tx.complete;
  }
}

export class CodeAgentHarness {
  constructor({
    guest,
    llmClient,
    browserClient = null,
    modelId = 'gemma-4-e2b',
    yolo = true,
    approveAction = async () => false,
    onActivity = () => {},
    onOutput = () => {},
    onThreadUpdate = () => {},
  } = {}) {
    if (!guest) throw new Error('CodeAgentHarness requires the guest bridge');
    if (!llmClient?.chat) throw new Error('CodeAgentHarness requires an LLM client with chat()');

    this.guest = guest;
    this.llmClient = llmClient;
    this.browserClient = browserClient;
    this.modelId = modelId;
    this.yolo = yolo;
    this.approveAction = approveAction;
    this.onActivity = onActivity;
    this.onOutput = onOutput;
    this.onThreadUpdate = onThreadUpdate;

    this.threadStore = new ThreadStore();
    this.currentThread = null;
    this.abortController = null;
    this.mode = 'code';
    this._agent = null;
    this._workspace = null;
  }

  async init() {
    await this.threadStore.init();
    await this.loadOrCreateThread();
  }

  async loadOrCreateThread(id = null) {
    let thread = id ? await this.threadStore.load(id) : null;
    if (!thread) {
      thread = {
        id: generateThreadId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        mode: this.mode,
        messages: [],
      };
    }
    this.currentThread = thread;
    this.mode = thread.mode || 'code';
    this.onThreadUpdate(thread);
    return thread;
  }

  async createNewThread() {
    const thread = {
      id: generateThreadId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      mode: this.mode,
      messages: [],
    };
    this.currentThread = thread;
    await this.threadStore.save(thread);
    this.onThreadUpdate(thread);
    return thread;
  }

  async saveThread() {
    if (!this.currentThread) return;
    this.currentThread.updatedAt = new Date();
    this.currentThread.mode = this.mode;
    await this.threadStore.save(this.currentThread);
    this.onThreadUpdate(this.currentThread);
  }

  async getAgent() {
    if (this._agent) return this._agent;
    let mod;
    for (const url of MASTRA_AGENT_URLS) {
      try {
        mod = await import(url);
        break;
      } catch {
        /* try next URL */
      }
    }
    if (!mod) {
      // Last resort: try relative to the source directory (covers Node tests
      // where import.meta.url points at src/ but the bundle is in dist/).
      try {
        const fallback = new URL('../dist/mastra-agent.js', import.meta.url).href;
        mod = await import(fallback);
      } catch {
        throw new Error('Cannot load the Mastra agent bundle. Build it with: cd agent && ./build-browser.sh src/mastra-browser.js dist/mastra-agent.js');
      }
    }
    const { createMastraVMAgent } = mod;
    const harness = createMastraVMAgent({
      guest: this.guest,
      llmClient: this.llmClient,
      browserClient: this.browserClient,
      modelId: this.modelId,
      yolo: this.yolo,
      approveAction: this.approveAction,
      onActivity: this.onActivity,
    });
    this._agent = harness;
    this._workspace = harness.workspace;
    return harness;
  }

  async listThreads() {
    return await this.threadStore.list();
  }

  async switchThread(id) {
    const thread = await this.threadStore.load(id);
    if (!thread) throw new Error(`Thread ${id} not found`);
    this.currentThread = thread;
    this.mode = thread.mode || 'code';
    this.onThreadUpdate(thread);
    return thread;
  }

  async deleteThread(id) {
    await this.threadStore.delete(id);
    if (this.currentThread?.id === id) {
      await this.createNewThread();
    }
  }

  setYolo(value) {
    this.yolo = Boolean(value);
    if (this._agent) this._agent.setYolo?.(this.yolo);
  }

  setMode(mode) {
    if (!MODES.includes(mode)) {
      throw new Error(`Unknown mode: ${mode}. Available: ${MODES.join(', ')}`);
    }
    this.mode = mode;
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async reset() {
    this.abortController?.abort();
    this.abortController = null;
    this._agent = null;
    this._workspace = null;
    await this.createNewThread();
  }

  async handleSlashCommand(input) {
    const trimmed = input.trim();
    const [cmd, ...args] = trimmed.split(/\s+/);
    const command = SLASH_COMMANDS[cmd];
    if (!command) return null;

    switch (command.handler) {
      case 'exit':
        return { type: 'exit', message: '[vmmastra-code] thread exited.' };

      case 'stop':
        this.stop();
        return { type: 'stop', message: '[vmmastra-code] stop requested.' };

      case 'reset':
        await this.reset();
        return { type: 'reset', message: '[vmmastra-code] thread reset.' };

      case 'help':
        return {
          type: 'help',
          message: this._helpText(),
        };

      case 'mode': {
        const newMode = args[0];
        if (!newMode) {
          return { type: 'mode', message: `Current mode: ${this.mode}. Available: ${MODES.join(', ')}` };
        }
        try {
          this.setMode(newMode);
          await this.saveThread();
          return { type: 'mode', message: `[vmmastra-code] mode set to ${this.mode}.` };
        } catch (error) {
          return { type: 'mode', message: error.message };
        }
      }

      default:
        return null;
    }
  }

  _helpText() {
    const lines = [
      '[vmmastra-code] Slash commands:',
      ...Object.entries(SLASH_COMMANDS).map(
        ([cmd, info]) => `  ${cmd.padEnd(12)} ${info.description}`,
      ),
      '',
      `[vmmastra-code] Modes: ${MODES.join(', ')} (current: ${this.mode})`,
      '[vmmastra-code] In "code" mode the agent uses tools; "chat" disables tools;',
      '[vmmastra-code] "batch" tries a one-shot script then falls back to the tool loop.',
    ];
    return lines.join('\n');
  }

  async run(input) {
    if (!this.currentThread) await this.init();

    const slashResult = await this.handleSlashCommand(input);
    if (slashResult) return slashResult;

    const message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    this.currentThread.messages.push(message);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      let output;

      if (this.mode === 'chat') {
        output = await this._runChat(input, signal);
      } else {
        const harness = await this.getAgent();
        if (this.mode === 'batch') {
          output = await this._runBatch(input, signal);
        } else {
          output = await this._runCode(input, signal);
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: output,
        timestamp: new Date(),
      };
      this.currentThread.messages.push(assistantMessage);
      await this.saveThread();

      return { type: 'message', content: output };
    } catch (error) {
      if (signal.aborted) {
        return { type: 'error', content: '[vmmastra-code] response cancelled.' };
      }
      return { type: 'error', content: `[vmmastra-code] error: ${error.message}` };
    } finally {
      this.abortController = null;
    }
  }

  async _runCode(input, signal) {
    if (signal?.aborted) throw new Error('cancelled');
    const harness = this._agent;
    return await harness.run(input, { batchFirst: false });
  }

  async _runChat(input, signal) {
    if (signal?.aborted) throw new Error('cancelled');
    const messages = this._buildChatMessages(input);
    const completion = await this.llmClient.chat({
      model: this.llmClient.modelName || 'webgpu',
      temperature: 0.7,
      max_tokens: 1000,
      chat_template_kwargs: { enable_thinking: false },
      messages,
    });
    return completion?.choices?.[0]?.message?.content ?? '';
  }

  async _runBatch(input, signal) {
    if (signal?.aborted) throw new Error('cancelled');
    const harness = this._agent;
    return await harness.run(input, { batchFirst: true });
  }

  _buildChatMessages(input) {
    const messages = [];
    for (const msg of this.currentThread.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    return messages;
  }

  async listTools() {
    const harness = await this.getAgent();
    return await harness.listTools();
  }

  async systemPromptCost() {
    const harness = await this.getAgent();
    return await harness.systemPromptCost();
  }
}

export async function createCodeAgentHarness(options) {
  const harness = new CodeAgentHarness(options);
  await harness.init();
  return harness;
}

export { MODES, SLASH_COMMANDS };
