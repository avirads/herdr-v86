// CheerpX host bridge: response framing, transport, and — the point of the
// whole exercise — that LLM traffic goes through the SHARED LlmProviderRouter
// rather than a CheerpX-specific reimplementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { CheerpXHostBridge } from '../../providers/cheerpx/host-bridge.js';
import { LlmProviderRouter } from '../../shared/llm-provider-router.js';

const root = new URL('../../', import.meta.url);

// --- minimal DOM/browser surface the bridge touches -------------------------
globalThis.EventTarget ??= class { addEventListener() {} dispatchEvent() { return true; } };
globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

const b64 = value => Buffer.from(String(value), 'utf8').toString('base64');
const unb64 = value => Buffer.from(String(value), 'base64').toString('utf8');

function fakeRuntime() {
  let queue = '';
  const responses = new Map();
  return {
    runtime: {
      cx: {
        commands: [],
        async run(bin, args) {
          const script = args?.[1] ?? '';
          this.commands.push(script);
          // Honour the startup truncation so the fake behaves like the guest.
          if (/^:\s*>/.test(script)) queue = '';
          return { status: 0 };
        },
      },
      dataIn: { async writeFile(path, data) { responses.set(path, data); } },
      idbOut: {
        async readFileAsBlob(path) {
          if (path !== '/rpc.queue') throw new Error('ENOENT');
          return { text: async () => queue };
        },
      },
    },
    enqueue(id, operation, ...fields) { queue += [id, operation, ...fields].join('\t') + '\n'; },
    enqueueRaw(text) { queue += text; },
    responses,
    frames(id) {
      const body = responses.get(`/rpc-${id}.res`);
      if (!body) return null;
      return body.split('\n').filter(Boolean).map(line => {
        const [prefix, responseId, kind, ...rest] = line.split('\t');
        return { prefix, responseId, kind, value: rest.join('\t') };
      });
    },
    payload(id) {
      return (this.frames(id) ?? [])
        .filter(f => f.kind === 'DATA')
        .map(f => unb64(f.value))
        .join('');
    },
  };
}

function storage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

// --- framing ---------------------------------------------------------------

test('responses use the same __V86RPC_RESPONSE__ framing as the v86 bridge', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    llmClient: { status: async () => ({ modelName: 'test', cloud: false }) },
  });
  fake.enqueue('abc', 'LLM_STATUS');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));

  const frames = fake.frames('abc');
  assert.ok(frames, 'no response written');
  for (const frame of frames) {
    assert.equal(frame.prefix, '__V86RPC_RESPONSE__');
    assert.equal(frame.responseId, 'abc');
  }
  assert.equal(frames.at(-1).kind, 'END');

  // The guest tools grep for this exact prefix; drifting breaks every vm* tool.
  const v86Bridge = await readFile(new URL('providers/v86/host-bridge.js', root), 'utf8');
  assert.match(v86Bridge, /__V86RPC_RESPONSE__/);
});

test('only whole lines are consumed, so a partial guest append is not parsed', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, { llmClient: { status: async () => ({}) } });

  fake.enqueueRaw('half\tLLM_STAT');           // guest mid-append
  assert.equal(await bridge.poll(), 0, 'a partial line must not be dispatched');

  fake.enqueueRaw('US\n');                      // completes it
  assert.equal(await bridge.poll(), 1);
  await new Promise(r => setTimeout(r, 10));
  assert.ok(fake.frames('half'), 'completed line should have been handled');
});

test('an already-consumed queue prefix is never re-dispatched', async () => {
  const fake = fakeRuntime();
  let calls = 0;
  const bridge = new CheerpXHostBridge(fake.runtime, {
    llmClient: { status: async () => { calls += 1; return {}; } },
  });
  fake.enqueue('one', 'LLM_STATUS');
  await bridge.poll();
  await bridge.poll();
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(calls, 1, 'the same request was handled more than once');
});

test('start() discards queue history so a reload does not replay old requests', async () => {
  // The queue lives on the IDB out-mount and survives a page reload. Without
  // this, every request from every previous session is re-dispatched on load —
  // observed for real as a stale CLIPBOARD_WRITE clobbering the clipboard.
  const fake = fakeRuntime();
  let handled = 0;
  const bridge = new CheerpXHostBridge(fake.runtime, {
    llmClient: { status: async () => { handled += 1; return {}; } },
  });

  fake.enqueue('stale-1', 'LLM_STATUS');
  fake.enqueue('stale-2', 'LLM_STATUS');

  bridge.start();
  await bridge.ready;
  bridge.stop();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(handled, 0, 'requests predating start() must not be replayed');

  fake.enqueue('fresh', 'LLM_STATUS');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(handled, 1, 'requests made after start() must still be handled');
});

