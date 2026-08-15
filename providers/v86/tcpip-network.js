// In-page virtual network for v86 guests, backed by tcpip.js (lwIP in WASM).
//
// websocket-network.js carries guest Ethernet frames to a host gateway that
// NATs them onto real sockets. This adapter instead terminates the guest LAN
// inside the page: the tab itself gets an address on the guest's subnet and can
// listen() and connect() like any other host, with no gateway process, no
// TAP/Wintun adapter, no admin rights, and no session token.
//
// The two are complementary rather than exclusive. Pass an `uplink` and the
// adapter bridges the guests, the page, and the gateway onto one virtual
// switch, so a guest with a single NIC gets page-local sockets *and* gateway
// NAT at the same time. Without an uplink there is no internet egress: a
// browser has no raw sockets, so only the page can be the peer.
//
//   const network = new V86TcpipNetwork({ hostIp: '10.77.0.2/24' });
//   network.addGuest(emulator);
//   await network.start();
//   const listener = await network.stack.tcp.listen({ port: 8080 });
//
// Uses v86's public `net0-send` listener and `net0-receive` bus event, the same
// seam as the WebSocket and DataChannel adapters.

import { createStack } from '../../vendor/tcpip/tcpip/dist/index.js';
import { createDhcp } from '../../vendor/tcpip/dhcp/dist/index.js';

const MIN_ETHERNET_FRAME = 14;
const MAX_ETHERNET_FRAME = 65535;
const BATCH_MAGIC = [0x56, 0x4e, 0x32, 0x00]; // 'VN2\0', matches tunnel.go

export class V86TcpipNetwork {
  #stack = null;
  #guests = [];
  #uplink = null;
  #interface = null;
  #started = false;

  constructor({ hostIp = '10.77.0.2/24', hostMac = '02:00:00:00:00:01', uplink = null, dhcp = null, forceBridge = false, onStatus = () => {} } = {}) {
    this.hostIp = hostIp;
    this.hostMac = hostMac;
    this.uplinkOptions = uplink;
    this.dhcpOptions = dhcp;
    // A single guest with no uplink is attached to a plain tap, since a bridge
    // would only add a hop. forceBridge keeps the bridge in that case, to
    // measure what the bridge itself costs.
    this.forceBridge = forceBridge;
    this.onStatus = onStatus;
  }

