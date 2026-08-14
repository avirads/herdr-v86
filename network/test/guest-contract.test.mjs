// The VM-provider guest contract, asserted against every provider.
//
// `agent/` (Deep Agents, Mastra's V86Filesystem/V86Sandbox, VmAgentController,
// rig) consumes ONLY these nine methods and parses their output by shape. That
// makes the contract the load-bearing interface of the whole multi-provider
// design, and it is invisible to type checking: both sides are plain strings.
//
// So this suite does two things:
//   1. checks each provider exposes the interface, and that the CheerpX client's
//      plumbing (ids, device-relative reads, error propagation) works;
//   2. cross-checks the CheerpX client against the REAL v86 guest script,
//      network/guest/vmagent-rpc, so a limit or flag changing on either side
//      fails here instead of becoming subtly wrong agent behaviour.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  CheerpXGuestClient,
  MAX_BYTES,
  EXECUTE_TIMEOUT_SECONDS,
  shellQuote,
} from '../../providers/cheerpx/guest-client.js';
import { GUEST_IN, GUEST_OUT } from '../../providers/cheerpx/runtime.js';

const root = new URL('../../', import.meta.url);
const rpcSource = await readFile(new URL('network/guest/vmagent-rpc', root), 'utf8');
const v86Source = await readFile(new URL('providers/v86/guest-client.js', root), 'utf8');

const CONTRACT_METHODS = [
  'list', 'read', 'write', 'delete', 'glob', 'grep', 'execute', 'test', 'setWorkspace',
];

// --- a CheerpX runtime that records scripts and replays canned results -------

function fakeRuntime() {
  const scripts = [];
  const outputs = new Map();   // device-relative name -> content
  const written = new Map();   // DataDevice writes
  let next = { status: 0, stdout: '', stderr: '' };

  const cx = {
    async run(bin, args, opts) {
      const script = args[1] ?? '';
      scripts.push({ bin, args, opts, script });
      if (/^rm -f /.test(script)) return { status: 0 };   // cleanup calls
      const id = script.match(/>([^\s]+)\/([^\s]+)\.out/)?.[2];
      if (id) {
        outputs.set(`${id}.out`, next.stdout);
        outputs.set(`${id}.err`, next.stderr);
      }
      return { status: next.status };
    },
  };
  const idbOut = {
    async readFileAsBlob(path) {
      const name = path.replace(/^\//, '');
      if (!outputs.has(name)) throw new Error('ENOENT');
      return { text: async () => outputs.get(name) };
    },
  };
  const dataIn = { async writeFile(path, data) { written.set(path, data); } };

  return {
    runtime: { cx, dataIn, idbOut },
    scripts,
    written,
    reply(value) { next = { status: 0, stdout: '', stderr: '', ...value }; },
    lastScript: () => scripts.filter(s => !/^rm -f /.test(s.script)).at(-1)?.script ?? '',
  };
}

const clientWithFake = (options) => {
  const fake = fakeRuntime();
  return { client: new CheerpXGuestClient(fake.runtime, options), fake };
};

// --- 1. interface conformance ----------------------------------------------

test('every provider exposes the nine-method contract', () => {
  const { client } = clientWithFake();
  for (const method of CONTRACT_METHODS) {
    assert.equal(typeof client[method], 'function', `CheerpX client is missing ${method}()`);
  }
  // The v86 client is a browser module (it touches emulator listeners on
  // construction), so assert its surface from source rather than instantiating.
  for (const method of CONTRACT_METHODS) {
    assert.match(
      v86Source,
      new RegExp(`\\b${method}\\s*\\(`),
      `v86 client is missing ${method}()`,
    );
  }
});

test('optional path arguments default to the workspace root on both providers', () => {
  for (const method of ['list', 'grep', 'glob']) {
    assert.match(v86Source, new RegExp(`${method}\\([^)]*'\\.'`), `v86 ${method} should default to '.'`);
  }
  const { client } = clientWithFake();
  assert.equal(client.list.length, 0, 'list(path = ".") should have no required argument');
  assert.equal(client.grep.length, 1, 'grep(pattern, path = ".")');
  assert.equal(client.glob.length, 1, 'glob(pattern, path = ".")');
});

// --- 2. cross-check against the real v86 guest script -----------------------

test('result cap matches the v86 guest script', () => {
  const upstream = Number(rpcSource.match(/MAX_BYTES=(\d+)/)?.[1]);
  assert.equal(upstream, MAX_BYTES, 'CheerpX MAX_BYTES has drifted from vmagent-rpc');
});

test('execute timeout matches the v86 guest script', () => {
  const upstream = Number(rpcSource.match(/timeout\s+(\d+)\s+sh -c/)?.[1]);
  assert.equal(upstream, EXECUTE_TIMEOUT_SECONDS, 'execute timeout has drifted from vmagent-rpc');
});

test('the default workspace matches the v86 guest script', () => {
  const upstream = rpcSource.match(/WORKSPACE=\$\{VMAGENT_WORKSPACE:-([^}]+)\}/)?.[1];
  const { client } = clientWithFake();
  assert.equal(client.workspace, upstream, 'default workspace has drifted from vmagent-rpc');
});

