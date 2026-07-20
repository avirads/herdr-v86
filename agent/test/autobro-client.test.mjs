import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoBroClient } from '../../network/browser/autobro-client.js';

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
