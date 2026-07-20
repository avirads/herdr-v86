const RESPONSE_PREFIX = '__V86AGENT_RESPONSE__\t';

function encode(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value) {
  const binary = atob(value);
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

export class V86GuestReadonlyClient extends EventTarget {
  constructor(emulator, hostBridge, { timeoutMs = 30_000 } = {}) {
    super();
    this.emulator = emulator;
    this.hostBridge = hostBridge;
    this.timeoutMs = timeoutMs;
    this.line = '';
    this.nextId = 0;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.onByte = byte => this.consume(byte);
    emulator.add_listener('serial0-output-byte', this.onByte);
  }

  consume(byte) {
    const character = String.fromCharCode(byte);
    if (character !== '\n') { this.line = (this.line + character).slice(-131072); return; }
    const line = this.line.replace(/\r$/, '');
    this.line = '';
    const marker = line.indexOf(RESPONSE_PREFIX);
    if (marker < 0) return;
    const [id, status, payload] = line.slice(marker + RESPONSE_PREFIX.length).split('\t');
    const waiter = this.pending.get(id);
    if (!waiter) return;
    this.pending.delete(id);
    clearTimeout(waiter.timer);
    const value = decode(payload || '');
    if (status === 'OK') waiter.resolve(value);
    else waiter.reject(new Error(value || 'guest RPC failed'));
  }

  request(operation, ...args) {
    const run = async () => {
      const id = `agent-${Date.now()}-${++this.nextId}`;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`guest ${operation} timed out`)); }, this.timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
      });
      const command = ['vmagent-rpc', id, operation, ...args.map(value => encode(value))].join(' ');
      this.dispatchEvent(new CustomEvent('activity', { detail: { operation, args } }));
      await this.hostBridge.send(command);
      return await response;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  list(path = '.') { return this.request('list', path); }
  read(path) { return this.request('read', path); }
  grep(pattern, path = '.') { return this.request('grep', pattern, path); }
  test(recipe) { return this.request('test', recipe); }

  destroy() { this.emulator.remove_listener?.('serial0-output-byte', this.onByte); }
}
