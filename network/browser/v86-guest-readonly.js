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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

export class V86GuestReadonlyClient extends EventTarget {
  constructor(emulator, hostBridge, { timeoutMs = 30_000, rpcSerial = 0 } = {}) {
    super();
    this.emulator = emulator;
    this.hostBridge = hostBridge;
    this.timeoutMs = timeoutMs;
    this.rpcSerial = rpcSerial;
    this.workspace = '/root/project';
    this.line = '';
    this.nextId = 0;
    this.pending = new Map();
    this.inFlight = 0;
    this.queue = Promise.resolve();
    this.onByte = byte => this.consume(byte);
    emulator.add_listener(`serial${rpcSerial}-output-byte`, this.onByte);
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
    if (!waiter) {
      // A response nobody is waiting for. The usual cause is a split line:
      // anything else written to this tty while vmagent-rpc is running gets
      // echoed by the getty and interleaves with its output, so the id no
      // longer matches and the real reply is lost. Announce it — returning
      // quietly turns that into an unexplained timeout 30 s later.
      this.dispatchEvent(new CustomEvent('orphan-response', { detail: { line } }));
      return;
    }
    this.pending.delete(id);
    clearTimeout(waiter.timer);
    try {
      const value = decode(payload || '');
      if (status === 'OK') waiter.resolve(value);
      else waiter.reject(new Error(value || 'guest RPC failed'));
    } catch (error) {
      // The timer is already cleared, so without this the promise would never
      // settle at all — a hang rather than a failure.
      waiter.reject(new Error(`guest ${id} response was not decodable: ${error.message}`));
    }
  }

  /**
   * True from the moment a call is queued until its reply lands.
   *
   * Callers that also write to this serial line — a poller, say — must hold off
   * while it is set. The RPC's tty echoes everything typed at it, so a
   * concurrent write interleaves with `vmagent-rpc`'s output and destroys the
   * response line. Counted rather than derived from `pending`, which is only
   * populated once the queue reaches the call.
   */
  get busy() { return this.inFlight > 0; }

  request(operation, ...args) {
    this.inFlight += 1;
    const run = async () => {
      const id = `agent-${Date.now()}-${++this.nextId}`;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`guest ${operation} timed out`)); }, this.timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
      });
      const command = [
        `VMAGENT_WORKSPACE=${shellQuote(this.workspace)}`,
        'vmagent-rpc',
        id,
        operation,
        ...args.map(value => encode(value)),
      ].join(' ');
      this.dispatchEvent(new CustomEvent('activity', { detail: { operation, args } }));
      await this.hostBridge.send(command, this.rpcSerial);
      return await response;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result.finally(() => { this.inFlight -= 1; });
  }

  list(path = '.') { return this.request('list', path); }
  read(path) { return this.request('read', path); }
  grep(pattern, path = '.') { return this.request('grep', pattern, path); }
  glob(pattern, path = '.') { return this.request('glob', pattern, path); }
  write(path, content) { return this.request('write', path, content); }
  delete(path) { return this.request('delete', path); }
  execute(command) { return this.request('execute', command); }
  test(recipe) { return this.request('test', recipe); }
  setWorkspace(path) {
    const value = String(path || '');
    if (!value.startsWith('/') || /[\r\n]/.test(value)) throw new Error('guest workspace must be an absolute path');
    this.workspace = value;
  }

  destroy() { this.emulator.remove_listener?.(`serial${this.rpcSerial}-output-byte`, this.onByte); }
}

// Preferred name now that the RPC supports the complete coding-agent backend.
export { V86GuestReadonlyClient as V86GuestAgentClient };
