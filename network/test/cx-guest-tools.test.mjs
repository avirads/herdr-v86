// The CheerpX guest tools are forked copies of the v86 ones, so the real risk is
// silent drift: upstream changes a limit or a flag, the CheerpX copy keeps the
// old one, and the two providers quietly disagree while docs/guest-tools.md
// claims they don't.
//
// These tests pin the parts that must stay identical (usage text, limits, option
// letters, exit codes) and the parts that must differ (the transport), so a
// future edit to either side has to be deliberate.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const upstream = name => readFile(new URL(`network/guest/${name}`, root), 'utf8');
const ported = name => readFile(new URL(`images/cheerpx/guest/${name}`, root), 'utf8');

/**
 * Drop whole-line shell comments before asserting on behaviour.
 *
 * These files explain their own port in comments — "the stty dance is gone",
 * "v86 sends EXPORT9P" — so matching raw source finds the very strings the
 * assertions are meant to prove absent from the CODE.
 */
const code = async (name, read = ported) =>
  (await read(name)).split('\n').filter(line => !/^\s*#/.test(line)).join('\n');

const PORTED = ['vmfetch', 'vmclip', 'vmllm', 'vmexport'];
/** The three agent tiers. Upstream these are rig-vm, vmlang and mastra-vm. */
const AGENT_TOOLS = [
  { ported: 'rig', upstream: 'rig-vm' },
  { ported: 'vmlang', upstream: 'vmlang' },
  { ported: 'vmmastra', upstream: 'mastra-vm' },
];
const VERBATIM = ['vmai', 'vmgithub'];
/** The transport itself, not a ported tool: its usage text names a literal OP. */
const TRANSPORT = 'vmbro-rpc';

test('every ported tool drops the v86 serial transport', async () => {
  for (const name of PORTED) {
    const source = await ported(name);
    assert.doesNotMatch(source, /> ?\/dev\/tty/, `${name} still writes to /dev/tty`);
    assert.doesNotMatch(source, /__V86RPC__\\t/, `${name} still emits the raw serial request`);
    assert.match(source, /vmbro-rpc/, `${name} should go through vmbro-rpc`);
  }
});

test('ported tools no longer suppress terminal echo', async () => {
  // stty -echo exists upstream only because the request goes to the tty while
  // the reply arrives on stdin. Neither is true here, and leaving it in would
  // disable echo in the user's shell if the tool exits early.
  for (const name of PORTED) {
    assert.doesNotMatch(await code(name), /stty (-echo|echo)/, `${name} still toggles stty`);
  }
});

test('ported tools still parse the shared response framing', async () => {
  for (const name of ['vmfetch', 'vmclip', 'vmllm', 'vmexport']) {
    const source = await ported(name);
    assert.match(source, /__V86RPC_RESPONSE__/, `${name} must still match the response prefix`);
  }
});

test('pure vmfetch wrappers are byte-identical to upstream', async () => {
  // These never touched the transport, so any difference is accidental.
  for (const name of VERBATIM) {
    assert.equal(await ported(name), await upstream(name), `${name} has drifted from upstream`);
  }
});

test('usage text is identical, so one document describes both providers', async () => {
  const usageLines = source => source
    .split('\n')
    .filter(line => /usage:/.test(line))
    .map(line => line.trim());

  for (const name of ['vmfetch', 'vmclip', 'vmexport']) {
    assert.deepEqual(usageLines(await ported(name)), usageLines(await upstream(name)),
      `${name} usage text has drifted`);
  }
});

test('documented limits match upstream exactly', async () => {
  const fetchUpstream = await upstream('vmfetch');
  const fetchPorted = await ported('vmfetch');
  assert.match(fetchUpstream, /16 MiB response limit/);
  assert.match(fetchPorted, /16 MiB response limit/);

  const exportUpstream = await upstream('vmexport');
  const exportPorted = await ported('vmexport');
  const limit = exportUpstream.match(/-le (\d+)/)?.[1];
  assert.equal(limit, '8388608');
  assert.match(exportPorted, new RegExp(`-le ${limit}`), 'vmexport size limit has drifted');
  assert.match(exportPorted, /limited to 8 MiB/);
});

test('vmfetch keeps the same options and exit codes', async () => {
  const source = await ported('vmfetch');
  assert.match(source, /getopts 'o:X:H:d:h'/, 'option letters changed');
  assert.match(source, /exit 22/, 'the HTTP-failure exit code changed');
  assert.match(source, /-d DATA/);
});

test('vmllm keeps the same operations and environment variables', async () => {
  const source = await ported('vmllm');
  for (const token of ['LLM_CHAT', 'LLM_STATUS', 'LLM_MODELS',
                       'VMLLM_SYSTEM', 'VMLLM_MODEL', 'VMLLM_MAX_TOKENS']) {
    assert.match(source, new RegExp(token), `vmllm lost ${token}`);
  }
});

test('vmexport stages through the mount rather than inlining bytes', async () => {
  const source = await code('vmexport');
  // 8 MiB of base64 is ~11 MB, far past ARG_MAX; the bytes must not ride on the
  // request line the way small arguments do.
  assert.match(source, /EXPORT_MOUNT/, 'vmexport should use the mount-staged export op');
  assert.doesNotMatch(source, /EXPORT9P/, 'the 9p channel does not exist under CheerpX');
  assert.doesNotMatch(source, /mnt\/host-transfer/, 'the v86 9p share does not exist here');
  assert.match(source, /VMBRO_OUT/, 'it should stage on the out-mount');
});

test('agent tools drop the serial write and the jq dependency', async () => {
  for (const { ported: name } of AGENT_TOOLS) {
    const source = await code(name);
    assert.doesNotMatch(source, /\/dev\/tty/, `${name} still writes to a tty device`);
    assert.doesNotMatch(source, /__V86RPC__\\t/, `${name} still emits the raw serial request`);
    // Debian slim has no jq; the Alpine guest image installs it.
    assert.doesNotMatch(source, /\bjq\b/, `${name} still shells out to jq`);
    assert.match(source, /vmbro-rpc "AGENT_/, `${name} should post through vmbro-rpc`);
  }
});

test('agent tools keep their upstream subcommands', async () => {
  const operations = source => [...source.matchAll(/operation=([A-Z][A-Z_]*)/g)].map(m => m[1]).sort();
  for (const { ported, upstream: name } of AGENT_TOOLS) {
    assert.deepEqual(
      operations(await code(ported)),
      operations(await code(name, upstream)),
      `${ported} has drifted from ${name} on its operation set`,
    );
  }
});

/**
 * Differences that are deliberate. Anything not listed here is drift.
 *
 * rig-vm is the odd one out upstream: vmlang and mastra-vm both handle
 * -h|--help, it does not. The port adds it for consistency across the tier.
 */
const INTENTIONAL_OPTION_ADDITIONS = { rig: ['--help'] };

test('agent tools accept the same options as upstream', async () => {
  // Prose differs legitimately (the CheerpX tools point at Settings rather than
  // the v86 "Configure LLM" header), and rig-vm's synopsis lives inside a shell
  // echo, so compare the parsed options instead — that is the actual interface.
  // jq's own flags are stripped: --arg belongs to the JSON builder the port
  // replaced, not to the tool's command line.
  const options = source => [...source.split('\n').filter(line => !/\bjq\b/.test(line)).join('\n')
    .matchAll(/--[a-z][a-z-]*/g)]
    .map(match => match[0])
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();

  for (const { ported, upstream: name } of AGENT_TOOLS) {
    const expected = [
      ...options(await code(name, upstream)),
      ...(INTENTIONAL_OPTION_ADDITIONS[ported] ?? []),
    ].sort();
    assert.deepEqual(
      options(await code(ported)),
      expected,
      `${ported} has drifted from ${name} on its accepted options`,
    );
  }
});

test('the host bridge implements every operation the guest tools invoke', async () => {
  const bridge = await readFile(new URL('providers/cheerpx/host-bridge.js', root), 'utf8');
  const names = await readdir(new URL('images/cheerpx/guest/', root));

  const invoked = new Set();
  for (const name of names) {
    if (name === TRANSPORT) continue; // its usage line reads "vmbro-rpc OP ..."
    const source = await code(name);
    for (const match of source.matchAll(/vmbro-rpc ["']?([A-Z][A-Z0-9_]+)/g)) invoked.add(match[1]);
    // vmllm selects its op through a variable, so pick those up too.
    for (const match of source.matchAll(/rpc=([A-Z][A-Z0-9_]+)/g)) invoked.add(match[1]);
  }
  assert.ok(invoked.size >= 5, `expected several operations, found ${[...invoked].join(', ')}`);

  for (const operation of invoked) {
    if (operation.startsWith('AGENT_')) {
      // Agent operations are dispatched by prefix rather than by name, because
      // the suffix is the tier (RIG, CODEACT, MASTRA, …) and tools build it at
      // runtime — `vmbro-rpc "AGENT_$op"`.
      assert.match(bridge, /startsWith\('AGENT_'\)/,
        'the host bridge no longer dispatches AGENT_* operations by prefix');
      continue;
    }
    assert.match(bridge, new RegExp(`case '${operation}'`),
      `the host bridge has no handler for ${operation}, which a guest tool invokes`);
  }
});

test('the build installs every guest tool', async () => {
  const build = await readFile(new URL('images/cheerpx/build-ext2.sh', root), 'utf8');
  assert.match(build, /guest\/\*/, 'the build should install the whole guest directory');
});
