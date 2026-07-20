// Optional WebRTC data plane. Signaling is intentionally application-owned:
// pass an authenticated, already-negotiated RTCDataChannel named "ethernet".
// Recommended channel options: { ordered: false, maxRetransmits: 2 }.
export class V86DataChannelNetwork {
  constructor(emulator, channel, { maxQueueBytes = 1 << 20, onStatus = () => {} } = {}) {
    if (!emulator?.add_listener || !emulator?.bus?.send) {
      throw new TypeError('emulator must expose add_listener() and bus.send()');
    }
    if (!channel || typeof channel.send !== 'function') {
      throw new TypeError('an RTCDataChannel is required');
    }
    this.emulator = emulator;
    this.channel = channel;
    this.maxQueueBytes = maxQueueBytes;
    this.onStatus = onStatus;
    this.queue = [];
    this.queueBytes = 0;
    this.closed = false;
    this.onGuestFrame = value => this.send(value);
  }

  start() {
    this.channel.binaryType = 'arraybuffer';
    this.channel.bufferedAmountLowThreshold = Math.floor(this.maxQueueBytes / 2);
    this.channel.addEventListener('open', () => { this.onStatus('connected'); this.flush(); });
    this.channel.addEventListener('close', () => this.onStatus('closed'));
    this.channel.addEventListener('error', () => this.onStatus('error'));
    this.channel.addEventListener('bufferedamountlow', () => this.flush());
    this.channel.addEventListener('message', event => this.receive(event.data));
    this.emulator.add_listener('net0-send', this.onGuestFrame);
    this.onStatus(this.channel.readyState === 'open' ? 'connected' : 'connecting');
    if (this.channel.readyState === 'open') this.flush();
    return this;
  }

  async receive(value) {
    const buffer = value instanceof Blob ? await value.arrayBuffer() : value;
    if (buffer instanceof ArrayBuffer && buffer.byteLength >= 14) {
      this.emulator.bus.send('net0-receive', new Uint8Array(buffer));
    }
  }

  send(value) {
    const frame = value instanceof Uint8Array ? value.slice() : new Uint8Array(value).slice();
    if (frame.byteLength < 14 || frame.byteLength > 65535) return;
    if (this.channel.readyState === 'open' && this.channel.bufferedAmount < this.maxQueueBytes) {
      this.channel.send(frame);
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
    while (this.queue.length && this.channel.readyState === 'open' && this.channel.bufferedAmount < this.maxQueueBytes) {
      const frame = this.queue.shift();
      this.queueBytes -= frame.byteLength;
      this.channel.send(frame);
    }
  }

  close() {
    this.closed = true;
    this.emulator.remove_listener?.('net0-send', this.onGuestFrame);
    this.channel.close();
    this.queue = [];
    this.queueBytes = 0;
    this.onStatus('closed');
  }
}