  // Guests must be registered before start(): tcpip.js fixes a bridge's port
  // list at creation time and has no API to add a port later.
  addGuest(emulator, { mac } = {}) {
    if (this.#started) throw new Error('addGuest() must be called before start()');
    if (!emulator?.add_listener || !emulator?.bus?.send) {
      throw new TypeError('emulator must expose add_listener() and bus.send()');
    }
    const guest = { emulator, mac, tap: null, txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0 };
    this.#guests.push(guest);
    return guest;
  }

  async start() {
    if (this.#started) return this;
    this.#started = true;
    if (this.#guests.length === 0) throw new Error('add at least one guest before start()');

    this.onStatus('starting');
    this.#stack = await createStack();

    const needsBridge = this.#guests.length > 1 || !!this.uplinkOptions || this.forceBridge;

    for (const guest of this.#guests) {
      // Bridge members carry no address of their own; the bridge holds it.
      guest.tap = await this.#stack.interfaces.createTap(
        needsBridge ? (guest.mac ? { mac: guest.mac } : {}) : { ip: this.hostIp, mac: this.hostMac });
    }

    let uplinkTap = null;
    if (this.uplinkOptions) {
      uplinkTap = await this.#stack.interfaces.createTap({});
    }

    if (needsBridge) {
      this.#interface = await this.#stack.interfaces.createBridge({
        ports: [...this.#guests.map(g => g.tap), ...(uplinkTap ? [uplinkTap] : [])],
        mac: this.hostMac,
        ip: this.hostIp,
      });
    } else {
      this.#interface = this.#guests[0].tap;
    }

    for (const guest of this.#guests) this.#pumpGuest(guest);
    if (uplinkTap) this.#uplink = new WebSocketUplink(uplinkTap, this.uplinkOptions, this.onStatus);

    if (this.dhcpOptions) await this.#serveDhcp();

    this.onStatus('ready');
    return this;
  }

  // A tap's readable stream silently discards frames until it is locked, so the
  // reader is attached before any traffic can arrive.
  #pumpGuest(guest) {
    const writer = guest.tap.writable.getWriter();
    guest.emulator.add_listener('net0-send', value => {
      const frame = value instanceof Uint8Array ? value.slice() : new Uint8Array(value).slice();
      if (frame.byteLength < MIN_ETHERNET_FRAME || frame.byteLength > MAX_ETHERNET_FRAME) return;
      guest.txFrames++; guest.txBytes += frame.byteLength;
      writer.write(frame).catch(error => this.onStatus('error', error));
    });
    (async () => {
      for await (const frame of guest.tap.listen()) {
        guest.rxFrames++; guest.rxBytes += frame.byteLength;
        guest.emulator.bus.send('net0-receive', frame);
      }
    })().catch(error => this.onStatus('error', error));
  }

  // Only for gateway-free deployments. With an uplink the gateway already
  // serves DHCP, and a second server on the same LAN would race it.
  async #serveDhcp() {
    if (this.uplinkOptions) throw new Error('refusing to serve DHCP: the uplink gateway already does');
    const [routerIp] = this.hostIp.split('/');
    const dhcp = await createDhcp(this.#stack.udp);
    await dhcp.serve({
      leaseRange: this.dhcpOptions.leaseRange,
      serverIdentifier: routerIp,
      netmask: this.dhcpOptions.netmask ?? '255.255.255.0',
      router: this.dhcpOptions.router ?? routerIp,
      dnsServers: this.dhcpOptions.dnsServers ?? [routerIp],
    });
  }

  get stack() { return this.#stack; }
  get address() { return this.#interface?.ip; }
  get guests() { return this.#guests; }

  stats() {
    return this.#guests.map((g, i) => ({
      guest: i, txFrames: g.txFrames, rxFrames: g.rxFrames, txBytes: g.txBytes, rxBytes: g.rxBytes,
    }));
  }

  // stack.tcp.connect() never times out: connecting to a closed port hangs
  // forever with no error. Always go through this wrapper.
  async connect({ host, port, timeoutMs = 15000 }) {
    let timer;
    try {
      return await Promise.race([
        this.#stack.tcp.connect({ host, port }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`tcp connect to ${host}:${port} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async stop() {
    this.#uplink?.close();
    this.onStatus('closed');
  }
}

// Carries the bridge's uplink port to the v86net gateway over the same
// authenticated binary WebSocket that websocket-network.js uses: one binary
// message is one Ethernet frame, with the optional 'VN2\0' batch envelope
// browser-to-gateway. The gateway always answers one frame per message.
class WebSocketUplink {
  constructor(tap, { url, token, protocol, reconnectMs = 2000, maxQueueBytes = 1 << 20, batchMs = 1 }, onStatus) {
    this.tap = tap;
    this.url = new URL(url, location.href);
    this.protocol = protocol || (token ? `v86net.${token}` : '');
    this.reconnectMs = reconnectMs;
    this.maxQueueBytes = maxQueueBytes;
    this.batchMs = batchMs;
    this.onStatus = onStatus;
    this.batchQueue = [];
    this.batchTimer = 0;
    this.socket = null;
    this.closed = false;
    this.writer = tap.writable.getWriter();
    this.framesToGateway = 0;
    this.framesFromGateway = 0;

    (async () => {
      for await (const frame of tap.listen()) this.#sendToGateway(frame);
    })().catch(error => this.onStatus('error', error));

    this.#connect();
  }

  #connect() {
    if (this.closed || this.socket) return;
    this.onStatus('uplink-connecting');
    const socket = this.protocol ? new WebSocket(this.url, this.protocol) : new WebSocket(this.url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => this.onStatus('uplink-connected');
    socket.onmessage = event => {
      if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < MIN_ETHERNET_FRAME) return;
      this.framesFromGateway++;
      this.writer.write(new Uint8Array(event.data));
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      this.onStatus(this.closed ? 'uplink-closed' : 'uplink-disconnected');
      if (this.socket === socket) this.socket = null;
      // Reconnecting does not preserve guest TCP sessions.
      if (!this.closed) setTimeout(() => this.#connect(), this.reconnectMs);
    };
  }

  #sendToGateway(frame) {
    if (frame.byteLength < MIN_ETHERNET_FRAME || frame.byteLength > MAX_ETHERNET_FRAME) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    if (this.socket.bufferedAmount > this.maxQueueBytes) return;
    this.framesToGateway++;
    this.batchQueue.push(frame);
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => { this.batchTimer = 0; this.#flushBatch(); }, this.batchMs);
  }

  #flushBatch() {
    const frames = this.batchQueue;
    this.batchQueue = [];
    if (frames.length === 0 || this.socket?.readyState !== WebSocket.OPEN) return;
    if (frames.length === 1) { this.socket.send(frames[0]); return; }
    let total = 6;
    for (const frame of frames) total += 2 + frame.byteLength;
    const message = new Uint8Array(total);
    message.set(BATCH_MAGIC, 0);
    new DataView(message.buffer).setUint16(4, frames.length);
    let offset = 6;
    for (const frame of frames) {
      new DataView(message.buffer).setUint16(offset, frame.byteLength);
      offset += 2;
      message.set(frame, offset);
      offset += frame.byteLength;
    }
    this.socket.send(message);
  }

  close() {
    this.closed = true;
    clearTimeout(this.batchTimer);
    this.socket?.close();
  }
}