test('list uses the same traversal depth and cap as the v86 guest script', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '' });
  await client.list('.');
  const script = fake.lastScript();

  const depth = rpcSource.match(/find "\$target" -mindepth 1 -maxdepth (\d+)/)?.[1];
  const cap = rpcSource.match(/-maxdepth \d+ 2>&1 \| head -n (\d+)/)?.[1];
  assert.ok(depth && cap, 'could not read list limits out of vmagent-rpc');
  assert.match(script, new RegExp(`-mindepth 1 -maxdepth ${depth}`), `list depth should be ${depth}`);
  assert.match(script, new RegExp(`head -n ${cap}`), `list cap should be ${cap}`);
  // %F is what makes parseFileEntries see "directory" rather than "d".
  assert.match(script, /stat -c '%F\\t%n\\t%s'/);
});

test('grep uses the same flags and cap as the v86 guest script', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '' });
  await client.grep('needle', '.');
  const script = fake.lastScript();
  assert.match(script, /grep -R -n -F --/, 'grep must stay recursive, numbered and fixed-string');
  const cap = rpcSource.match(/head -n (\d+) > "\$tmp" \|\| true/)?.[1] ?? '300';
  assert.match(script, new RegExp(`head -n ${cap}`));
});

test('glob uses the same traversal depth and cap as the v86 guest script', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '' });
  await client.glob('**/*.js', '.');
  const script = fake.lastScript();
  const depth = rpcSource.match(/-mindepth 1 -maxdepth (\d+) -path/)?.[1];
  assert.ok(depth, 'could not read glob depth out of vmagent-rpc');
  assert.match(script, new RegExp(`-mindepth 1 -maxdepth ${depth} -path`));
  assert.match(script, /head -n 1000/);
});

test('execute frames its result exactly like the v86 guest script', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '__V86AGENT_EXIT__0\nhello\n' });
  const result = await client.execute('echo hello');

  assert.match(rpcSource, /__V86AGENT_EXIT__%s/, 'upstream framing changed');
  assert.match(result, /^__V86AGENT_EXIT__\d+\n/, 'execute must return the exit marker first');
  // 2>&1 is load-bearing: V86Sandbox separates streams by wrapping the command
  // with its own marker, which only survives if both streams come back together.
  assert.match(fake.lastScript(), /2>&1/, 'execute must combine stderr into stdout');
  assert.match(fake.lastScript(), new RegExp(`timeout ${EXECUTE_TIMEOUT_SECONDS} sh -c`));
});

// --- 3. CheerpX-specific plumbing ------------------------------------------

