// Guards the in-browser path. Builds the real browser bundle, then executes it
// in a subprocess with every node-only global removed.
//
// The failure this exists to catch: Mastra catches tool-execution errors and
// returns them to the model as tool RESULTS. A missing browser polyfill
// therefore does not crash — every tool "succeeds" with an error string and the
// agent invents a plausible final answer over dead tool calls. Asserting on the
// agent's text alone would pass. Assert on guest side effects instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// tmpdir() rather than a hardcoded /tmp: on Windows the latter resolves to a
// different place for the shell (which writes the bundle) than for node (which
// imports it), so the two halves of this test silently disagree.
const BUNDLE = join(tmpdir(), 'fullloop-regression.mjs');

test('browser bundle builds with the shim layer', () => {
  // Invoked through `sh` explicitly — node cannot exec a .sh directly on
  // Windows (EFTYPE), and this is equivalent everywhere else.
  execFileSync('sh', ['./build-browser.sh', 'probe/fullloop.js', BUNDLE], { stdio: 'pipe' });
  assert.ok(existsSync(BUNDLE));
});

test('full agent loop runs with no node globals present', () => {
  const script = `
    for (const k of ['process','Buffer','setImmediate','clearImmediate','__dirname','__filename','require','global'])
      globalThis[k] = undefined;
    await import(${JSON.stringify(pathToFileURL(BUNDLE).href)});
    console.log(JSON.stringify(await globalThis.__runFullLoop()));
  `;
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = JSON.parse(raw.trim().split('\n').pop());

  // The model completed its scripted turns...
  assert.equal(result.modelTurns, 4, 'model did not take all four turns');

  // ...and, critically, the tools actually reached the guest. Without this the
  // suite passes while every tool call silently fails.
  assert.equal(result.guestCommands, 4, 'tools never reached the guest bridge');
  assert.equal(result.sawUname, true, 'execute_command never ran in the guest');
  assert.equal(result.notesWritten, 'arch is i686\n', 'write_file never landed in the guest');

  // No tool result may carry a runtime error back to the model.
  assert.doesNotMatch(
    result.turn2Observation ?? '',
    /is not a function|is not defined|Cannot read propert/,
    `a tool returned a runtime error: ${result.turn2Observation}`,
  );
});
