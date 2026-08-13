// CheerpX host bridge: the browser-side half of the guest `vm*` commands.
//
// Same operation set and same response framing as providers/v86/host-bridge.js,
// deliberately. The guest tools (vmfetch, vmclip, vmexport, vmllm, vmai) parse
// lines of the form
//
//   __V86RPC_RESPONSE__\t<id>\t<KIND>\t<value>
//
// so emitting exactly that keeps their parsing loops unchanged — porting a tool
// becomes a one-line transport swap rather than a rewrite.
//
// LLM ROUTING IS NOT REIMPLEMENTED HERE. This bridge takes the same
// `llmResolver` the v86 page passes, backed by the one shared
// LlmProviderRouter, so local LiteRT and every configured cloud provider work on
// the CheerpX page with no second router, provider list, or secret store.
//
// What differs from v86 is only the transport. There is no UART, so none of the
// base64-per-byte pacing, 64-byte reply chunking, or ACK/retry layer exists.
// Instead:
//   guest -> host   the guest appends one request line to /vmbro/out/rpc.queue
//   host  -> guest  the host writes /vmbro/in/rpc-<id>.res via the DataDevice
//
// The queue is one well-known file because IDBDevice exposes no directory
// listing — only readFileAsBlob(name) — so the host cannot discover per-request
// files by name. It tracks a byte offset and only ever consumes whole lines.

import { GUEST_IN, GUEST_OUT } from './runtime.js';

const QUEUE_FILE = 'rpc.queue';
/** Generous next to the UART's 64 bytes, still small enough for shell `read`. */
const DATA_CHUNK = 8192;

const encodeText = value => btoa(String.fromCharCode(...new TextEncoder().encode(String(value))));
const decodeText = value => new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)));

