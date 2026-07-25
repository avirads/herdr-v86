# Browser shims for @mastra/core/workspace

`@mastra/core@1.52.1`'s published build statically imports 14 node builtins at
chunk top level. They are static ESM imports in *shared* chunks, so esbuild
cannot tree-shake them even when V86Filesystem/V86Sandbox replace the only code
(LocalFilesystem/LocalSandbox) that would call them.

With these aliases the workspace bundles (5.8 MB) and runs: a Workspace
constructs, generates 10 tools, and reads a guest file. Verified.

    --alias:path=path-browserify        --alias:path/posix=path-browserify
    --alias:fs=./shims/fs-stub.js       --alias:fs/promises=./shims/fs-stub.js
    --alias:os=./shims/os-stub.js       --alias:crypto=./shims/crypto-stub.js
    --alias:events=./shims/events.js    --alias:stream/web=./shims/stream-web.js
    --alias:url=./shims/url.js          --alias:stream=./shims/stream.js
    --alias:child_process=./shims/child_process.js
    --alias:async_hooks=./shims/async_hooks.js
    --alias:string_decoder=./shims/string_decoder.js
    --alias:module=./shims/module.js

## Verified: the FULL agent loop runs in-browser

`@mastra/core/agent` needs no additional builtin shims beyond the 14 below.
Bundle is 9.5 MB. Executed with process/Buffer/setImmediate/__dirname/require
all removed: 4 model turns, 4 guest commands, execute_command ran, write_file
landed. See probe/fullloop.js and test/browser-fullloop.test.mjs.

## Three browser globals must be INJECTED, not imported

    --inject:./shims/globals.js

- `process` — Mastra reads process.env at MODULE INIT (readPositiveIntEnv),
  so an import is too late; the bundle throws before any agent code runs.
- `Buffer` — 36 references in the bundle.
- `setImmediate` — THE DANGEROUS ONE. Mastra's tool-execution path calls it.
  Browsers do not have it. Mastra CATCHES the TypeError and returns it to the
  model as a tool RESULT, so nothing crashes: every tool "succeeds" with an
  error string and the agent invents a plausible final answer over four dead
  tool calls. Asserting on the agent's output text passes. Assert on guest
  side effects instead — that is what browser-fullloop.test.mjs does, and it
  has a negative control proving it fails when this polyfill is removed.

## Read this before relying on it

These are mostly THROWING STUBS, not implementations. fs, child_process,
crypto.createHash and the node stream classes all throw if called. The happy
path never reaches them — but any Mastra feature that does will fail at
RUNTIME with no build-time warning.

async_hooks is the dangerous one. AsyncLocalStorage here is synchronous-only;
it does not propagate across `await`. Mastra's requestContext (dynamic
filesystem/sandbox resolvers) may ride on it. Sequential use is fine;
concurrent agent runs could leak context between them — silently.

Only `@mastra/core/workspace` was verified. `@mastra/core/agent` pulls a larger
chunk graph and is untested.

Pin the Mastra version. Any release can add a builtin import to a shared chunk
(breaks the build, loud) or add a call to an already-stubbed one (breaks at
runtime, quiet).
