export class WebGpuLlmClient {
  constructor({ extensionId, token }) {
    if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('invalid Chrome extension ID');
    if (!token) throw new Error('pairing token is required');
    this.extensionId = extensionId;
    this.token = token;
  }

  send(payload, { withoutToken = false } = {}) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.runtime?.sendMessage) {
        reject(new Error('Chrome external messaging unavailable; reload the allow-listed extension and this page'));
        return;
      }
      const message = withoutToken ? payload : { ...payload, token: this.token };
      chrome.runtime.sendMessage(this.extensionId, message, response => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) reject(new Error(runtimeError.message));
        else if (!response?.ok) reject(new Error(response?.error || 'WebGPU LLM bridge error'));
        else resolve(response.result);
      });
    });
  }

  async pair() {
    const result = await this.send({ command: 'pair', token: this.token }, { withoutToken: true });
    if (!result?.paired) throw new Error('pairing token rejected');
    return await this.status();
  }

  status() { return this.send({ command: 'llmStatus', timeoutMs: 30_000 }); }
  models() { return this.send({ command: 'llmModels', timeoutMs: 30_000 }); }
  chat(body) { return this.send({ command: 'llmChatCompletions', body, timeoutMs: 120_000 }); }
}