test('start() asks the guest to truncate the queue rather than growing forever', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {});
  bridge.start();
  await bridge.ready;
  bridge.stop();
  const truncated = fake.runtime.cx.commands?.some(command => /:\s*>\s*\/vmbro\/out\/rpc\.queue/.test(command));
  assert.ok(truncated, 'the guest should be asked to empty the queue at startup');
});

test('an unsupported operation returns ERROR rather than throwing into the loop', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {});
  fake.enqueue('bad', 'NOT_A_THING');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  const frames = fake.frames('bad');
  assert.equal(frames.at(-1).kind, 'ERROR');
  assert.match(unb64(frames.at(-1).value), /unsupported host operation/);
});

// --- the headline requirement: reuse the shared router ----------------------

test('LLM traffic is served by the shared LlmProviderRouter, cloud provider included', async () => {
  const persistent = storage();
  const secret = storage();
  const requests = [];
  const router = new LlmProviderRouter({
    getLocalClient: () => { throw new Error('local model not loaded'); },
    persistentStorage: persistent,
    secretStorage: secret,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'x', model: 'gpt-test',
          choices: [{ message: { role: 'assistant', content: 'hello from the router' } }],
        }),
      };
    },
  });
  router.saveProvider({
    id: 'acme', label: 'Acme', type: 'openai',
    baseUrl: 'https://api.example.com/v1', model: 'gpt-test',
  }, 'sk-test');

  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    llmResolver: (agent, route) => router.resolve(agent, route),
  });

  const body = b64(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }));
  const route = b64(JSON.stringify({ provider: 'acme' }));
  fake.enqueue('llm1', 'LLM_CHAT', body, route);
  await bridge.poll();
  await new Promise(r => setTimeout(r, 20));

  assert.equal(requests.length, 1, 'the router should have issued exactly one upstream call');
  assert.match(requests[0].url, /api\.example\.com\/v1\/chat\/completions/);
  assert.equal(requests[0].init.headers.authorization, 'Bearer sk-test');
  assert.equal(fake.payload('llm1'), 'hello from the router');
});

test('the bridge holds no provider state of its own', async () => {
  const source = await readFile(new URL('providers/cheerpx/host-bridge.js', root), 'utf8');
  // A second router, provider list, or secret store on the CheerpX side would
  // split configuration across pages — the thing this design exists to avoid.
  assert.doesNotMatch(source, /class\s+\w*LlmClient/, 'bridge must not define its own LLM client');
  assert.doesNotMatch(source, /vmvm\.llm\.(providers|secret)/, 'bridge must not touch provider storage');
  assert.doesNotMatch(source, /api\.anthropic\.com|generativelanguage|chat\/completions/,
    'provider endpoints belong in the shared router, not here');
});

test('a missing LLM configuration produces the same actionable error as v86', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {});
  fake.enqueue('llm2', 'LLM_STATUS');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  const message = unb64(fake.frames('llm2').at(-1).value);
  assert.match(message, /No LLM is configured/);

  const v86Bridge = await readFile(new URL('providers/v86/host-bridge.js', root), 'utf8');
  assert.ok(v86Bridge.includes('No LLM is configured'), 'wording drifted from the v86 bridge');
});

test('LLM_OPENAI emits an SSE stream shaped like the v86 bridge', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    llmClient: {
      chat: async () => ({ id: 'c1', model: 'm', choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] }),
    },
  });
  fake.enqueue('sse', 'LLM_OPENAI', b64('{}'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 20));
  const stream = fake.payload('sse');
  assert.match(stream, /^data: /);
  assert.match(stream, /"chat\.completion\.chunk"/);
  assert.match(stream, /data: \[DONE\]/);
});

// --- vmfetch guards --------------------------------------------------------

