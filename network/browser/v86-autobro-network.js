// Transparent v86 Ethernet transport through AutoBro and its per-user native
// userspace-network helper. Arrays are used because Chrome external messaging
// does not transfer ArrayBuffers between a web page and an extension.

export class V86AutoBroNetwork {
  constructor(emulator, { extensionId, token, maxQueueBytes = 1 << 20, onStatus = () => {} }) {
    if (!emulator?.add_listener || !emulator?.bus?.send) {
      throw new TypeError('emulator must expose add_listener() and bus.send()');
    }
    this.emulator = emulator;
    this.transport = 'autobro-userspace';
    this.extensionId = extensionId;
    this.token = token;
    this.maxQueueBytes = maxQueueBytes;
    this.onStatus = onStatus;
    this.port = null;
    this.ready = false;
    this.closed = false;
    this.queue = [];
    this.queueBytes = 0;
    this.onGuestFrame = frame => this.send(frame);
  }

  start() {
    if (!globalThis.chrome?.runtime?.connect) throw new Error('Chrome extension messaging is unavailable');
    this.onStatus('connecting — AutoBro userspace');
    this.emulator.add_listener('net0-send', this.onGuestFrame);
    const port = chrome.runtime.connect(this.extensionId, { name: 'autobro-v86-network' });
    this.port = port;
    port.onMessage.addListener(message => {
      if (message?.type === 'ready') {
        this.ready = true;
        this.onStatus('connected — AutoBro userspace');
        this.flush();
      } else if (message?.type === 'frame' && Array.isArray(message.data) && message.data.length >= 14) {
        this.emulator.bus.send('net0-receive', Uint8Array.from(message.data));
      } else if (message?.type === 'error') {
        this.onStatus(`error — ${message.error || 'local networking failed'}`);
      }
    });
    port.onDisconnect.addListener(() => {
      this.ready = false;
      if (!this.closed) this.onStatus(`disconnected — ${chrome.runtime.lastError?.message || 'AutoBro helper closed'}`);
    });
    port.postMessage({ type: 'hello', token: this.token });
    return this;
  }

  send(value) {
    const frame = value instanceof Uint8Array ? value.slice() : new Uint8Array(value).slice();
    if (frame.byteLength < 14 || frame.byteLength > 65535) return;
    if (this.ready && this.port) {
      this.port.postMessage({ type: 'frame', data: Array.from(frame) });
      return;
    }
    while (this.queueBytes + frame.byteLength > this.maxQueueBytes && this.queue.length) {
      this.queueBytes -= this.queue.shift().byteLength;
    }
    if (frame.byteLength <= this.maxQueueBytes) {
      this.queue.push(frame);
      this.queueBytes += frame.byteLength;
    }
  }

  flush() {
    while (this.ready && this.port && this.queue.length) {
      const frame = this.queue.shift();
      this.queueBytes -= frame.byteLength;
      this.port.postMessage({ type: 'frame', data: Array.from(frame) });
    }
  }

  close() {
    this.closed = true;
    this.ready = false;
    this.emulator.remove_listener?.('net0-send', this.onGuestFrame);
    try { this.port?.disconnect(); } catch {}
    this.port = null;
    this.queue = [];
    this.queueBytes = 0;
    this.onStatus('closed');
  }
}
