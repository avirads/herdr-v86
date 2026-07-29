// AutoBro Web Bridge — entry point.
// The bridge that used to be a Go process on 127.0.0.1:9890 is now the
// modules under src/: router (correlation/health), commands (chrome.* work),
// transports (how callers reach us). See ../docs/03-target-architecture.md.

import * as externalMessaging from './src/transports/external-messaging.js';
import * as websocketRelay from './src/transports/websocket-relay.js';
import * as webgpuLlm from './src/llm/webgpu-proxy.js';
import * as nativeNetwork from './src/transports/native-network.js';
import { execute, health } from './src/router.js';
import { loadSkills } from './src/skills.js';

externalMessaging.start();
websocketRelay.start(); // no-op until relayUrl/relaySession are configured
webgpuLlm.start();      // accepts the authenticated Herdr page LLM provider
nativeNetwork.start();  // optional per-user helper; unavailable until installed

// Toolbar button opens the merged panel as a draggable / resizable / closable
// popup window (a real OS window: title bar drags, edges resize, X closes).
// The side panel remains available via right-click → "Open side panel".
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);

const PANEL_WINDOW_KEY = 'webBridgePanelWindowId'; // session: current window id
const PANEL_BOUNDS_KEY = 'webBridgePanelBounds';   // local: last position + size
const DEFAULT_BOUNDS = { width: 560, height: 920 };

function sanitizeBounds(bounds) {
  if (!bounds) return { ...DEFAULT_BOUNDS };
  const out = {};
  for (const key of ['left', 'top', 'width', 'height']) {
    if (Number.isFinite(bounds[key])) out[key] = Math.round(bounds[key]);
  }
  out.width = Math.max(320, out.width || DEFAULT_BOUNDS.width);
  out.height = Math.max(240, out.height || DEFAULT_BOUNDS.height);
  return out;
}

async function openPanelWindow() {
  // Singleton: focus the existing window instead of spawning duplicates.
  const { [PANEL_WINDOW_KEY]: existingId } = await chrome.storage.session.get(PANEL_WINDOW_KEY);
  if (existingId != null) {
    try {
      await chrome.windows.update(existingId, { focused: true, drawAttention: true });
      return;
    } catch {
      await chrome.storage.session.remove(PANEL_WINDOW_KEY); // stale — was closed
    }
  }
  const { [PANEL_BOUNDS_KEY]: saved } = await chrome.storage.local.get(PANEL_BOUNDS_KEY);
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('panel/panel.html'),
    type: 'popup', // minimal chrome, still natively draggable + resizable
    focused: true,
    ...sanitizeBounds(saved) // restore last position + size (or defaults)
  });
  if (win?.id != null) await chrome.storage.session.set({ [PANEL_WINDOW_KEY]: win.id });
}

async function rememberBoundsIfPanel(win) {
  if (win?.id == null) return;
  const { [PANEL_WINDOW_KEY]: id } = await chrome.storage.session.get(PANEL_WINDOW_KEY);
  if (id !== win.id) return;
  await chrome.storage.local.set({
    [PANEL_BOUNDS_KEY]: { left: win.left, top: win.top, width: win.width, height: win.height }
  });
}

chrome.action?.onClicked.addListener(() => { openPanelWindow().catch(() => undefined); });

// A pending one-click pairing request pops the panel window open immediately,
// so approving it never depends on the OS notification pipeline rendering
// anything (observed unreliable in some Windows/remote-desktop sessions).
externalMessaging.onPairingRequested(() => { openPanelWindow().catch(() => undefined); });

// Persist position + size as the user drags or resizes the panel window.
chrome.windows?.onBoundsChanged?.addListener(win => { rememberBoundsIfPanel(win).catch(() => undefined); });

chrome.windows?.onRemoved.addListener(async removedId => {
  const { [PANEL_WINDOW_KEY]: id } = await chrome.storage.session.get(PANEL_WINDOW_KEY);
  if (id === removedId) await chrome.storage.session.remove(PANEL_WINDOW_KEY);
});

// Debug handle: lets you smoke-test from the service-worker DevTools console
// (dynamic import() is disallowed in service workers, so this is the way in):
//   await webBridge.execute({command: 'currentTab'})
//   webBridge.health()
globalThis.webBridge = { execute, health, loadSkills };


// Internal messaging for the extension's own pages (side panel, options) —
// same surface the popup used in the original extension.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.source !== 'web-bridge-ui') return null;
    if (message.command === 'health') return health();
    if (message.command === 'openPanelWindow') { await openPanelWindow(); return { ok: true }; }
    if (message.command === 'checkPendingPairing') return { origin: externalMessaging.getPendingPairingOrigin() };
    if (message.command === 'respondPairing') { externalMessaging.resolvePendingPairingFromPanel(Boolean(message.approve)); return { ok: true }; }
    return await execute(message, { timeoutMs: message.timeoutMs ?? 30_000 });
  })()
    .then(result => {
      if (result !== null) sendResponse({ ok: true, result });
    })
    .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});
