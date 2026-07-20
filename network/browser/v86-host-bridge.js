const PREFIX = "__V86RPC__\t";

function encodeText(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeText(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBytes(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export class V86HostBridge extends EventTarget {
  constructor(emulator, { maxFetchBytes = 16 << 20, chunkBytes = 12 << 10, llmClient = null, agentHandler = null, rpcSerial = 1 } = {}) {
    super();
    this.emulator = emulator;
    this.maxFetchBytes = maxFetchBytes;
    this.chunkBytes = chunkBytes;
    this.llmClient = llmClient;
    this.agentHandler = agentHandler;
    this.rpcSerial = rpcSerial;
    this.lines = ["", ""];
    this.replyChannels = new Map();
    this.handledAgentRequests = new Set();
    this.sendQueue = Promise.resolve();
    this.onByte0 = byte => this.consumeByte(byte, 0);
    this.onByte1 = byte => this.consumeByte(byte, 1);
    emulator.add_listener("serial0-output-byte", this.onByte0);
    emulator.add_listener("serial1-output-byte", this.onByte1);
  }

  consumeByte(byte, serial = this.rpcSerial) {
    const character = String.fromCharCode(byte);
    if (character === "\n") {
      const line = this.lines[serial].replace(/\r$/, "");
      this.lines[serial] = "";
      const marker = line.indexOf(PREFIX);
      if (marker >= 0) {
        const request = line.slice(marker + PREFIX.length);
        const id = request.split("\t")[1] || "0";
        this.replyChannels.set(id, serial);
        this.handle(request).catch(error => {
          this.reply(id, "ERROR", encodeText(error.message));
        });
      }
    } else if (this.lines[serial].length < 131072) {
      this.lines[serial] += character;
    } else {
      this.lines[serial] = "";
    }
  }

  send(line, serial = this.rpcSerial) {
    this.sendQueue = this.sendQueue.then(async () => {
      const text = line + "\n";
      for (let offset = 0; offset < text.length; offset += 128) {
        const chunk = text.slice(offset, offset + 128);
        if (serial === 0) {
          for (const character of chunk) this.emulator.serial0_send(character);
        } else {
          this.emulator.serial_send_bytes(serial, new TextEncoder().encode(chunk));
        }
        await new Promise(resolve => setTimeout(resolve, 2));
      }
    });
    return this.sendQueue;
  }

  sendConsole(line) { return this.send(line, 0); }

  async reply(id, kind, value = "") {
    const serial = this.replyChannels.get(id) ?? this.rpcSerial;
    await this.send(`__V86RPC_RESPONSE__\t${id}\t${kind}\t${value}`, serial);
    if (kind === "END" || kind === "ERROR") this.replyChannels.delete(id);
  }

  async handle(message) {
    const [operation, id, ...fields] = message.split("\t");
    if (operation === "FETCH") return this.fetch(id, fields);
    if (operation === "CLIPBOARD_READ") return this.clipboardRead(id);
    if (operation === "CLIPBOARD_WRITE") return this.clipboardWrite(id, fields[0]);
    if (operation === "EXPORT") return this.exportFile(id, fields);
    if (operation === "LLM_STATUS") return this.llm(id, "status");
    if (operation === "LLM_MODELS") return this.llm(id, "models");
    if (operation === "LLM_CHAT") return this.llm(id, "chat", fields[0]);
    if (operation.startsWith("AGENT_")) {
      if (!this.agentHandler) throw new Error("vmagent is still initializing");
      if (this.handledAgentRequests.has(id)) return;
      this.handledAgentRequests.add(id);
      if (this.handledAgentRequests.size > 128) this.handledAgentRequests.delete(this.handledAgentRequests.values().next().value);
      const command = operation.slice("AGENT_".length).toLowerCase();
      const values = fields.map(value => decodeText(value || ""));
      this.agentHandler(command, ...values).catch(error => {
        this.dispatchEvent(new CustomEvent("agent-error", { detail: error }));
      });
      return;
    }
    throw new Error(`unsupported host operation: ${operation}`);
  }

  setLlmClient(client) {
    this.llmClient = client;
  }

  setAgentHandler(handler) {
    this.agentHandler = handler;
  }

  async llm(id, operation, body64) {
    if (!this.llmClient) throw new Error("WebGPU LLM is not paired; use the browser's Configure LLM button");
    let result;
    if (operation === "status") result = await this.llmClient.status();
    else if (operation === "models") result = await this.llmClient.models();
    else {
      const completion = await this.llmClient.chat(JSON.parse(decodeText(body64)));
      result = completion?.choices?.[0]?.message?.content ?? completion;
    }
    const output = typeof result === "string" ? result : JSON.stringify(result);
    await this.reply(id, "DATA", encodeText(output));
    await this.reply(id, "END", "0");
  }

  async fetch(id, [method64, url64, headers64, body64]) {
    const method = decodeText(method64 || encodeText("GET"));
    const url = decodeText(url64);
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
      throw new Error("vmfetch permits HTTPS URLs (and localhost HTTP) only");
    }
    const headers = {};
    for (const line of headers64 ? decodeText(headers64).split("\n") : []) {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`invalid header: ${line}`);
      const name = line.slice(0, separator).trim();
      if (/^(host|connection|content-length|cookie|origin|referer)$/i.test(name))
        throw new Error(`browser-forbidden header: ${name}`);
      headers[name] = line.slice(separator + 1).trim();
    }
    const body = body64 ? Uint8Array.from(atob(body64), c => c.charCodeAt(0)) : undefined;
    const response = await fetch(url, { method, headers, body, credentials: "omit", redirect: "follow" });
    const reader = response.body?.getReader();
    let total = 0;
    await this.reply(id, "META", encodeText(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: Object.fromEntries(response.headers),
    })));
    if (reader) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > this.maxFetchBytes) throw new Error(`response exceeds ${this.maxFetchBytes} byte browser-bridge limit`);
        for (let offset = 0; offset < value.length; offset += this.chunkBytes) {
          await this.reply(id, "DATA", encodeBytes(value.subarray(offset, offset + this.chunkBytes)));
        }
      }
    }
    await this.reply(id, "END", String(response.status));
  }

  async clipboardRead(id) {
    const value = await navigator.clipboard.readText();
    await this.reply(id, "DATA", encodeText(value));
    await this.reply(id, "END", "0");
  }

  async clipboardWrite(id, value64) {
    await navigator.clipboard.writeText(decodeText(value64));
    await this.reply(id, "END", "0");
  }

  async exportFile(id, [name64, data64]) {
    const name = decodeText(name64).replace(/[\\/:*?"<>|]/g, "_") || "guest-file";
    const data = Uint8Array.from(atob(data64), c => c.charCodeAt(0));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([data]));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    await this.reply(id, "END", "0");
  }

  destroy() {
    this.emulator.remove_listener?.("serial0-output-byte", this.onByte0);
    this.emulator.remove_listener?.("serial1-output-byte", this.onByte1);
  }
}

export async function saveVMState(emulator, key = "herdr-v86-state") {
  const state = await emulator.save_state();
  const request = indexedDB.open("herdr-v86", 1);
  const database = await new Promise((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore("states");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("states", "readwrite");
    transaction.objectStore("states").put(state, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function restoreVMState(emulator, key = "herdr-v86-state") {
  const request = indexedDB.open("herdr-v86", 1);
  const database = await new Promise((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore("states");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const state = await new Promise((resolve, reject) => {
    const transaction = database.transaction("states", "readonly");
    const get = transaction.objectStore("states").get(key);
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => reject(get.error);
  });
  database.close();
  if (!state) throw new Error("no saved VM state");
  await emulator.restore_state(state);
}
