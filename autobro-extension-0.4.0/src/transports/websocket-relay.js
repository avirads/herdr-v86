// Transport #2 (Phase 2, optional): callers outside the browser.
// The extension dials OUT to a relay; native CLIs / remote agents dial the
// same relay. Wire protocol is bridge v3 unchanged:
//   relay -> extension: {type:"command", id, payload}
//   extension -> relay: {type:"result", id, ok, result|error}
// Configure via chrome.storage.local {relayUrl, relaySession} in the side
// panel; disabled when unset.

import { executeFrame, registerTransport } from '../router.js';

const RECONNECT_MS = 2000;
let socket = null;
let stopped = true;

async function config() {
  const { relayUrl, relaySession } = await chrome.storage.local.get(['relayUrl', 'relaySession']);
  return relayUrl && relaySession ? { relayUrl, relaySession } : null;
}

async function connect() {
  if (stopped) return;
  const settings = await config();
  if (!settings) return;
  const url = `${settings.relayUrl.replace(/\/+$/, '')}/session/${encodeURIComponent(settings.relaySession)}/host`;
  try {
    socket = new WebSocket(url);
  } catch {
    setTimeout(connect, RECONNECT_MS);
    return;
  }
  socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', runtime: 'web-bridge-extension' }));
  socket.onmessage = async event => {
    const frame = JSON.parse(event.data);
    if (frame?.type === 'ping') return;
    const reply = await executeFrame(frame);
    if (reply) socket?.send(JSON.stringify(reply));
  };
  socket.onclose = () => {
    socket = null;
    if (!stopped) setTimeout(connect, RECONNECT_MS);
  };
  socket.onerror = () => socket?.close();
}

export function start() {
  stopped = false;
  registerTransport('websocketRelay', {
    connected: () => socket?.readyState === WebSocket.OPEN
  });
  connect();
  // chrome.alarms keeps the MV3 service worker revivable, same trick as the
  // original extension (background.js:837).
  chrome.alarms.create('web-bridge-relay-heartbeat', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'web-bridge-relay-heartbeat' && !socket) connect();
  });
}

export function stop() {
  stopped = true;
  socket?.close();
  socket = null;
}
