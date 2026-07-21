export class AutoBroClient {
  constructor({ extensionId, token, getLlmClient = () => null }) {
    if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('invalid AutoBro extension ID');
    if (!token) throw new Error('AutoBro pairing token is required');
    this.extensionId = extensionId;
    this.token = token;
    this.getLlmClient = getLlmClient;
    this.llmPort = null;
  }

  send(payload, { withoutToken = false } = {}) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.runtime?.sendMessage) return reject(new Error('Chrome external messaging unavailable'));
      chrome.runtime.sendMessage(this.extensionId, withoutToken ? payload : { ...payload, token: this.token }, response => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) reject(new Error(runtimeError.message));
        else if (!response?.ok) reject(new Error(response?.error || 'AutoBro command failed'));
        else resolve(response.result);
      });
    });
  }

  async pair() {
    const result = await this.send({ command: 'pair', token: this.token }, { withoutToken: true });
    if (!result?.paired) throw new Error('AutoBro pairing token rejected');
    const health = await this.command('health');
    this.connectLlmProvider();
    return health;
  }

  connectLlmProvider() {
    if (!globalThis.chrome?.runtime?.connect || this.llmPort) return;
    const port = chrome.runtime.connect(this.extensionId, { name: 'herdr-llm-provider' });
    this.llmPort = port;
    port.onMessage.addListener(async message => {
      if (message?.type !== 'llm-request') return;
      try {
        const client = this.getLlmClient();
        if (!client) throw new Error('VM page-local WebGPU LLM is not initialized');
        let result;
        if (message.method === 'status') result = await client.status();
        else if (message.method === 'models') result = await client.models();
        else if (message.method === 'chat') result = await client.chat(message.body || {});
        else throw new Error(`unsupported VM LLM method: ${message.method}`);
        port.postMessage({ type: 'llm-response', id: message.id, ok: true, result });
      } catch (error) {
        port.postMessage({ type: 'llm-response', id: message.id, ok: false, error: error?.message || String(error) });
      }
    });
    port.onDisconnect.addListener(() => { if (this.llmPort === port) this.llmPort = null; });
    port.postMessage({ type: 'llm-provider-hello', token: this.token });
  }

  disconnect() {
    try { this.llmPort?.disconnect(); } catch {}
    this.llmPort = null;
  }

  command(command, parameters = {}, timeoutMs = 30_000) {
    return this.send({ ...parameters, command, timeoutMs });
  }
}
