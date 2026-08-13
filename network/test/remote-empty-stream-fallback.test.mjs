import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { RemoteLlmPeer } from '../../shared/remote-llm-peer.js';

const source = await readFile(new URL('../../shared/remote-llm-peer.js', import.meta.url), 'utf8');

test('WebRTC uses the same stable non-streaming LiteRT path as terminal agents', () => {
  const servePrompt = source.slice(source.indexOf('async servePrompt'), source.indexOf('async connect'));
  assert.match(servePrompt, /const completion = await client\.chat\(body\)/);
  assert.match(servePrompt, /if \(!content\.trim\(\)\) throw new Error\('the AI model returned an empty response'\)/);
  assert.match(servePrompt, /connection\.send\(response\)/);
  assert.doesNotMatch(servePrompt, /client\.chatStream|llm\.chunk|llm\.done/);
});

test('WebRTC sends a visible non-streaming completion to the phone', async () => {
  globalThis.CustomEvent ??= class CustomEvent extends Event {
    constructor(type, options) { super(type); this.detail = options?.detail; }
  };
  const sent = [];
  const peer = new RemoteLlmPeer({
    Peer: class {},
    getLlmClient: () => ({
      async chat(body) {
        assert.equal(body.messages[0].content, 'hi');
        return { choices: [{ message: { content: 'Hello from the agent' } }] };
      },
    }),
  });
  await peer.servePrompt({ send: message => sent.push(message) }, 'request-1', 'hi');
  assert.deepEqual(sent, [{ type: 'llm.result', id: 'request-1', content: 'Hello from the agent' }]);
});