test('vmfetch keeps the HTTPS-only rule and the forbidden-header blocklist', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    fetchImpl: async () => ({
      status: 200, statusText: 'OK', url: 'https://example.com', headers: new Map(),
      arrayBuffer: async () => new TextEncoder().encode('body').buffer,
    }),
  });

  fake.enqueue('f1', 'FETCH', b64('GET'), b64('http://example.com'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  assert.match(unb64(fake.frames('f1').at(-1).value), /HTTPS/);

  fake.enqueue('f2', 'FETCH', b64('GET'), b64('https://example.com'), b64('cookie: a=b'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  assert.match(unb64(fake.frames('f2').at(-1).value), /forbidden header/);

  fake.enqueue('f3', 'FETCH', b64('GET'), b64('http://localhost:9/ok'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fake.frames('f3').at(-1).kind, 'END', 'localhost HTTP should be allowed');
});

test('vmfetch refuses a response above the browser-bridge limit', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    maxFetchBytes: 8,
    fetchImpl: async () => ({
      status: 200, statusText: 'OK', url: 'https://example.com', headers: new Map(),
      arrayBuffer: async () => new TextEncoder().encode('far too long').buffer,
    }),
  });
  fake.enqueue('big', 'FETCH', b64('GET'), b64('https://example.com'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  assert.match(unb64(fake.frames('big').at(-1).value), /exceeds 8 byte/);
});

// --- agent tiers -----------------------------------------------------------

test('an agent request is acknowledged immediately and dispatched fire-and-forget', async () => {
  const fake = fakeRuntime();
  const seen = [];
  const bridge = new CheerpXHostBridge(fake.runtime, {
    agentHandler: (...args) => { seen.push(args); return new Promise(() => {}); }, // never settles
  });

  fake.enqueue('a1', 'AGENT_RIG', b64('build the thing'), '', b64('{"provider":"local"}'));
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));

  // vmbro-rpc blocks on a response file; without an immediate END every
  // `rig TASK` would hang for the full RPC timeout even though the agent is
  // running fine.
  assert.equal(fake.frames('a1')?.at(-1).kind, 'END', 'agent requests must be acknowledged at once');
  assert.deepEqual(seen[0], ['rig', 'build the thing', '', '{"provider":"local"}']);
});

test('agent requests arriving before a handler is set are replayed once it is', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {});
  fake.enqueue('a2', 'AGENT_CODEACT', b64('task'), '', '');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));

  const seen = [];
  bridge.setAgentHandler((...args) => { seen.push(args); });
  assert.equal(seen.length, 1, 'the queued request should run when the handler appears');
  assert.equal(seen[0][0], 'codeact');
});

test('the same agent request is never dispatched twice', async () => {
  const fake = fakeRuntime();
  let calls = 0;
  const bridge = new CheerpXHostBridge(fake.runtime, { agentHandler: () => { calls += 1; } });
  fake.enqueue('a3', 'AGENT_RIG', b64('task'), '', '');
  await bridge.poll();
  await bridge.poll();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(calls, 1);
});

test('a throwing agent handler surfaces as an event, not an unhandled rejection', async () => {
  const fake = fakeRuntime();
  const bridge = new CheerpXHostBridge(fake.runtime, {
    agentHandler: async () => { throw new Error('agent blew up'); },
  });
  let captured = null;
  bridge.addEventListener?.('agent-error', event => { captured = event.detail; });
  fake.enqueue('a4', 'AGENT_RIG', b64('task'), '', '');
  await bridge.poll();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fake.frames('a4')?.at(-1).kind, 'END', 'the guest still gets its acknowledgement');
});

// --- the guest half --------------------------------------------------------

test('the guest helper speaks the same framing the vm* tools already parse', async () => {
  const rpc = await readFile(new URL('images/cheerpx/guest/vmbro-rpc', root), 'utf8');
  const vmclip = await readFile(new URL('network/guest/vmclip', root), 'utf8');

  assert.match(rpc, /rpc\.queue/, 'guest helper should append to the queue');
  assert.match(rpc, /rpc-\$id\.res/, 'guest helper should await a per-request response file');
  assert.match(rpc, /VMBRO_RPC_TIMEOUT/, 'a hung browser must not hang the guest forever');
  // vmclip parses tab-separated prefix/id/kind/value; the helper must emit that.
  assert.match(vmclip, /__V86RPC_RESPONSE__/);
  assert.match(rpc, /__V86RPC_RESPONSE__/);
});

test('the build installs the guest helper into the image', async () => {
  const build = await readFile(new URL('images/cheerpx/build-ext2.sh', root), 'utf8');
  assert.match(build, /usr\/local\/bin/, 'guest tools must be installed');
  assert.match(build, /vmbro-rpc/, 'the verify step should assert the helper is present');
});