test('output is read back with a device-relative path, not the mount path', async () => {
  const reads = [];
  const { client, fake } = clientWithFake();
  const original = fake.runtime.idbOut.readFileAsBlob;
  fake.runtime.idbOut.readFileAsBlob = async path => { reads.push(path); return original.call(fake.runtime.idbOut, path); };
  fake.reply({ stdout: 'ok' });
  await client.read('README.md');

  assert.ok(reads.length > 0, 'nothing was read back');
  for (const path of reads) {
    assert.doesNotMatch(path, /^\/vmbro\//, `readFileAsBlob got the guest mount path: ${path}`);
    assert.match(path, /^\/[\w.-]+$/, `expected a device-relative path, got ${path}`);
  }
});

test('stderr is only read back when the operation actually failed', async () => {
  const reads = [];
  const { client, fake } = clientWithFake();
  const original = fake.runtime.idbOut.readFileAsBlob;
  fake.runtime.idbOut.readFileAsBlob = async path => { reads.push(path); return original.call(fake.runtime.idbOut, path); };

  fake.reply({ status: 0, stdout: 'fine' });
  await client.read('README.md');
  assert.equal(reads.filter(p => p.endsWith('.err')).length, 0, 'happy path must not pay for a stderr read');

  reads.length = 0;
  fake.reply({ status: 1, stderr: 'read target is not a regular file' });
  await assert.rejects(() => client.read('nope'), /not a regular file/);
  assert.equal(reads.filter(p => p.endsWith('.err')).length, 1, 'failures must surface stderr');
});

test('a failing operation throws with the guest message, but execute does not', async () => {
  const { client, fake } = clientWithFake();

  fake.reply({ status: 1, stderr: 'path escapes workspace' });
  await assert.rejects(() => client.list('../..'), /path escapes workspace/);

  // A command exiting non-zero is data, not an error: the code rides in the marker.
  fake.reply({ status: 0, stdout: '__V86AGENT_EXIT__42\n' });
  assert.match(await client.execute('exit 42'), /__V86AGENT_EXIT__42/);
});

test('concurrent calls get distinct ids so results cannot cross-wire', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '' });
  await Promise.all([client.list('.'), client.list('.'), client.list('.')]);
  const ids = fake.scripts
    .filter(s => !/^rm -f /.test(s.script))   // cleanup reuses its call's id
    .map(s => s.script.match(/\/([\w.-]+)\.out/)?.[1])
    .filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'ids collided — run() is parallel, so Date.now() alone is not enough');
});

test('write ships content through the DataDevice and enforces the cap', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: 'written notes.md\n' });
  const result = await client.write('notes.md', 'hello');

  assert.equal(fake.written.size, 1, 'content should travel via DataDevice.writeFile');
  assert.equal([...fake.written.values()][0], 'hello');
  assert.match(fake.lastScript(), new RegExp(`cat ${GUEST_IN}/`), 'guest should copy from the in-mount');
  assert.match(result, /^written /);

  await assert.rejects(
    () => client.write('big.bin', 'x'.repeat(MAX_BYTES + 1)),
    new RegExp(`exceeds ${MAX_BYTES}`),
  );
});

test('all guest output lands under the out-mount', async () => {
  const { client, fake } = clientWithFake();
  fake.reply({ stdout: '' });
  await client.list('.');
  assert.match(fake.lastScript(), new RegExp(`>${GUEST_OUT}/`), 'stdout must be redirected into the out-mount');
});

test('shellQuote neutralises embedded quotes', () => {
  assert.equal(shellQuote(`it's`), `'it'"'"'s'`);
  // A path crafted to break out of the quoting must stay one argument.
  assert.equal(shellQuote(`a'; rm -rf /; echo '`), `'a'"'"'; rm -rf /; echo '"'"''`);
});

test('empty pattern and empty command are refused before reaching the guest', async () => {
  const { client } = clientWithFake();
  await assert.rejects(() => client.grep(''), /pattern is empty/);
  await assert.rejects(() => client.glob(''), /pattern is empty/);
  await assert.rejects(() => client.execute('   '), /command is empty/);
});

test('setWorkspace redirects subsequent operations', async () => {
  const { client, fake } = clientWithFake();
  client.setWorkspace('/srv/app');
  fake.reply({ stdout: '' });
  await client.list('.');
  assert.match(fake.lastScript(), /'\/srv\/app'/);
});

test('test() accepts only the upstream recipe set', async () => {
  const { client, fake } = clientWithFake();
  for (const recipe of ['make-test', 'make-check', 'shell-tests']) {
    assert.match(rpcSource, new RegExp(recipe), `${recipe} should exist upstream`);
    fake.reply({ stdout: 'ok' });
    await client.test(recipe);
  }
  await assert.rejects(() => client.test('rm -rf /'), /unsupported test recipe/);
});
