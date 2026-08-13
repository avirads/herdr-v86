import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

// vmagent-rpc is the entire filesystem surface every browser-side agent tier
// has. It runs as a shell script on the guest's ttyS1, so the only honest way
// to test it is to run it.
//
// The bug that motivated this: `fail` printed its __V86AGENT_RESPONSE__ line on
// stdout, but every caller of resolve_existing/resolve_new invokes them inside
// a command substitution — which owns stdout. So a rejected path wrote its
// error into the caller's variable, `set -e` killed the script, and the browser
// received nothing at all. Not a wrong answer: silence, surfacing 30 s later as
// a timeout blamed on the guest.

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'guest', 'vmagent-rpc');

function hasPosixShell() {
  try {
    execFileSync('sh', ['-c', 'exit 0'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const shell = hasPosixShell();
const b64 = value => Buffer.from(value).toString('base64');

/** Run one RPC and return everything the tty would have seen. */
function rpc(workspace, id, operation, ...args) {
  try {
    const stdout = execFileSync('sh', [script, id, operation, ...args], {
      env: { ...process.env, VMAGENT_WORKSPACE: workspace },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { output: stdout, code: 0 };
  } catch (error) {
    // Both streams land on the same tty in the guest, so the caller sees both.
    return { output: `${error.stdout ?? ''}${error.stderr ?? ''}`, code: error.status };
  }
}

const parse = output => {
  const line = output.split('\n').find(l => l.includes('__V86AGENT_RESPONSE__'));
  if (!line) return null;
  const [id, status, payload] = line.slice(line.indexOf('__V86AGENT_RESPONSE__\t') + 22).split('\t');
  return { id, status, value: Buffer.from(payload ?? '', 'base64').toString('utf8') };
};

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'vmagent-rpc-'));
  mkdirSync(path.join(root, 'ws', 'sub'), { recursive: true });
  return { root, ws: path.join(root, 'ws') };
}

test('a rejected path still answers, on the tty', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  try {
    // The case that used to produce no output whatsoever.
    const response = parse(rpc(ws, 'r1', 'write', b64('/etc/passwd'), b64('x')).output);
    assert.ok(response, 'a rejected path must produce a response line, not silence');
    assert.equal(response.id, 'r1');
    assert.equal(response.status, 'ERROR');
    assert.match(response.value, /workspace/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an absolute path inside the workspace is accepted', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  try {
    // Agents are told they work in the workspace, so this is the path shape
    // that instruction actually produces. gemma-4-E2B sent exactly this.
    const response = parse(rpc(ws, 'r2', 'write', b64(path.posix.join(ws.split(path.sep).join('/'), 'greet.js')), b64('hello')).output);
    assert.equal(response?.status, 'OK', `expected OK, got ${JSON.stringify(response)}`);
    assert.equal(readFileSync(path.join(ws, 'greet.js'), 'utf8'), 'hello');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a relative path still works unchanged', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  try {
    const response = parse(rpc(ws, 'r3', 'write', b64('sub/other.js'), b64('body')).output);
    assert.equal(response?.status, 'OK');
    assert.equal(readFileSync(path.join(ws, 'sub', 'other.js'), 'utf8'), 'body');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the workspace is still a boundary, not a suggestion', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  const outside = path.join(root, 'escaped.js');
  try {
    for (const [id, target] of [
      ['e1', '../escaped.js'],
      ['e2', 'sub/../../escaped.js'],
      ['e3', `${ws.split(path.sep).join('/')}/../escaped.js`],
      // A sibling directory sharing the workspace's name as a prefix must not
      // be mistaken for a path inside it.
      ['e4', `${ws.split(path.sep).join('/')}ile/escaped.js`],
    ]) {
      const response = parse(rpc(ws, id, 'write', b64(target), b64('pwned')).output);
      assert.equal(response?.status, 'ERROR', `${target} must be refused`);
    }
    assert.equal(existsSync(outside), false, 'nothing may be written outside the workspace');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a read of a missing file reports rather than hangs', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  try {
    const response = parse(rpc(ws, 'r4', 'read', b64('nope.js')).output);
    assert.equal(response?.status, 'ERROR');
    // Which guard catches it depends on whether `readlink -f` resolves a
    // nonexistent path (BusyBox and GNU differ). Either rejection is correct;
    // what matters is that one of them answers instead of going quiet.
    assert.match(response.value, /not found|not a regular file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a successful write round-trips through read', { skip: !shell && 'no POSIX sh available' }, () => {
  const { root, ws } = workspace();
  try {
    writeFileSync(path.join(ws, 'seed.txt'), 'seeded\n');
    const response = parse(rpc(ws, 'r5', 'read', b64('seed.txt')).output);
    assert.equal(response?.status, 'OK');
    assert.equal(response.value, 'seeded\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
