import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  PROVIDERS,
  DEFAULT_PROVIDER,
  availableProviders,
  getProvider,
  rememberedProvider,
  rememberProvider,
} from '../../providers/provider-registry.js';

const root = new URL('../../', import.meta.url);

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const denyingStorage = {
  getItem() { throw new Error('storage denied'); },
  setItem() { throw new Error('storage denied'); },
};

test('every provider declares the fields the chooser and diagnostics read', () => {
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    assert.equal(provider.id, id, `${id} id must match its key`);
    assert.ok(provider.label, `${id} needs a label`);
    assert.ok(['ready', 'planned'].includes(provider.status), `${id} status`);
    assert.ok(provider.page, `${id} needs a page`);
    assert.ok(provider.capabilities, `${id} needs capabilities`);
    assert.ok(Array.isArray(provider.capabilities.agents), `${id} agents must be a list`);
  }
});

test('a provider that is not ready explains why', () => {
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.status !== 'ready') {
      assert.ok(
        provider.unavailableReason,
        `${provider.id} is not ready and must say why, so the chooser can be honest`,
      );
    }
  }
});

test('both providers are ready and offered by the chooser', () => {
  assert.equal(PROVIDERS.v86.status, 'ready');
  assert.equal(PROVIDERS.cheerpx.status, 'ready');
  assert.deepEqual(availableProviders().map(p => p.id).sort(), ['cheerpx', 'v86']);
});

test('a ready provider points at a page that exists', async () => {
  const { access } = await import('node:fs/promises');
  for (const provider of availableProviders()) {
    const relative = provider.page.replace(/^\.\//, '');
    await access(new URL(relative, root));
  }
});

test('only CheerpX demands cross-origin isolation', () => {
  // v86 must stay usable without COOP/COEP: the PeerJS remote chat, Moonshine
  // voice, and the AutoBro extension bridge all depend on that.
  assert.equal(PROVIDERS.v86.requiresCrossOriginIsolation, false);
  assert.equal(PROVIDERS.cheerpx.requiresCrossOriginIsolation, true);
});

test('the default provider is ready and resolvable', () => {
  assert.equal(PROVIDERS[DEFAULT_PROVIDER].status, 'ready');
  assert.equal(getProvider(DEFAULT_PROVIDER).id, DEFAULT_PROVIDER);
});

test('an unknown provider id falls back to the default rather than throwing', () => {
  assert.equal(getProvider('does-not-exist').id, DEFAULT_PROVIDER);
});

test('a remembered provider is honoured when it is ready', () => {
  for (const provider of availableProviders()) {
    assert.equal(rememberedProvider(fakeStorage({ 'vmbro.provider': provider.id })), provider.id);
  }
  assert.equal(rememberedProvider(fakeStorage()), DEFAULT_PROVIDER);
});

test('a remembered provider this build cannot run falls back to the default', () => {
  // A value written by a future build, or a provider later withdrawn: the page
  // must not strand the user on something it cannot boot.
  assert.equal(rememberedProvider(fakeStorage({ 'vmbro.provider': 'from-a-newer-build' })), DEFAULT_PROVIDER);

  const notReady = Object.values(PROVIDERS).find(p => p.status !== 'ready');
  if (notReady) {
    assert.equal(rememberedProvider(fakeStorage({ 'vmbro.provider': notReady.id })), DEFAULT_PROVIDER);
  }
});

test('storage denial degrades to the default instead of breaking the page', () => {
  assert.equal(rememberedProvider(denyingStorage), DEFAULT_PROVIDER);
  assert.doesNotThrow(() => rememberProvider('v86', denyingStorage));
});

test('remembering an unknown provider is rejected', () => {
  assert.throws(() => rememberProvider('nope', fakeStorage()), /unknown provider/);
});

test('declared image manifests exist for ready providers', async () => {
  for (const provider of availableProviders()) {
    const relative = provider.imageManifest.replace(/^\.\//, '');
    const manifest = JSON.parse(await readFile(new URL(relative, root), 'utf8'));
    assert.ok(manifest.tiers, `${provider.id} manifest needs tiers`);
  }
});
