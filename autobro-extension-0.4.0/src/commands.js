// Command surface, ported from extension/background.js (the original MV3
// extension): tabs, CDP core, MAIN-world helpers, key dispatch, upload, LLM
// proxy, and content-script routing.
// Full parity with bridge protocol v3.

import { guidewireCommandsAreEnabled } from './domain-registry.js';
import { GUIDEWIRE_COMMANDS, handleGuidewireCommand } from './domains/guidewire.js';
import * as webgpuLlm from './llm/webgpu-proxy.js';

const DEBUGGER_VERSION = '1.3';
const attachedTabs = new Set();
const pendingDialogs = new Map();
const networkState = new Map();

const promisify = (fn, ...args) =>
  new Promise((resolve, reject) =>
    fn(...args, value => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(value);
    })
  );

const tabInfo = tab => ({
  targetId: String(tab.id),
  target_id: String(tab.id),
  tabId: tab.id,
  title: tab.title || '',
  url: tab.url || ''
});

async function activeTab() {
  const tabs = await promisify(chrome.tabs.query, { active: true, lastFocusedWindow: true });
  if (tabs[0]?.id) return tabs[0];
  // When invoked from the service worker's DevTools console, the focused
  // window is DevTools itself (no tabs) — fall back to the most recently
  // used active tab of any normal browser window.
  const fallback = await promisify(chrome.tabs.query, { active: true, windowType: 'normal' });
  fallback.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (!fallback[0]?.id) throw new Error('No active tab');
  return fallback[0];
}

function assertSupportedTab(tab) {
  const url = tab?.url || '';
  if (/^(chrome|chrome-extension|edge|about|devtools):/i.test(url)) {
    throw new Error(`Cannot access ${url || 'this browser page'}. Open a normal web page first.`);
  }
  if (!/^https?:/i.test(url)) throw new Error(`Unsupported tab URL: ${url || '<empty>'}`);
}

// --- content script channel (same auto-reinject dance as the original) ----

async function sendContent(tabId, command, args = []) {
  const response = await promisify(chrome.tabs.sendMessage, tabId, {
    source: 'autobro-extension',
    command,
    args
  });
  if (!response?.ok) throw new Error(response?.error || `content command failed: ${command}`);
  return response.result;
}

async function contentCommand(tabId, command, args = []) {
  try {
    return await sendContent(tabId, command, args);
  } catch (error) {
    if (!String(error?.message || error).includes('Receiving end does not exist')) throw error;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return await sendContent(tabId, command, args);
  }
}

// --- MAIN-world injection (ported verbatim from background.js:113-348) ----

async function executeMain(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args
  });
  return result?.result;
}

