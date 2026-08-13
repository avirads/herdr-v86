// Declarative manifest of the VM providers vmbro can run.
//
// This exists so the pages, Settings UI, and diagnostics can describe a
// provider without importing its runtime — importing the v86 provider pulls in
// libv86 and a disk image, and importing the CheerpX provider only works on a
// cross-origin-isolated page. Everything here is plain data.
//
// `status` is deliberately part of the contract. CheerpX is declared before it
// is built so the chooser can show it as unavailable with an honest reason,
// rather than the page silently offering a provider that cannot boot.

/** @typedef {'ready'|'planned'} ProviderStatus */

export const PROVIDERS = {
  v86: {
    id: 'v86',
    label: 'v86',
    status: /** @type {ProviderStatus} */ ('ready'),
    page: './index.html',
    summary: 'Emulated 32-bit Alpine Linux. Works on any browser, no isolation headers.',
    guest: {
      distribution: 'Alpine Linux',
      architecture: 'i386',
      shell: 'BusyBox sh',
      workspace: '/root/project',
    },
    imageManifest: './vm-images.json',
    // v86 runs without COOP/COEP, which is why the PeerJS remote chat,
    // Moonshine voice, and the AutoBro extension bridge all work on this page.
    requiresCrossOriginIsolation: false,
    capabilities: {
      terminal: true,
      browserBridge: true,      // vmfetch / vmclip / vmexport / vmgithub
      gatewayNetworking: true,  // full IPv4 via the WebSocket gateway or AutoBro
      devIde: true,
      localLlm: true,           // LiteRT-LM WebGPU, page-local
      cloudLlm: true,           // shared/llm-provider-router.js
      voiceInput: true,
      remoteChat: true,         // WebRTC pairing to a phone
      agents: ['vmlang', 'rig', 'vmmastra'],
    },
  },

  cheerpx: {
    id: 'cheerpx',
    label: 'CheerpX',
    status: /** @type {ProviderStatus} */ ('ready'),
    page: './cx/index.html',
    summary: 'JIT-compiled x86 Debian. Real Node and Python, at the cost of isolation headers.',
    guest: {
      distribution: 'Debian',
      architecture: 'i386',
      shell: 'bash',
      workspace: '/root/project',
    },
    imageManifest: './images/cheerpx/cx-images.json',
    // CheerpX needs COOP: same-origin + COEP, which is why it gets its own
    // route instead of sharing index.html.
    requiresCrossOriginIsolation: true,
    capabilities: {
      terminal: true,
      browserBridge: true,
      gatewayNetworking: false, // browser-bridge only in phase 1; no Tailscale
      devIde: true,
      localLlm: true,
      cloudLlm: true,
      voiceInput: false,
      remoteChat: false,
      agents: [],               // deferred to phase 2
    },
  },
};

export const DEFAULT_PROVIDER = 'v86';

const STORAGE_KEY = 'vmbro.provider';

/** Providers that can actually be booted today. */
export function availableProviders() {
  return Object.values(PROVIDERS).filter(provider => provider.status === 'ready');
}

export function getProvider(id) {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER];
}

/**
 * Last provider the user chose, falling back to the default. Never returns a
 * provider that is not `ready`, so a stored value written by a future build
 * cannot strand an older page on a provider it cannot start.
 */
export function rememberedProvider(storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (stored && PROVIDERS[stored]?.status === 'ready') return stored;
  } catch {
    // Private-mode storage denial is not a reason to fail to pick a provider.
  }
  return DEFAULT_PROVIDER;
}

export function rememberProvider(id, storage = globalThis.localStorage) {
  if (!PROVIDERS[id]) throw new Error(`unknown provider: ${id}`);
  try {
    storage?.setItem(STORAGE_KEY, id);
  } catch {
    // Best-effort: the choice still applies to this page load.
  }
}
