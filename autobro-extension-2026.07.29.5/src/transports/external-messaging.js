// Transport #1 (Phase 1): callers inside the browser.
// Web apps allow-listed in manifest "externally_connectable" (and other
// extensions) send bridge-v3 payloads via chrome.runtime.sendMessage.
// This replaces the Go bridge's POST /command for in-browser callers.

import { execute, health, registerTransport } from '../router.js';

const PAIRING_KEY = 'webBridgePairingToken';
const PAIRING_REQUEST_TIMEOUT_MS = 60_000;

async function pairingToken() {
  const stored = await chrome.storage.local.get(PAIRING_KEY);
  if (stored[PAIRING_KEY]) return stored[PAIRING_KEY];
  const token = crypto.randomUUID();
  await chrome.storage.local.set({ [PAIRING_KEY]: token });
  return token;
}

// One-click pairing: a caller with no token yet can ask a human physically at
// this device to approve it. A browser notification is the fast path, but
// native OS toast delivery is unreliable in some environments (observed:
// chrome.notifications.create() succeeds — the notification is live per
// chrome.notifications.getAll() — yet nothing ever renders, seen in a
// Windows/remote-desktop session). The extension's own action badge + panel
// is the reliable fallback: it doesn't depend on the OS notification pipeline
// at all, only on Chrome's own UI. Only one request is live at a time — a
// newer request supersedes an unanswered older one, so a stale approval can
// never land on the wrong origin.
let pendingPairing = null; // { notificationId, origin, resolve, timer }
let onPairingRequestedCallback = null;
let onOpenPanelRequestedCallback = null;

// Registered by background.js with its panel-window opener, so a pairing
// request surfaces a real, always-rendering extension window immediately —
// not dependent on the OS notification pipeline at all.
export function onPairingRequested(callback) {
  onPairingRequestedCallback = callback;
}

export function onOpenPanelRequested(callback) {
  onOpenPanelRequestedCallback = callback;
}

function setPendingBadge(origin) {
  chrome.action?.setBadgeText({ text: origin ? '1' : '' });
  if (origin) chrome.action?.setBadgeBackgroundColor({ color: '#d97706' });
}

function settlePendingPairing(result) {
  if (!pendingPairing) return;
  clearTimeout(pendingPairing.timer);
  const { notificationId, resolve } = pendingPairing;
  pendingPairing = null;
  chrome.notifications.clear(notificationId);
  setPendingBadge(null);
  resolve(result);
}

function requestPairingApproval(origin) {
  return new Promise(resolve => {
    if (pendingPairing) settlePendingPairing({ paired: false, reason: 'superseded by a newer pairing request' });
    const notificationId = `web-bridge-pairing-${crypto.randomUUID()}`;
    pendingPairing = {
      notificationId,
      origin,
      resolve,
      timer: setTimeout(() => settlePendingPairing({ paired: false, reason: 'pairing request timed out' }), PAIRING_REQUEST_TIMEOUT_MS),
    };
    setPendingBadge(origin);
    onPairingRequestedCallback?.();
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'AutoBro Web Bridge — pairing request',
      message: `${origin} wants to control this browser. Approve only if you opened that page yourself, or open the extension panel to respond.`,
      buttons: [{ title: 'Approve' }, { title: 'Deny' }],
      requireInteraction: true,
    }, () => {
      if (chrome.runtime.lastError) settlePendingPairing({ paired: false, reason: chrome.runtime.lastError.message });
    });
  });
}

chrome.notifications?.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (pendingPairing?.notificationId !== notificationId) return;
  settlePendingPairing(buttonIndex === 0 ? { paired: true } : { paired: false, reason: 'denied' });
});
chrome.notifications?.onClosed.addListener(notificationId => {
  if (pendingPairing?.notificationId !== notificationId) return;
  settlePendingPairing({ paired: false, reason: 'dismissed' });
});

// Panel-driven fallback for when the OS notification never renders: the
// panel polls this to know whether to show an approve/deny prompt, and calls
// resolvePendingPairingFromPanel() when the user clicks a button there.
export function getPendingPairingOrigin() {
  return pendingPairing?.origin ?? null;
}
export function resolvePendingPairingFromPanel(approved) {
  settlePendingPairing(approved ? { paired: true } : { paired: false, reason: 'denied from panel' });
}

export function start() {
  registerTransport('externalMessaging', { connected: () => true });

  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    (async () => {
      // Origin gating is enforced by the manifest; the token protects
      // against hostile content served from an allow-listed origin.
      const token = await pairingToken();
      if (message?.command === 'pair') {
        // Manual pairing: the user reads the token from the side panel and
        // types it into the controller. Kept as a fallback for callers that
        // can't show a browser notification.
        return { ok: true, paired: message.token === token };
      }
      if (message?.command === 'requestPairing') {
        // One-click alternative to 'pair' for a caller with no token yet: a
        // visible, unspoofable browser notification stands in for the
        // copy-pasted secret.
        const approval = await requestPairingApproval(sender.origin || 'an unknown origin');
        return approval.paired ? { paired: true, token } : { paired: false, reason: approval.reason };
      }
      if (message?.command === 'pairingTokenDebug' || message?.command === 'resetPairingTokenDebug') {
        // Handing the token to any allow-listed origin would defeat the
        // pairing token entirely, so these only answer when a debug flag has
        // been set by someone who already has extension access.
        const stored = await chrome.storage.local.get('webBridgeDebugPairing');
        if (stored.webBridgeDebugPairing !== true) {
          throw new Error(
            'pairing token debug is disabled. From the extension service-worker console run: ' +
            'chrome.storage.local.set({webBridgeDebugPairing: true}) — or read the token there directly.'
          );
        }
        if (message.command === 'resetPairingTokenDebug') {
          const nextToken = crypto.randomUUID();
          await chrome.storage.local.set({ [PAIRING_KEY]: nextToken });
          return { token: nextToken };
        }
        return { token };
      }
      if (message?.token !== token) throw new Error('unauthorized: pair first');
      if (message.command === 'health') return health();
      if (message.command === 'openPanelWindow') {
        if (!onOpenPanelRequestedCallback) throw new Error('panel opener is unavailable');
        await onOpenPanelRequestedCallback();
        return { opened: true };
      }
      return await execute(message, { timeoutMs: message.timeoutMs ?? 30_000 });
    })()
      .then(result => sendResponse({ ok: true, result }))
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true; // async response
  });
}
