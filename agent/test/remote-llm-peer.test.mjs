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

class FakePeer {
  constructor() { this.handlers = new Map(); queueMicrotask(() => this.emit('open', 'desktop-peer')); }
  on(type, handler) { const handlers = this.handlers.get(type) || []; handlers.push(handler); this.handlers.set(type, handlers); }
  once(type, handler) { this.on(type, handler); }
  emit(type, value) { for (const handler of this.handlers.get(type) || []) handler(value); }
  destroy() {}
}

test('remote hosting can start before the desktop model is loaded', async () => {
  const remote = new RemoteLlmPeer({ Peer: FakePeer, getLlmClient: () => null });
  const key = await remote.host();
  assert.match(key, /^desktop-peer\.[a-f0-9]{32}$/);
});

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

test('authenticated phone audio is transcribed on desktop and answered by the LLM', async () => {
  let receivedAudio;
  const host = new RemoteLlmPeer({
    Peer: class {},
    transcribeAudio: async (audio, mimeType) => {
      receivedAudio = { audio, mimeType };
      return 'spoken request';
    },
    getLlmClient: () => ({
      async chatStream(body, onChunk) {
        assert.equal(body.messages[0].content, 'spoken request');
        await onChunk('voice answer');
        return { choices: [{ message: { content: 'voice answer' } }] };
      },
    }),
  });
  host.secret = 'c'.repeat(32);
  const connection = new FakeConnection();
  host.accept(connection);
  connection.emit('data', { type: 'auth', secret: host.secret });
  connection.emit('data', { type: 'voice.transcribe', id: 'voice-1', mimeType: 'audio/webm;codecs=opus', audio: new Uint8Array([1, 2, 3]).buffer });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(receivedAudio.mimeType, 'audio/webm;codecs=opus');
  assert.equal(receivedAudio.audio.byteLength, 3);
  assert.deepEqual(connection.sent, [
    { type: 'auth.ok' },
    { type: 'voice.progress', id: 'voice-1', stage: 'Recording received by desktop' },
    { type: 'voice.transcript', id: 'voice-1', text: 'spoken request' },
    { type: 'llm.chunk', id: 'voice-1', delta: 'voice answer' },
    { type: 'llm.done', id: 'voice-1' },
  ]);
});

test('mobile voice request exposes transcript and streamed response callbacks', async () => {
  const mobile = new RemoteLlmPeer({ Peer: class {}, getLlmClient: () => null });
  const connection = new FakeConnection();
  mobile.connection = connection;
  mobile.bindResults(connection);
  let transcript = '';
  let streamed = '';
  let progress = '';
  const result = mobile.voice(new Uint8Array([1]).buffer, {
    mimeType: 'audio/webm',
    onTranscript: value => { transcript = value; },
    onChunk: value => { streamed += value; },
    onProgress: value => { progress = value; },
  });
  const request = connection.sent[0];
  connection.emit('data', { type: 'voice.progress', id: request.id, stage: 'Transcribing locally on desktop' });
  connection.emit('data', { type: 'voice.transcript', id: request.id, text: 'hello by voice' });
  connection.emit('data', { type: 'llm.chunk', id: request.id, delta: 'hello back' });
  connection.emit('data', { type: 'llm.done', id: request.id });
  assert.equal(await result, 'hello back');
  assert.equal(transcript, 'hello by voice');
  assert.equal(streamed, 'hello back');
  assert.equal(progress, 'Transcribing locally on desktop');
  assert.equal(request.type, 'voice.transcribe');
});

test('mobile remote page does not load the VM or local model runtime', async () => {
  const html = await readFile(new URL('../../remote.html', import.meta.url), 'utf8');
  for (const forbidden of ['libv86', 'v86-network', 'xterm.js', 'litert-lm-client', 'bzImage', 'ext4.img']) {
    assert.equal(html.includes(forbidden), false, `remote.html unexpectedly includes ${forbidden}`);
  }
  assert.match(html, /remote-llm-peer\.js/);
});
