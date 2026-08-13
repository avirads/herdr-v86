import test from 'node:test';
import assert from 'node:assert/strict';
import { V86GuestAgentClient } from '../../network/browser/v86-guest-readonly.js';

// A guest RPC is a line typed at a tty and a line read back from it. Everything
// here is about what happens when that line does not arrive intact — the case
// that used to be indistinguishable from the guest simply being slow.

const RESPONSE = '__V86AGENT_RESPONSE__\t';

function harness({ timeoutMs = 2000 } = {}) {
  const listeners = {};
  const emulator = {
    add_listener: (name, fn) => { listeners[name] = fn; },
    remove_listener: () => {},
  };
  const sent = [];
  const bridge = { send: async (line, serial) => { sent.push({ serial, line }); } };
  const guest = new V86GuestAgentClient(emulator, bridge, { rpcSerial: 1, timeoutMs });
  const feed = line => {
    for (const character of `${line}\n`) listeners['serial1-output-byte'](character.charCodeAt(0));
  };
  return { guest, sent, feed, pendingId: () => [...guest.pending.keys()][0] };
}

const b64 = value => Buffer.from(value).toString('base64');

test('busy covers the whole window a caller must not write into', async () => {
  const { guest, feed, pendingId } = harness();
  assert.equal(guest.busy, false);

  const write = guest.write('/root/project/greet.js', 'hello');
  // Synchronous with the call, not with the queue reaching it — a poller
  // checking on a 500 ms timer would otherwise slip into the gap.
  assert.equal(guest.busy, true, 'busy must be set the moment the call is queued');

  await new Promise(resolve => setTimeout(resolve, 5));
  feed(`${RESPONSE}${pendingId()}\tOK\t${b64('written')}`);
  assert.equal(await write, 'written');
  assert.equal(guest.busy, false, 'busy must clear once the reply lands');
});

test('busy stays set across a queued second call', async () => {
  const { guest, feed, pendingId } = harness();
  const first = guest.read('/a');
  const second = guest.read('/b');
  assert.equal(guest.busy, true);

  await new Promise(resolve => setTimeout(resolve, 5));
  feed(`${RESPONSE}${pendingId()}\tOK\t${b64('a')}`);
  await first;
  assert.equal(guest.busy, true, 'the queued call still owns the line');

  await new Promise(resolve => setTimeout(resolve, 5));
  feed(`${RESPONSE}${pendingId()}\tOK\t${b64('b')}`);
  await second;
  assert.equal(guest.busy, false);
});

test('busy clears even when the call fails', async () => {
  const { guest, feed, pendingId } = harness();
  const read = guest.read('/missing');
  await new Promise(resolve => setTimeout(resolve, 5));
  feed(`${RESPONSE}${pendingId()}\tERROR\t${b64('no such file')}`);
  await assert.rejects(read, /no such file/);
  assert.equal(guest.busy, false);
});

test('a response nobody is waiting for is reported, not swallowed', () => {
  const { guest, feed } = harness();
  const orphans = [];
  guest.addEventListener('orphan-response', event => orphans.push(event.detail.line));

  // What a split line looks like: the id no longer matches, so the real reply
  // is gone. Silently returning turned this into a 30 s timeout blamed on the
  // guest being slow.
  feed(`${RESPONSE}agent-does-not-exist\tOK\t${b64('written')}`);
  assert.equal(orphans.length, 1);
  assert.match(orphans[0], /agent-does-not-exist/);
});

test('an undecodable payload rejects rather than hanging forever', async () => {
  const { guest, feed, pendingId } = harness();
  const read = guest.read('/a');
  await new Promise(resolve => setTimeout(resolve, 5));
  // The timer is cleared before the payload is decoded, so an exception here
  // used to leave the promise unsettled — worse than a timeout, since nothing
  // ever fires.
  feed(`${RESPONSE}${pendingId()}\tOK\t!!!not-base64!!!`);
  await assert.rejects(read, /not decodable/);
});

test('the RPC is typed at the serial line it was configured for', async () => {
  const { guest, sent, feed, pendingId } = harness();
  const write = guest.write('greet.js', 'hello');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(sent[0].serial, 1, 'must not land on the console the orchestrator owns');
  assert.match(sent[0].line, /vmagent-rpc /);
  feed(`${RESPONSE}${pendingId()}\tOK\t${b64('ok')}`);
  await write;
});
