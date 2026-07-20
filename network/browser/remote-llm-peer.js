const REQUEST_TIMEOUT_MS = 120000;

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function send(connection, message) {
  if (!connection?.open) throw new Error('remote connection is not open');
  connection.send(message);
}

export class RemoteLlmPeer extends EventTarget {
  constructor({ Peer, getLlmClient }) {
    super();
    if (!Peer) throw new Error('PeerJS is unavailable');
    this.Peer = Peer;
    this.getLlmClient = getLlmClient;
    this.peer = null;
    this.connection = null;
    this.secret = null;
    this.pending = new Map();
    this.seen = new Map();
    this.active = new Set();
  }

  activity(message) {
    this.dispatchEvent(new CustomEvent('activity', { detail: { message } }));
  }

  async host() {
    this.close();
    this.secret = randomSecret();
    this.peer = new this.Peer();
    this.peer.on('connection', connection => this.accept(connection));
    this.peer.on('error', error => this.activity(`error — ${error.message || error}`));
    const id = await new Promise((resolve, reject) => {
      this.peer.once('open', resolve);
      this.peer.once('error', reject);
    });
    this.activity('waiting for a phone');
    return `${id}.${this.secret}`;
  }

  accept(connection) {
    if (this.connection?.open) {
      connection.on('open', () => { connection.send({ type: 'auth.error' }); connection.close(); });
      return;
    }
    let authenticated = false;
    connection.on('data', async message => {
      if (!authenticated) {
        authenticated = message?.type === 'auth' && message?.secret === this.secret;
        connection.send({ type: authenticated ? 'auth.ok' : 'auth.error' });
        if (!authenticated) connection.close();
        else {
          this.connection = connection;
          this.activity('phone connected');
        }
        return;
      }
      if (message?.type !== 'llm.chat' || !message.id || typeof message.prompt !== 'string') return;
      if (!message.prompt.trim() || message.prompt.length > 32768) {
        connection.send({ type: 'llm.error', id: message.id, error: 'prompt must contain 1 to 32768 characters' });
        return;
      }
      if (this.seen.has(message.id)) {
        connection.send(this.seen.get(message.id));
        return;
      }
      if (this.active.has(message.id)) return;
      this.active.add(message.id);
      try {
        const client = this.getLlmClient?.();
        if (!client) throw new Error('desktop WebGPU LLM is not ready');
        const body = { messages: [{ role: 'user', content: message.prompt }] };
        const completion = client.chatStream
          ? await client.chatStream(body, delta => connection.send({ type: 'llm.chunk', id: message.id, delta }))
          : await client.chat(body);
        const response = { type: 'llm.result', id: message.id, content: completion?.choices?.[0]?.message?.content || '' };
        this.seen.set(message.id, response);
        if (this.seen.size > 256) this.seen.delete(this.seen.keys().next().value);
        connection.send(client.chatStream ? { type: 'llm.done', id: message.id } : response);
      } catch (error) {
        connection.send({ type: 'llm.error', id: message.id, error: error.message || String(error) });
      } finally {
        this.active.delete(message.id);
      }
    });
  }

  async connect(pairingKey) {
    this.close();
    const separator = pairingKey.lastIndexOf('.');
    if (separator < 1) throw new Error('invalid pairing key');
    const id = pairingKey.slice(0, separator);
    const secret = pairingKey.slice(separator + 1);
    if (!/^[a-f0-9]{32}$/i.test(secret)) throw new Error('invalid pairing key');
    this.peer = new this.Peer();
    await new Promise((resolve, reject) => {
      this.peer.once('open', resolve);
      this.peer.once('error', reject);
    });
    const connection = this.peer.connect(id, { reliable: true });
    this.connection = connection;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('pairing timed out')), 20000);
      connection.on('open', () => connection.send({ type: 'auth', secret }));
      connection.on('data', message => {
        if (message?.type === 'auth.ok') {
          clearTimeout(timer);
          this.bindResults(connection);
          this.activity('connected to desktop LLM');
          resolve();
        } else if (message?.type === 'auth.error') {
          clearTimeout(timer);
          reject(new Error('pairing was rejected'));
        }
      });
      connection.on('error', error => { clearTimeout(timer); reject(error); });
    });
  }

  bindResults(connection) {
    connection.on('data', message => {
      if (!message?.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      if (message.type === 'llm.chunk') {
        clearTimeout(pending.timer);
        pending.timer = this.responseTimer(message.id, pending.reject);
        pending.content += message.delta || '';
        pending.onChunk?.(message.delta || '');
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.type === 'llm.done') pending.resolve(pending.content);
      else if (message.type === 'llm.result') pending.resolve(message.content);
      else if (message.type === 'llm.error') pending.reject(new Error(message.error));
    });
    connection.on('close', () => this.activity('desktop disconnected'));
  }

  responseTimer(id, reject) {
    return setTimeout(() => {
      this.pending.delete(id);
      reject(new Error('LLM response timed out'));
    }, REQUEST_TIMEOUT_MS);
  }

  chat(prompt, { onChunk } = {}) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = this.responseTimer(id, reject);
      this.pending.set(id, { resolve, reject, timer, onChunk, content: '' });
      try { send(this.connection, { type: 'llm.chat', id, prompt }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  close() {
    this.connection?.close?.();
    this.peer?.destroy?.();
    this.connection = null;
    this.peer = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('remote connection closed'));
    }
    this.pending.clear();
    this.seen.clear();
    this.active.clear();
  }
}
