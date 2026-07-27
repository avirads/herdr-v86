const GUIDEWIRE_ENABLED_KEY = 'webBridgeGuidewireCommandsEnabled';

let guidewireCommandsEnabled = false;
let loaded = false;

const storageGet = key => new Promise(resolve => chrome.storage.local.get(key, resolve));
const storageSet = value => new Promise(resolve => chrome.storage.local.set(value, resolve));

export async function loadDomainCommandState() {
  if (loaded) return;
  const stored = await storageGet(GUIDEWIRE_ENABLED_KEY);
  guidewireCommandsEnabled = stored[GUIDEWIRE_ENABLED_KEY] === true;
  loaded = true;
}

export async function enableGuidewireCommands() {
  guidewireCommandsEnabled = true;
  loaded = true;
  await storageSet({ [GUIDEWIRE_ENABLED_KEY]: true });
}

export async function guidewireCommandsAreEnabled() {
  await loadDomainCommandState();
  return guidewireCommandsEnabled;
}

export function isGuidewireSkillPath(path) {
  return /(^|\/)policycenter-[^/]+\.md$/i.test(path || '');
}
