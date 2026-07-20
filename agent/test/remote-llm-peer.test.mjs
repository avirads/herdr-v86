import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { LiteRtLmClient } from '../../network/browser/litert-lm-client.js';
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

test('LiteRT and WebRTC stream generated chunks to the mobile client', async () => {
  const llm = new LiteRtLmClient();
  llm.modelName = 'test-model';
  llm.engine = {
    async createConversation() {
      return {
        sendMessageStreaming() {
          return new ReadableStream({ start(controller) {
            controller.enqueue({ role: 'assistant', content: 'hello ' });
            controller.enqueue({ role: 'assistant', content: 'mobile' });
            controller.close();
          }});
        },
        async delete() {},
      };
    },
  };
  const host = new RemoteLlmPeer({ Peer: class {}, getLlmClient: () => llm });
  host.secret = 'b'.repeat(32);
  const connection = new FakeConnection();
  host.accept(connection);
  connection.emit('data', { type: 'auth', secret: host.secret });
  connection.emit('data', { type: 'llm.chat', id: 'stream-1', prompt: 'hello' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(connection.sent, [
    { type: 'auth.ok' },
    { type: 'llm.chunk', id: 'stream-1', delta: 'hello ' },
    { type: 'llm.chunk', id: 'stream-1', delta: 'mobile' },
    { type: 'llm.done', id: 'stream-1' },
  ]);

  const mobile = new RemoteLlmPeer({ Peer: class {}, getLlmClient: () => null });
  const mobileConnection = new FakeConnection();
  mobile.connection = mobileConnection;
  mobile.bindResults(mobileConnection);
  const chunks = [];
  const result = mobile.chat('hello', { onChunk: chunk => chunks.push(chunk) });
  const request = mobileConnection.sent[0];
  mobileConnection.emit('data', { type: 'llm.chunk', id: request.id, delta: 'hello ' });
  mobileConnection.emit('data', { type: 'llm.chunk', id: request.id, delta: 'mobile' });
  mobileConnection.emit('data', { type: 'llm.done', id: request.id });
  assert.equal(await result, 'hello mobile');
  assert.deepEqual(chunks, ['hello ', 'mobile']);
});

test('mobile remote page does not load the VM or local model runtime', async () => {
  const html = await readFile(new URL('../../remote.html', import.meta.url), 'utf8');
  for (const forbidden of ['libv86', 'v86-network', 'xterm.js', 'litert-lm-client', 'bzImage', 'ext4.img']) {
    assert.equal(html.includes(forbidden), false, `remote.html unexpectedly includes ${forbidden}`);
  }
  assert.match(html, /remote-llm-peer\.js/);
});
