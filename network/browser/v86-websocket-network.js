// Ethernet-frame transport for the public v86 bus API.
// One binary WebSocket message is one raw Ethernet frame.

export class V86WebSocketNetwork {
  constructor(emulator, { url, token, protocol, reconnectMs = 2000, maxQueueBytes = 1 << 20, batchMs = 1, onStatus = () => {} }) {
    if (!emulator?.add_listener || !emulator?.bus?.send) {
      throw new TypeError('emulator must expose add_listener() and bus.send()');
    }
    this.emulator = emulator;
    this.url = new URL(url, location.href);
    this.protocol = protocol || (token ? `v86net.${token}` : '');
    this.reconnectMs = reconnectMs;
    this.maxQueueBytes = maxQueueBytes;
    this.onStatus = onStatus;
    this.batchMs = batchMs;
    this.batchQueue = [];
    this.batchTimer = 0;
    this.queue = [];
    this.queueBytes = 0;
    this.socket = null;
    this.closed = false;
    this.reconnectTimer = 0;
    this.onGuestFrame = frame => this.send(frame);
  }

  start() {
    this.emulator.add_listener('net0-send', this.onGuestFrame);
    this.connect();
    return this;
  }

  connect() {
    if (this.closed || this.socket) return;
    this.onStatus('connecting');
    const socket = this.protocol ? new WebSocket(this.url, this.protocol) : new WebSocket(this.url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => { this.onStatus('connected'); this.flush(); };
    socket.onmessage = event => {
      if (event.data instanceof ArrayBuffer && event.data.byteLength >= 14) {
        this.emulator.bus.send('net0-receive', new Uint8Array(event.data));
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      this.onStatus(this.closed ? 'closed' : 'disconnected');
      if (this.socket === socket) this.socket = null;
      if (!this.closed) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectMs);
      }
    };
  }

  send(value) {
    const frame = value instanceof Uint8Array ? value.slice() : new Uint8Array(value).slice();
    if (frame.byteLength < 14 || frame.byteLength > 65535) return;
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < this.maxQueueBytes) {
      this.enqueueBatch(frame);
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
    while (this.queue.length && this.socket?.readyState === WebSocket.OPEN) {
      if (this.socket.bufferedAmount >= this.maxQueueBytes) {
        setTimeout(() => this.flush(), 10);
        return;
      }
      const frame = this.queue.shift();
      this.queueBytes -= frame.byteLength;
      this.enqueueBatch(frame);
    }
  }

  enqueueBatch(frame) {
    if (this.batchMs <= 0) {
      this.socket.send(frame);
      return;
    }
    this.batchQueue.push(frame);
    if (!this.batchTimer) this.batchTimer = setTimeout(() => this.flushBatch(), this.batchMs);
  }

  flushBatch() {
    clearTimeout(this.batchTimer);
    this.batchTimer = 0;
    if (!this.batchQueue.length) return;
    if (this.socket?.readyState !== WebSocket.OPEN) {
      const pending = this.batchQueue.splice(0);
      for (const frame of pending) this.send(frame);
      return;
    }
    const frames = this.batchQueue.splice(0, 65535);
    const size = 6 + frames.reduce((total, frame) => total + 2 + frame.byteLength, 0);
    const message = new Uint8Array(size);
    message.set([0x56, 0x4e, 0x32, 0x00], 0);
    const view = new DataView(message.buffer);
    view.setUint16(4, frames.length);
    let offset = 6;
    for (const frame of frames) {
      view.setUint16(offset, frame.byteLength);
      offset += 2;
      message.set(frame, offset);
      offset += frame.byteLength;
    }
    this.socket.send(message);
    if (this.batchQueue.length) this.batchTimer = setTimeout(() => this.flushBatch(), this.batchMs);
  }

  close() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.batchTimer);
    this.emulator.remove_listener?.('net0-send', this.onGuestFrame);
    this.socket?.close(1000, 'adapter closed');
    this.socket = null;
    this.queue = [];
    this.queueBytes = 0;
    this.onStatus('closed');
  }
}
