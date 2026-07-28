const HOST_NAME = 'com.autobro.v86net';
const PORT_NAME = 'autobro-v86-network';
const PAIRING_KEY = 'webBridgePairingToken';
const MAX_FRAME = 65535;

let nativePort = null;
let pagePort = null;

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function disconnectNative() {
  try { nativePort?.postMessage({ type: 'close' }); } catch {}
  try { nativePort?.disconnect(); } catch {}
  nativePort = null;
}

function connectHelper(port) {
  disconnectNative();
  nativePort = chrome.runtime.connectNative(HOST_NAME);
  nativePort.onMessage.addListener(message => {
    if (message?.type === 'ready') {
      port.postMessage({ type: 'ready', mode: 'userspace' });
    } else if (message?.type === 'frame' && typeof message.data === 'string') {
      const bytes = base64ToBytes(message.data);
      port.postMessage({ type: 'frame', data: Array.from(bytes) });
    } else if (message?.type === 'error') {
      port.postMessage({ type: 'error', error: message.error || 'native networking helper failed' });
    }
  });
  nativePort.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message;
    nativePort = null;
    try {
      port.postMessage({
        type: 'error',
        error: error || 'Local networking helper disconnected. Install or re-register the AutoBro helper.',
      });
    } catch {}
  });
  nativePort.postMessage({ type: 'open' });
}

export function start() {
  chrome.runtime.onConnectExternal.addListener(port => {
    if (port.name !== PORT_NAME) return;
    let authenticated = false;
    port.onMessage.addListener(async message => {
      if (!authenticated) {
        if (message?.type !== 'hello') {
          port.disconnect();
          return;
        }
        const stored = await chrome.storage.local.get(PAIRING_KEY);
        if (!stored[PAIRING_KEY] || message.token !== stored[PAIRING_KEY]) {
          port.postMessage({ type: 'error', error: 'unauthorized: pair AutoBro first' });
          port.disconnect();
          return;
        }
        authenticated = true;
        if (pagePort && pagePort !== port) {
          try { pagePort.disconnect(); } catch {}
        }
        pagePort = port;
        connectHelper(port);
        return;
      }
      if (message?.type !== 'frame' || !Array.isArray(message.data)) return;
      if (message.data.length < 14 || message.data.length > MAX_FRAME) return;
      try {
        nativePort?.postMessage({ type: 'frame', data: bytesToBase64(Uint8Array.from(message.data)) });
      } catch (error) {
        port.postMessage({ type: 'error', error: error?.message || String(error) });
      }
    });
    port.onDisconnect.addListener(() => {
      if (pagePort === port) pagePort = null;
      disconnectNative();
    });
  });
}
