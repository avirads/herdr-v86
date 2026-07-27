import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('the BusyBox shell starts with editing and command history enabled', () => {
  assert.match(html, /export HISTFILE=\/root\/\.ash_history HISTSIZE=200/);
  assert.match(html, /set -o emacs 2>\/dev\/null \|\| true/);
});

test('plain arrow keys use the shared terminal input path for every guest program', () => {
  assert.match(html, /const cursorKeys = \{ ArrowUp: "A", ArrowDown: "B", ArrowRight: "C", ArrowLeft: "D" \}/);
  assert.match(html, /term\.modes\.applicationCursorKeysMode \? "\\x1bO" : "\\x1b\["/);
  assert.match(html, /handleTerminalData\(prefix \+ suffix\)/);
  assert.match(html, /for \(const ch of data\) emulator\.serial0_send\(ch\)/);
});

test('vmlang also provides cursor movement and command history', () => {
  assert.match(html, /data === "\\x1b\[A" \|\| data === "\\x1bOA"/);
  assert.match(html, /recallAgentHistory\(-1\)/);
  assert.match(html, /data === "\\x1b\[B" \|\| data === "\\x1bOB"/);
  assert.match(html, /recallAgentHistory\(1\)/);
  assert.match(html, /agentInputHistory\.push\(agentInput\)/);
  assert.match(html, /agentInputCursor--/);
  assert.match(html, /agentInputCursor\+\+/);
});

test('unsupported escape sequences are ignored rather than printed', () => {
  assert.match(html, /if \(data\.startsWith\("\\x1b"\)\) return;/);
  assert.doesNotMatch(html, /agentInput \+= ch/);
});
