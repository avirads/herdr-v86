export class AutoBroClient {
  constructor({ extensionId, token }) {
    if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('invalid AutoBro extension ID');
    if (!token) throw new Error('AutoBro pairing token is required');
    this.extensionId = extensionId;
    this.token = token;
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
    return await this.command('health');
  }

  command(command, parameters = {}, timeoutMs = 30_000) {
    return this.send({ ...parameters, command, timeoutMs });
  }
}
