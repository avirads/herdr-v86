// AutoBro's only LLM provider is the authenticated parent Herdr page.
// The page owns the LiteRT-LM runtime, model storage, and WebGPU engine.

import { registerTransport } from '../router.js';

let herdrPort = null;
let nextId = 0;
const pending = new Map();

export function start() {
  registerTransport('herdrLlmProvider', { connected: () => herdrPort !== null });
  chrome.runtime.onConnectExternal.addListener(port => {
    if (port.name !== 'herdr-llm-provider') return;
    let authenticated = false;
    port.onMessage.addListener(async message => {
      if (message?.type === 'llm-provider-hello') {
        const stored = await chrome.storage.local.get('webBridgePairingToken');
        authenticated = Boolean(stored.webBridgePairingToken && message.token === stored.webBridgePairingToken);
        if (!authenticated) { port.disconnect(); return; }
        herdrPort?.disconnect();
        herdrPort = port;
        port.postMessage({ type: 'llm-provider-ready' });
        return;
      }
      if (!authenticated || message?.type !== 'llm-response') return;
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.ok) waiter.resolve(message.result);
      else waiter.reject(new Error(message.error || 'Herdr LLM error'));
    });
    port.onDisconnect.addListener(() => {
      if (herdrPort === port) herdrPort = null;
      for (const waiter of pending.values()) waiter.reject(new Error('Herdr LLM provider disconnected'));
      pending.clear();
    });
  });
}

function request(method, body = {}, timeoutMs = 120_000) {
  if (!herdrPort) throw new Error('Connect AutoBro to https://avirads.github.io/herdr-v86/ and configure its WebGPU LLM');
  const id = `herdr-${++nextId}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Herdr LLM timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); },
    });
    herdrPort.postMessage({ type: 'llm-request', id, method, body });
  });
}

export const connected = () => herdrPort !== null;
export const ensureHost = async () => {
  if (!herdrPort) throw new Error('Herdr WebGPU LLM is not connected');
  return { hosted: true, surface: 'herdr-page' };
};
export const loadModel = async () => { throw new Error('Configure the model in Herdr'); };
export const loadUrl = async () => { throw new Error('Configure the model in Herdr'); };
export const status = async () => ({ ...(await request('status', {}, 15_000)), provider: 'herdr-page', herdrConnected: true });
export const models = () => request('models', {}, 15_000);
export const chat = body => request('chat', body);
export const chatStream = async (body, onChunk) => {
  const result = await request('chat', body);
  const text = result?.choices?.[0]?.message?.content || '';
  if (text) onChunk(text);
  return result;
};
