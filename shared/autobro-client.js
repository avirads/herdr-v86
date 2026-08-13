function sendToExtension(extensionId, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.runtime?.sendMessage) return reject(new Error('Chrome external messaging unavailable'));
    let settled = false;
    const timer = timeoutMs > 0 ? setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('AutoBro extension did not respond in time'));
    }, timeoutMs) : null;
    chrome.runtime.sendMessage(extensionId, payload, response => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) reject(new Error(runtimeError.message));
      else if (!response?.ok) reject(new Error(response?.error || 'AutoBro command failed'));
      else resolve(response.result);
    });
  });
}

// Detects whether the AutoBro extension is installed and reachable at a
// known, fixed ID (pinned via the extension's manifest "key"), without
// needing a pairing token. Reuses the 'pair' command with no token: it
// always answers { paired: false } for a missing/wrong token rather than
// throwing, so a successful round trip alone proves the extension exists.
export async function probeAutoBro(extensionId, timeoutMs = 1500) {
  try {
    await sendToExtension(extensionId, { command: 'pair', token: '' }, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

// One-click pairing: asks the extension to prompt whoever is physically at
// this device to approve the connection via a native browser notification,
// instead of the user copying a token out of the extension panel and typing
// it in here. Resolves the granted token on approval.
export async function requestAutoBroPairing(extensionId, timeoutMs = 65_000) {
  const result = await sendToExtension(extensionId, { command: 'requestPairing' }, timeoutMs);
  if (!result?.paired || !result.token) throw new Error(result?.reason || 'AutoBro pairing request was not approved');
  return result.token;
}

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