function encodeBytes(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export class CheerpXHostBridge extends EventTarget {
  constructor({ cx, dataIn, idbOut }, {
    llmClient = null,
    llmResolver = null,
    agentHandler = null,
    maxFetchBytes = 16 << 20,
    fetchImpl = (...args) => fetch(...args),
    // Idle polling is deliberately slow: the guest is JIT-compiling x86 and
    // every wasted wakeup competes with it. Any traffic drops the interval back
    // to `activeIntervalMs` for a while.
    activeIntervalMs = 40,
    idleIntervalMs = 400,
    idleAfterMs = 2000,
  } = {}) {
    super();
    if (!cx) throw new Error('CheerpXHostBridge requires a booted CheerpX runtime');
    this.cx = cx;
    this.dataIn = dataIn;
    this.idbOut = idbOut;
    this.llmClient = llmClient;
    this.llmResolver = llmResolver;
    this.maxFetchBytes = maxFetchBytes;
    this.fetchImpl = fetchImpl;
    this.activeIntervalMs = activeIntervalMs;
    this.idleIntervalMs = idleIntervalMs;
    this.idleAfterMs = idleAfterMs;

    this.agentHandler = agentHandler;
    this.consumed = 0;
    this.running = false;
    this.lastActivity = 0;
    this.inFlight = new Set();
    this.pendingAgentRequests = [];
    this.handledAgentRequests = new Set();
  }

  setLlmClient(client) { this.llmClient = client; }

  start() {
    if (this.running) return;
    this.running = true;
    // Never dispatch straight into the loop: the queue lives on the IDB
    // out-mount and therefore SURVIVES A RELOAD. Starting at offset 0 replays
    // every request from previous sessions — which really happens, and quietly:
    // a stale CLIPBOARD_WRITE re-executed on load and overwrote the clipboard
    // before the page had done anything.
    // `ready` settles once history is discarded — NOT once the loop finishes,
    // which only happens at stop(). Chaining _loop() into it would make
    // `await bridge.ready` hang until something else stopped the bridge.
    this.ready = this.resetQueue();
    this.ready.then(() => this._loop());
  }

  /**
   * Discard queue history so only requests made after start() are handled.
   *
   * Truncating is preferred — otherwise the file grows across every session —
   * but the host has no write access to an IDBDevice, so it asks the guest. If
   * that fails, treat whatever is already there as consumed, which is enough to
   * prevent replay even though the file keeps growing.
   */
  async resetQueue() {
    try {
      await this.cx.run('/bin/sh', ['-c', `: > ${GUEST_OUT}/${QUEUE_FILE}`], {
        env: [], cwd: '/', uid: 0, gid: 0,
      });
    } catch { /* fall through to the offset-only path below */ }

    try {
      const blob = await this.idbOut.readFileAsBlob(`/${QUEUE_FILE}`);
      this.consumed = (await blob.text()).length;
    } catch {
      this.consumed = 0; // queue does not exist yet
    }
  }

  stop() { this.running = false; }

  /**
   * Report activity that this loop cannot see for itself, so it stays on the
   * fast interval.
   *
   * The loop only calls something "activity" when the RPC queue had traffic.
   * The terminal is a different channel entirely — CheerpX's console — so
   * typing was invisible here and the loop sat on its 400 ms idle interval
   * while someone was actively using the shell.
   *
   * That matters far more than it looks, because this poll does not merely
   * observe the guest, it drives it. Measured: with the loop running, a shell
   * builtin round-trips in ~1000 ms; with it stopped, the same builtin took
   * 53 s and then 60 s. The polling cadence *is* the terminal's responsiveness.
   */
  markActive() { this.lastActivity = Date.now(); }

  async _loop() {
    while (this.running) {
      let handled = 0;
      try { handled = await this.poll(); }
      catch (error) { this.dispatchEvent(new CustomEvent('bridge-error', { detail: error })); }
      if (handled) this.lastActivity = Date.now();
      const idle = Date.now() - this.lastActivity > this.idleAfterMs;
      await new Promise(resolve => setTimeout(resolve, idle ? this.idleIntervalMs : this.activeIntervalMs));
    }
  }

  /** Drain any complete request lines. Returns how many were dispatched. */
  async poll() {
    let text;
    try {
      const blob = await this.idbOut.readFileAsBlob(`/${QUEUE_FILE}`);
      text = await blob.text();
    } catch {
      return 0; // queue not created yet
    }
    if (text.length <= this.consumed) return 0;

    const pending = text.slice(this.consumed);
    // Only whole lines: the guest may be mid-append.
    const lastBreak = pending.lastIndexOf('\n');
    if (lastBreak < 0) return 0;
    this.consumed += lastBreak + 1;

    const lines = pending.slice(0, lastBreak).split('\n').filter(Boolean);
    for (const line of lines) {
      const [id, operation, ...fields] = line.split('\t');
      if (!id || this.inFlight.has(id)) continue;
      this.inFlight.add(id);
      this.handle(id, operation, fields)
        .catch(error => this.reply(id, [['ERROR', encodeText(error?.message ?? String(error))]]))
        .finally(() => this.inFlight.delete(id));
    }
    return lines.length;
  }

  /** Write all response lines for one request, then the guest's ready marker. */
  async reply(id, frames) {
    const body = frames.map(([kind, value = '']) => `__V86RPC_RESPONSE__\t${id}\t${kind}\t${value}`).join('\n');
    await this.dataIn.writeFile(`/rpc-${id}.res`, `${body}\n`);
  }

  setAgentHandler(handler) {
    this.agentHandler = handler;
    for (const request of this.pendingAgentRequests.splice(0)) this._dispatchAgent(request);
  }

  /**
   * Agent requests are fire-and-forget, exactly as on v86: the guest tool posts
   * a task and exits, and the agent's output is streamed to the terminal by the
   * host rather than returned through this reply channel. The difference is that
   * vmbro-rpc BLOCKS until a response file appears, so an immediate END is
   * required or every `rig TASK` would hang for its full timeout.
   */
  async _agent(id, operation, fields) {
    const command = operation.slice('AGENT_'.length).toLowerCase();
    const values = fields.map(value => (value ? decodeText(value) : ''));
    await this.reply(id, [['END', '0']]);

    if (!this.agentHandler) {
      if (!this.pendingAgentRequests.some(request => request.id === id)) {
        this.pendingAgentRequests.push({ id, command, values });
        if (this.pendingAgentRequests.length > 128) this.pendingAgentRequests.shift();
      }
      return;
    }
    this._dispatchAgent({ id, command, values });
  }

  _dispatchAgent({ id, command, values }) {
    if (this.handledAgentRequests.has(id)) return;
    this.handledAgentRequests.add(id);
    if (this.handledAgentRequests.size > 128) {
      this.handledAgentRequests.delete(this.handledAgentRequests.values().next().value);
    }
    Promise.resolve(this.agentHandler(command, ...values)).catch(error => {
      this.dispatchEvent(new CustomEvent('agent-error', { detail: error }));
    });
  }

  async handle(id, operation, fields) {
    if (operation?.startsWith('AGENT_')) return this._agent(id, operation, fields);
    switch (operation) {
      case 'FETCH': return this.fetch(id, fields);
      case 'CLIPBOARD_READ': return this.clipboardRead(id);
      case 'CLIPBOARD_WRITE': return this.clipboardWrite(id, fields[0]);
      case 'EXPORT': return this.exportFile(id, fields);
      case 'EXPORT_MOUNT': return this.exportMountedFile(id, fields);
      case 'LLM_STATUS': return this.llm(id, 'status');
      case 'LLM_MODELS': return this.llm(id, 'models');
      case 'LLM_CHAT': return this.llm(id, 'chat', fields[0], fields[1]);
      case 'LLM_COMPLETION': return this.llm(id, 'completion', fields[0], fields[1]);
      case 'LLM_OPENAI': return this.llm(id, 'openai', fields[0], fields[1]);
      default: throw new Error(`unsupported host operation: ${operation}`);
    }
  }

  // --- LLM: routed through the shared LlmProviderRouter ----------------------

  async llm(id, operation, body64, route64 = '') {
    const route = route64 ? JSON.parse(decodeText(route64)) : {};
    const client = this.llmResolver ? this.llmResolver('zerostack', route) : this.llmClient;
    if (!client) throw new Error('No LLM is configured; open Settings > AI providers');

    let result;
    if (operation === 'status') result = await client.status();
    else if (operation === 'models') result = await client.models();
    else if (operation === 'chat') {
      const completion = await client.chat(JSON.parse(decodeText(body64)));
      result = completion?.choices?.[0]?.message?.content ?? completion;
    } else if (operation === 'completion') {
      result = await client.chat(JSON.parse(decodeText(body64)));
    } else {
      result = this.openAiSse(await client.chat(JSON.parse(decodeText(body64))));
    }

    const output = typeof result === 'string' ? result : JSON.stringify(result);
    await this.reply(id, [...this.dataFrames(encodeText(output)), ['END', '0']]);
  }

  dataFrames(encoded) {
    const frames = [];
    for (let offset = 0; offset < encoded.length; offset += DATA_CHUNK) {
      frames.push(['DATA', encoded.slice(offset, offset + DATA_CHUNK)]);
    }
    return frames.length ? frames : [['DATA', '']];
  }

  /** Byte-for-byte the v86 bridge's shape, so `vmai`'s OpenAI mode is unchanged. */
  openAiSse(completion) {
    const choice = completion?.choices?.[0] || {};
    const message = choice.message || {};
    const base = {
      id: completion?.id || `vm-${Date.now()}`,
      object: 'chat.completion.chunk',
      model: completion?.model || 'webgpu',
      usage: null,
    };
    const role = { ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] };
    const payload = { ...base, choices: [{ index: 0, delta: {
      ...(message.content ? { content: message.content } : {}),
      ...(message.tool_calls ? { tool_calls: message.tool_calls.map((call, index) => ({ index, ...call })) } : {}),
    }, finish_reason: null }] };
    const last = { ...base, choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason || 'stop' }] };
    return `data: ${JSON.stringify(role)}\n\ndata: ${JSON.stringify(payload)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`;
  }

  // --- browser-backed operations --------------------------------------------

  async fetch(id, [method64, url64, headers64, body64]) {
    const method = method64 ? decodeText(method64) : 'GET';
    const url = decodeText(url64 ?? '');
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
      throw new Error('vmfetch permits HTTPS URLs (and localhost HTTP) only');
    }
    const headers = {};
    for (const line of headers64 ? decodeText(headers64).split('\n') : []) {
      if (!line) continue;
      const separator = line.indexOf(':');
      if (separator < 1) throw new Error(`invalid header: ${line}`);
      const name = line.slice(0, separator).trim();
      if (/^(host|connection|content-length|cookie|origin|referer)$/i.test(name)) {
        throw new Error(`browser-forbidden header: ${name}`);
      }
      headers[name] = line.slice(separator + 1).trim();
    }
    const body = body64 ? Uint8Array.from(atob(body64), c => c.charCodeAt(0)) : undefined;
    const response = await this.fetchImpl(url, { method, headers, body, credentials: 'omit', redirect: 'follow' });

    const frames = [['META', encodeText(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: Object.fromEntries(response.headers),
    }))]];

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length > this.maxFetchBytes) {
      throw new Error(`response exceeds ${this.maxFetchBytes} byte browser-bridge limit`);
    }
    frames.push(...this.dataFrames(encodeBytes(buffer)));
    frames.push(['END', String(response.status)]);
    await this.reply(id, frames);
  }

  async clipboardRead(id) {
    const value = await navigator.clipboard.readText();
    await this.reply(id, [...this.dataFrames(encodeText(value)), ['END', '0']]);
  }

  async clipboardWrite(id, value64) {
    await navigator.clipboard.writeText(decodeText(value64 ?? ''));
    await this.reply(id, [['END', '0']]);
  }

  /**
   * Download a file the guest staged on the out-mount, named rather than inlined.
   *
   * This is the CheerpX analogue of v86's EXPORT9P, and it exists for the same
   * reason: an 8 MiB file is ~11 MB of base64, far past ARG_MAX, so it cannot
   * travel as a command-line argument on the queue line. The guest copies the
   * file onto the IDB out-mount and sends only its name.
   */
  async exportMountedFile(id, [name64, sharedName64]) {
    const name = decodeText(name64 ?? '').replace(/[\\/:*?"<>|]/g, '_') || 'guest-file';
    const sharedName = decodeText(sharedName64 ?? '');
    if (!/^[A-Za-z0-9._-]+$/.test(sharedName)) throw new Error('invalid shared export name');

    const blob = await this.idbOut.readFileAsBlob(`/${sharedName}`);
    if (blob.size > 8 << 20) throw new Error('export exceeds 8 MiB');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    await this.reply(id, [['END', '0']]);
  }

  async exportFile(id, [name64, data64]) {
    const name = decodeText(name64 ?? '').replace(/[\\/:*?"<>|]/g, '_') || 'guest-file';
    const data = Uint8Array.from(atob(data64 ?? ''), c => c.charCodeAt(0));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([data]));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    await this.reply(id, [['END', '0']]);
  }
}

export { QUEUE_FILE, GUEST_IN, GUEST_OUT };
