import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteLlmPeer } from '../../network/browser/remote-llm-peer.js';

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

class FakeConnection {
  constructor() { this.open = true; this.handlers = new Map(); this.sent = []; }
  on(type, handler) { const handlers = this.handlers.get(type) || []; handlers.push(handler); this.handlers.set(type, handlers); }
  emit(type, value) { for (const handler of this.handlers.get(type) || []) handler(value); }
  send(message) { this.sent.push(message); }
  close() { this.open = false; }
}

test('remote LLM host authenticates and serves a direct model response', async () => {
  const remote = new RemoteLlmPeer({
    Peer: class {},
    getLlmClient: () => ({ async chat() { return { choices: [{ message: { content: 'from desktop' } }] }; } }),
  });
  remote.secret = 'a'.repeat(32);
  const connection = new FakeConnection();
  remote.accept(connection);
  connection.emit('data', { type: 'auth', secret: remote.secret });
  connection.emit('data', { type: 'llm.chat', id: 'request-1', prompt: 'hello' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(connection.sent, [
    { type: 'auth.ok' },
    { type: 'llm.result', id: 'request-1', content: 'from desktop' },
  ]);
});

test('remote LLM client correlates responses without invoking an agent', async () => {
  const remote = new RemoteLlmPeer({ Peer: class {}, getLlmClient: () => null });
  const connection = new FakeConnection();
  remote.connection = connection;
  remote.bindResults(connection);
  const result = remote.chat('hello');
  const request = connection.sent[0];
  connection.emit('data', { type: 'llm.result', id: request.id, content: 'direct answer' });
  assert.equal(await result, 'direct answer');
  assert.equal(request.type, 'llm.chat');
  assert.equal(request.prompt, 'hello');
});