function mainHighlight(target) {
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const value = String(target || '');
  if (!value) return { ok: false, reason: 'empty' };
  let element = document.getElementById(value);
  if (!element) {
    try { element = document.querySelector(value); } catch { element = null; }
  }
  if (!element) {
    const escaped = (window.CSS && CSS.escape) ? CSS.escape(value) : value;
    element = document.querySelector(`[name="${escaped}"]`);
  }
  if (!element) {
    const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2);
    element = tokens.length
      ? [...document.querySelectorAll('input,select,textarea,[id]')].find(node => {
          const haystack = `${node.id || ''} ${node.name || ''} ${clean(node.innerText || '')}`.toLowerCase();
          return tokens.every(token => haystack.includes(token));
        })
      : null;
  }
  if (!element) return { ok: false, reason: 'missing', target: value };

  document.getElementById('autobro-highlight')?.remove();
  document.getElementById('autobro-highlight-label')?.remove();
  document.getElementById('autobro-highlight-style')?.remove();

  const style = document.createElement('style');
  style.id = 'autobro-highlight-style';
  style.textContent = '@keyframes bhh-pulse{0%{box-shadow:0 0 0 3px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 22px 6px rgba(255,59,48,.9)}50%{box-shadow:0 0 0 6px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 36px 14px rgba(255,59,48,.7)}100%{box-shadow:0 0 0 3px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 22px 6px rgba(255,59,48,.9)}}'
    + '#autobro-highlight{position:fixed;z-index:2147483646;pointer-events:none;border-radius:5px;background:rgba(255,59,48,.10);outline:2px solid rgba(255,255,255,.95);outline-offset:1px;animation:bhh-pulse 1s ease-in-out infinite;transition:opacity .4s ease}'
    + '#autobro-highlight-label{position:fixed;z-index:2147483647;pointer-events:none;background:#ff3b30;color:#fff;font:600 12px/1.3 system-ui,sans-serif;padding:3px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .4s ease;max-width:360px;overflow:hidden;text-overflow:ellipsis}';
  (document.head || document.documentElement).appendChild(style);

  const box = document.createElement('div');
  box.id = 'autobro-highlight';
  const label = document.createElement('div');
  label.id = 'autobro-highlight-label';
  label.textContent = clean(element.getAttribute('name') || element.id || element.tagName || 'element').slice(0, 60);
  const place = () => {
    const rect = element.getBoundingClientRect();
    box.style.left = `${rect.left - 4}px`;
    box.style.top = `${rect.top - 4}px`;
    box.style.width = `${rect.width + 8}px`;
    box.style.height = `${rect.height + 8}px`;
    label.style.left = `${Math.max(4, rect.left - 4)}px`;
    label.style.top = `${rect.top - 26 < 4 ? rect.bottom + 6 : rect.top - 26}px`;
  };
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(label);
  try { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch { /* detached */ }
  place();

  const onMove = () => place();
  window.addEventListener('scroll', onMove, true);
  window.addEventListener('resize', onMove, true);
  let frames = 0;
  const tick = () => { place(); if (++frames < 48) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setTimeout(() => {
    window.removeEventListener('scroll', onMove, true);
    window.removeEventListener('resize', onMove, true);
    box.style.opacity = '0';
    label.style.opacity = '0';
    setTimeout(() => { box.remove(); label.remove(); style.remove(); }, 400);
  }, 3200);

  return { ok: true, id: element.id || '', name: element.name || '', tag: element.tagName, text: clean(element.innerText || element.value || '').slice(0, 120) };
}

function mainLocalLogin(username = 'su', password = 'gw') {
  const visible = element => Boolean(element?.offsetWidth || element?.offsetHeight || element?.getClientRects().length);
  const pageInfo = () => ({
    url: location.href,
    title: document.title,
    pageTitle: document.querySelector('#gw-center-title-toolbar')?.innerText || ''
  });
  const status = () => {
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const loginControls = inputs
      .filter(element => element.type === 'password' || /Login|username|password/i.test(`${element.name || ''} ${element.id || ''}`))
      .map(element => ({
        tag: element.tagName,
        type: element.type,
        id: element.id,
        name: element.name,
        value: element.type === 'password' ? '<password>' : element.value,
        disabled: element.disabled,
        readonly: element.readOnly
      }));
    return {
      ...pageInfo(),
      loggedIn: loginControls.length === 0 && /Guidewire PolicyCenter/i.test(document.title),
      loginForm: loginControls.length > 0,
      loginControls
    };
  };
  if (!/^https?:$/.test(location.protocol)) {
    return { ok: false, reason: `refusing localLogin on unsupported protocol: ${location.protocol}`, status: status() };
  }
  const inputs = [...document.querySelectorAll('input')].filter(visible);
  const user = inputs.find(element => element.type !== 'password' && /user|username|login/i.test(`${element.name || ''} ${element.id || ''}`))
    || inputs.find(element => element.type === 'text');
  const pass = inputs.find(element => element.type === 'password');
  if (!user || !pass) return { ok: false, reason: 'login form not visible', status: status() };

  const setValue = (element, value) => {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  setValue(user, username);
  setValue(pass, password);

  const submitCandidates = [...document.querySelectorAll('[id], button, input[type="button"], input[type="submit"], [role="button"], .gw-ButtonWidget, .gw-ButtonValueWidget, .gw-action--outer')]
    .filter(visible)
    .map(element => ({
      element,
      id: element.id || '',
      name: element.getAttribute('name') || '',
      text: `${element.innerText || ''} ${element.value || ''}`.replace(/\s+/g, ' ').trim(),
      className: String(element.className || ''),
      tag: element.tagName
    }))
    .filter(item => /Login.*submit|Log In|LogIn|Login|Submit|Update/i.test(`${item.id} ${item.name} ${item.text} ${item.className}`));
  const submit = submitCandidates.find(item => /submit|Log In|LogIn|Login/i.test(`${item.id} ${item.name} ${item.text}`))?.element
    || submitCandidates[0]?.element;
  if (submit) {
    const target = submit.querySelector?.('[data-gw-click]') || submit;
    const mode = globalThis.gwEvents?.abstractOnEvent ? 'gwEvents' : 'dom';
    if (mode === 'gwEvents') {
      globalThis.gwEvents.abstractOnEvent(target, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }), false);
    } else {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    return {
      ok: true,
      submitted: 'button',
      mode,
      submitTarget: {
        id: submit.id || '',
        text: `${submit.innerText || ''} ${submit.value || ''}`.replace(/\s+/g, ' ').trim(),
        tag: submit.tagName,
        className: String(submit.className || '')
      },
      candidates: submitCandidates.map(({ element: _element, ...item }) => item).slice(0, 20),
      status: status()
    };
  }

  const form = pass.closest('form');
  if (form?.requestSubmit) {
    form.requestSubmit();
    return {
      ok: true,
      submitted: 'form',
      mode: 'requestSubmit',
      candidates: submitCandidates.map(({ element: _element, ...item }) => item).slice(0, 20),
      status: status()
    };
  }
  pass.focus();
  pass.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  pass.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  return {
    ok: true,
    submitted: 'enter',
    mode: 'keyboard',
    candidates: submitCandidates.map(({ element: _element, ...item }) => item).slice(0, 20),
    status: status()
  };
}

// --- CDP via chrome.debugger --------------------------------------------

async function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) return { attached: true, reused: true };
  await promisify(chrome.debugger.attach, { tabId }, DEBUGGER_VERSION);
  attachedTabs.add(tabId);
  for (const domain of ['Page.enable', 'Runtime.enable', 'Network.enable']) {
    chrome.debugger.sendCommand({ tabId }, domain, {}, () => chrome.runtime.lastError);
  }
  return { attached: true, reused: false };
}

