import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoBroClient, probeAutoBro, requestAutoBroPairing } from '../../network/browser/autobro-client.js';

const EXT_ID = 'a'.repeat(32);

test('AutoBro client pairs without leaking token rules and authenticates commands', async () => {
  const messages = [];
  globalThis.chrome = { runtime: {
    lastError: null,
    sendMessage(extensionId, message, callback) {
      messages.push({ extensionId, message });
      if (message.command === 'pair') callback({ ok: true, result: { paired: true } });
      else callback({ ok: true, result: { bridgeVersion: 3 } });
    },
  } };
  try {
    const client = new AutoBroClient({ extensionId: 'a'.repeat(32), token: 'secret-token' });
    assert.equal((await client.pair()).bridgeVersion, 3);
    await client.command('gotoUrl', { url: 'https://www.google.com/' });
    assert.equal(messages[0].message.token, 'secret-token');
    assert.equal(messages[1].message.token, 'secret-token');
    assert.equal(messages[2].message.command, 'gotoUrl');
    assert.equal(messages[2].message.url, 'https://www.google.com/');
  } finally {
    delete globalThis.chrome;
  }
});

test('AutoBro client exposes the ready VM page-local LLM over the paired port', async () => {
  const portMessages = [];
  let onPortMessage;
  const port = {
    onMessage: { addListener(listener) { onPortMessage = listener; } },
    onDisconnect: { addListener() {} },
    postMessage(message) { portMessages.push(message); },
  };
  globalThis.chrome = { runtime: {
    lastError: null,
    sendMessage(_extensionId, message, callback) {
      if (message.command === 'pair') callback({ ok: true, result: { paired: true } });
      else callback({ ok: true, result: { bridgeVersion: 3 } });
    },
    connect() { return port; },
  } };
  try {
    const llm = {
      async status() { return { modelName: 'page-model', provider: 'page-local-litert-lm' }; },
      async models() { return { data: [{ id: 'page-model' }] }; },
      async chat() { return { choices: [{ message: { content: 'hello' } }] }; },
    };
    const client = new AutoBroClient({ extensionId: 'a'.repeat(32), token: 'secret-token', getLlmClient: () => llm });
    await client.pair();
    assert.deepEqual(portMessages[0], { type: 'llm-provider-hello', token: 'secret-token' });
    await onPortMessage({ type: 'llm-request', id: 'request-1', method: 'chat', body: { messages: [{ role: 'user', content: 'hi' }] } });
    assert.deepEqual(portMessages[1], { type: 'llm-response', id: 'request-1', ok: true, result: { choices: [{ message: { content: 'hello' } }] } });
  } finally {
    delete globalThis.chrome;
  }
});

test('probeAutoBro detects a reachable extension without needing a token', async () => {
  const calls = [];
  globalThis.chrome = { runtime: {
    lastError: null,
    sendMessage(extensionId, message, callback) {
      calls.push({ extensionId, message });
      callback({ ok: true, result: { paired: false } });
    },
  } };
  try {
    assert.equal(await probeAutoBro(EXT_ID), true);
    assert.equal(calls[0].extensionId, EXT_ID);
    assert.equal(calls[0].message.command, 'pair');
    assert.equal(calls[0].message.token, '');
  } finally {
    delete globalThis.chrome;
  }
});

test('probeAutoBro reports false when no extension answers', async () => {
  globalThis.chrome = { runtime: {
    sendMessage(_extensionId, _message, callback) {
      chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
      callback(undefined);
      chrome.runtime.lastError = null;
    },
  } };
  try {
    assert.equal(await probeAutoBro(EXT_ID), false);
  } finally {
    delete globalThis.chrome;
  }
});

test('probeAutoBro reports false without throwing when Chrome messaging is unavailable', async () => {
  assert.equal(await probeAutoBro(EXT_ID), false);
});

test('requestAutoBroPairing resolves the granted token on approval', async () => {
  const calls = [];
  globalThis.chrome = { runtime: {
    lastError: null,
    sendMessage(extensionId, message, callback) {
      calls.push({ extensionId, message });
      callback({ ok: true, result: { paired: true, token: 'granted-token' } });
    },
  } };
  try {
    const token = await requestAutoBroPairing(EXT_ID);
    assert.equal(token, 'granted-token');
    assert.equal(calls[0].message.command, 'requestPairing');
    assert.equal(calls[0].message.token, undefined);
  } finally {
    delete globalThis.chrome;
  }
});

test('requestAutoBroPairing throws with the denial reason when not approved', async () => {
  globalThis.chrome = { runtime: {
    lastError: null,
    sendMessage(_extensionId, _message, callback) {
      callback({ ok: true, result: { paired: false, reason: 'denied' } });
    },
  } };
  try {
    await assert.rejects(requestAutoBroPairing(EXT_ID), /denied/);
  } finally {
    delete globalThis.chrome;
  }
});
