# Mastra Code tier (`vmmastra code`)

The Mastra Code tier adds persistent conversational threads, slash commands, and
mode switching on top of the standard Mastra agent workspace.  It runs
entirely in the browser tab, reusing the same guest bridge as `vmmastra` and
`vmlang`.

## Usage

```
vmmastra code                  enter interactive mode (one line from terminal)
vmmastra code TASK...          run one task and exit
vmmastra code threads          list saved threads
vmmastra code reset            drop the current thread
```

## Interactive mode

When invoked without a task, `vmmastra code` prints `code>` and waits for one
line of input (or reads all of stdin if piped).  Each line is sent as a separate
task to the browser agent, which maintains the thread across calls.

## Slash commands

Typed at the `code>` prompt:

| Command | Description |
|---------|-------------|
| `/exit` | Return to the guest shell |
| `/stop` | Cancel the in-flight agent response |
| `/reset` | Drop the current thread and start fresh |
| `/help` | List all slash commands and modes |
| `/mode <name>` | Switch mode: `code`, `chat`, or `batch` |

## Modes

| Mode | Behaviour |
|------|-----------|
| `code` (default) | Full tool loop: the model reads, writes, and runs commands in the guest through the Mastra workspace tools |
| `chat` | Pure text generation with no tools.  Uses the conversation history but does not load the Mastra agent bundle |
| `batch` | One-shot script mode: the model writes one shell script for the whole task; falls back to the tool loop if the script fails |

`/mode` without an argument prints the current mode.

## Threads

Each session uses one thread stored in IndexedDB (`vmmastra-code` database,
`threads` store).  Threads survive page reloads and contain the full message
history.

- `vmmastra code threads` — list all saved threads with mode, message count,
  and last-updated time
- `vmmastra code reset` — clear the current thread and start a new one

The `/reset` slash command is equivalent to `vmmastra code reset`.

Threads are not switched from the terminal; the CLI always operates on the
current thread.  Thread IDs are exposed by `vmmastra code threads` for
potential future tool integration.

## Lifecycle

The code harness is lazy: the `mastra-agent.js` bundle (9.7 MB, @mastra/core
and the full workspace toolchain) is only loaded when the agent is first called
in `code` or `batch` mode.  Chat mode never loads it.  The harness itself
(`mastra-code.js`, ~80 KB) is imported lazily on first `vmmastra code`.

## Implementation

| File | Role |
|------|------|
| `agent/src/mastra-code.js` | `CodeAgentHarness` class: threads, slash commands, modes, cancellation |
| `agent/dist/mastra-code.js` | Browser bundle (79 KB), lazy-imported |
| `agent/test/mastra-code.test.mjs` | Unit tests (9 tests) |
| `agent/test/mastra-code.e2e.test.mjs` | E2E tests (12 tests) |
| `network/guest/mastra-vm` | Guest script: `code` subcommand + interactive `code>` prompt |
| `shared/vmagent-controller.js` | Controller: `handleMastraCode` dispatch, stop/reset wiring |
| `index.html` | Lazy import binding |

The `CodeAgentHarness` delegates to `createMastraVMAgent` (from
`mastra-agent.js`) for tool-using modes and to the raw LiteRT-LM client for
chat mode.  Abort propagation works via the controller's shared
`this.abortController` and the harness's own `this.abortController`.