const cdp = (tabId, method, params = {}) =>
  promisify(chrome.debugger.sendCommand, { tabId }, method, params);

async function runtimeEval(tabId, expression, awaitPromise = true) {
  await attachDebugger(tabId);
  const response = await cdp(tabId, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        'Runtime.evaluate failed'
    );
  }
  return response.result?.value ?? response.result?.unserializableValue ?? null;
}

function tabNetworkState(tabId) {
  const id = Number(tabId);
  let state = networkState.get(id);
  if (!state) {
    state = { inflight: new Set(), lastActivity: Date.now() };
    networkState.set(id, state);
  }
  return state;
}

chrome.debugger.onDetach.addListener(source => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!source.tabId) return;
  if (method === 'Page.javascriptDialogOpening') pendingDialogs.set(source.tabId, params);
  if (method === 'Page.javascriptDialogClosed') pendingDialogs.delete(source.tabId);
  if (method.startsWith('Network.')) {
    const state = tabNetworkState(source.tabId);
    if (method === 'Network.requestWillBeSent') state.inflight.add(params.requestId);
    if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      state.inflight.delete(params.requestId);
    }
    state.lastActivity = Date.now();
  }
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Full CDP key dispatch, ported from background.js:422-448.
const KEYS = {
  Enter: [13, 'Enter', '\r'],
  Tab: [9, 'Tab', '\t'],
  Backspace: [8, 'Backspace', ''],
  Escape: [27, 'Escape', ''],
  Delete: [46, 'Delete', ''],
  ' ': [32, 'Space', ' '],
  ArrowLeft: [37, 'ArrowLeft', ''],
  ArrowUp: [38, 'ArrowUp', ''],
  ArrowRight: [39, 'ArrowRight', ''],
  ArrowDown: [40, 'ArrowDown', ''],
  Home: [36, 'Home', ''],
  End: [35, 'End', ''],
  PageUp: [33, 'PageUp', ''],
  PageDown: [34, 'PageDown', '']
};

async function pressKey(tabId, key, modifiers = 0) {
  await attachDebugger(tabId);
  const [vk, code, text] = KEYS[key] || [key.length === 1 ? key.charCodeAt(0) : 0, key, key.length === 1 ? key : ''];
  const base = { key, code, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  const printable = key.length === 1 && Boolean(text) && !(modifiers & (1 | 2 | 4));
  await cdp(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(printable || !text ? {} : { text }) });
  if (printable) await cdp(tabId, 'Input.dispatchKeyEvent', { type: 'char', text, ...base });
  await cdp(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  return { ok: true, key, modifiers };
}

// --- tab helpers shared by commands -------------------------------------

async function listTabs(includeChrome = true) {
  const tabs = await promisify(chrome.tabs.query, {});
  return tabs
    .filter(tab => includeChrome || !/^(chrome|chrome-extension|edge|about|devtools):/i.test(tab.url || ''))
    .map(tabInfo);
}

async function switchTab(target) {
  const tabId = typeof target === 'object' ? (target.tabId || target.targetId || target.target_id) : target;
  if (!tabId) throw new Error('switchTab requires a tabId or targetId');
  return tabInfo(await promisify(chrome.tabs.update, Number(tabId), { active: true }));
}

async function ensureRealTab() {
  const tab = await activeTab().catch(() => null);
  if (tab?.url && !/^(chrome|chrome-extension|edge|about|devtools):/i.test(tab.url)) return tabInfo(tab);
  const tabs = await listTabs(false);
  if (!tabs.length) return null;
  return await switchTab(tabs[0].tabId);
}

// --- LLM provider ----------------------------------------------------------
// LLM inference is provided exclusively by the authenticated Herdr parent page.
async function openLlmHost() {
  return await webgpuLlm.ensureHost();
}

// --- command implementations ----------------------------------------------

const CONTENT_COMMANDS = new Set([
  'pageInfo', 'loginStatus', 'inventoryCurrentPage', 'extractMessages',
  'visibleActions', 'relatedActions', 'extractGrids', 'findSearchAction',
  'fillInput', 'setSelect', 'elementState', 'dispatchKey', 'showWidget'
]);

export async function handleCommand(message) {
  switch (message.command) {
    case 'llmModels':
      return await webgpuLlm.models();
    case 'llmChatCompletions':
      return await webgpuLlm.chat(message.body || {});
    case 'llmStatus':
      return await webgpuLlm.status();
    case 'llmLoadModel':
      return await webgpuLlm.loadModel(message.name ?? message.args?.[0]);
    case 'llmLoadUrl':
      return await webgpuLlm.loadUrl(message.url ?? message.args?.[0]);
    case 'listTabs':
      return await listTabs(message.includeChrome ?? message.args?.[0] ?? true);
    case 'newTab':
      return tabInfo(
        await promisify(chrome.tabs.create, {
          url: message.url ?? message.args?.[0] ?? 'about:blank',
          active: true
        })
      );
    case 'switchTab':
      return await switchTab(message.target ?? message.args?.[0]);
    case 'ensureRealTab':
      return await ensureRealTab();
    case 'openLlmHost':
      return await openLlmHost();
  }

  const tab = message.tabId ? { id: Number(message.tabId), url: message.url || '' } : await activeTab();
  if (!message.tabId && !['activeTab', 'currentTab', 'closeTab', 'gotoUrl'].includes(message.command)) {
    assertSupportedTab(tab);
  }
  const tabId = tab.id;

  if (GUIDEWIRE_COMMANDS.has(message.command)) {
    if (!await guidewireCommandsAreEnabled()) {
      throw new Error(`${message.command} is a Guidewire command. Load the Guidewire PolicyCenter skill pack before using it.`);
    }
    return await handleGuidewireCommand(message, { executeMain, tabId });
  }

  switch (message.command) {
    case 'activeTab':
    case 'currentTab':
      return tabInfo(message.tabId ? await promisify(chrome.tabs.get, tabId) : tab);
    case 'closeTab':
      await promisify(chrome.debugger.detach, { tabId }).catch(() => undefined);
      attachedTabs.delete(tabId);
      await promisify(chrome.tabs.remove, tabId);
      return { closed: true, tabId };
    case 'gotoUrl': {
      const url = message.url ?? message.args?.[0];
      if (!/^https?:|^about:blank$/i.test(url)) throw new Error(`Unsupported navigation URL: ${url}`);
      return tabInfo(await promisify(chrome.tabs.update, tabId, { url, active: true }));
    }
    case 'attach':
      return await attachDebugger(tabId);
    case 'detach':
      await promisify(chrome.debugger.detach, { tabId }).catch(() => undefined);
      attachedTabs.delete(tabId);
      return { detached: true };
    case 'cdp':
      await attachDebugger(tabId);
      return await cdp(tabId, message.method, message.params || {});
    case 'js':
      return await runtimeEval(tabId, message.expression);
    case 'clickAtXY': {
      await attachDebugger(tabId);
      const { x, y, button = 'left', clicks = 1 } = message;
      await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: 1, clickCount: clicks });
      await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: clicks });
      return { ok: true, x, y, button, clicks };
    }
    case 'typeText':
      await attachDebugger(tabId);
      await cdp(tabId, 'Input.insertText', { text: message.text || '' });
      return { ok: true, length: (message.text || '').length };
    case 'pressKey':
      return await pressKey(tabId, message.key, message.modifiers || 0);
    case 'scroll': {
      await attachDebugger(tabId);
      const [x = 0, y = 0, dy = -300, dx = 0] = [
        message.x ?? message.args?.[0], message.y ?? message.args?.[1],
        message.dy ?? message.args?.[2], message.dx ?? message.args?.[3]
      ];
      await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy });
      return { ok: true, x, y, dx, dy };
    }
    case 'captureScreenshot': {
      await attachDebugger(tabId);
      const full = message.full ?? message.args?.[0] ?? false;
      const result = await cdp(tabId, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
      return { mimeType: 'image/png', data: result.data, full };
    }
    case 'waitForLoad': {
      const deadline = Date.now() + Number(message.timeout ?? message.args?.[0] ?? 15) * 1000;
      while (Date.now() < deadline) {
        const readyState = await runtimeEval(tabId, 'document.readyState').catch(() => null);
        if (readyState === 'complete') return { ok: true, readyState };
        await sleep(300);
      }
      return { ok: false, readyState: null };
    }
    case 'waitForElement': {
      const selector = message.selector ?? message.args?.[0];
      const visibleOnly = message.visible ?? message.args?.[2] ?? false;
      const deadline = Date.now() + Number(message.timeout ?? message.args?.[1] ?? 10) * 1000;
      while (Date.now() < deadline) {
        const state = await contentCommand(tabId, 'elementState', [selector, visibleOnly]).catch(() => null);
        if (state?.found && (!visibleOnly || state.visible)) return { ok: true, ...state };
        await sleep(300);
      }
      return { ok: false, selector, visibleOnly };
    }
    case 'waitNetworkIdle': {
      await attachDebugger(tabId);
      const state = tabNetworkState(tabId);
      const idleMs = Number(message.idleMs ?? message.args?.[1] ?? 500);
      const deadline = Date.now() + Number(message.timeout ?? message.args?.[0] ?? 10) * 1000;
      while (Date.now() < deadline) {
        const quietFor = Date.now() - state.lastActivity;
        if (state.inflight.size === 0 && quietFor >= idleMs) return { ok: true, idleMs, inflight: 0, quietFor };
        await sleep(100);
      }
      return { ok: false, idleMs, inflight: state.inflight.size, quietFor: Date.now() - state.lastActivity };
    }
    case 'pendingDialog':
      return pendingDialogs.get(tabId) || null;
    case 'acceptDialog': {
      await attachDebugger(tabId);
      const accept = message.accept ?? message.args?.[0] ?? true;
      const promptText = message.promptText ?? message.args?.[1];
      await cdp(tabId, 'Page.handleJavaScriptDialog', { accept, ...(promptText === undefined ? {} : { promptText }) });
      pendingDialogs.delete(tabId);
      return { ok: true, accepted: accept };
    }
    case 'uploadFile': {
      // Paths are local to the machine running Chrome (same as the Go-bridge
      // era, since chrome.debugger is unchanged). A base64-content variant
      // for remote callers is future work.
      const selector = message.selector ?? message.args?.[0];
      const files = message.files ?? message.args?.[1];
      const fileList = Array.isArray(files) ? files : [files];
      if (!fileList.length || fileList.some(file => typeof file !== 'string' || !file)) {
        throw new Error('uploadFile requires one or more absolute file paths');
      }
      await attachDebugger(tabId);
      const doc = await cdp(tabId, 'DOM.getDocument', { depth: -1 });
      const found = await cdp(tabId, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      if (!found.nodeId) throw new Error(`uploadFile: element not found: ${selector}`);
      await cdp(tabId, 'DOM.setFileInputFiles', { nodeId: found.nodeId, files: fileList });
      return { ok: true, selector, files: fileList };
    }
    case 'highlightElement':
      return await executeMain(tabId, mainHighlight, message.args || []);
    case 'localLogin': {
      const result = await executeMain(tabId, mainLocalLogin, message.args || []);
      const deadline = Date.now() + 15_000;
      let finalStatus = null;
      while (Date.now() < deadline) {
        await sleep(500);
        finalStatus = await contentCommand(tabId, 'loginStatus', []).catch(() => null);
        if (finalStatus && !finalStatus.loginForm) break;
      }
      if (finalStatus?.loginForm) {
        await pressKey(tabId, 'Enter').catch(() => undefined);
        const secondDeadline = Date.now() + 8_000;
        while (Date.now() < secondDeadline) {
          await sleep(500);
          finalStatus = await contentCommand(tabId, 'loginStatus', []).catch(() => null);
          if (finalStatus && !finalStatus.loginForm) break;
        }
      }
      return { ...result, finalStatus };
    }
    default:
      if (CONTENT_COMMANDS.has(message.command)) {
        return await contentCommand(tabId, message.command, message.args || []);
      }
      throw new Error(`unknown command: ${message.command}`);
  }
}
