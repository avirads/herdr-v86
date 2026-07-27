# Mastra Code tier — step-by-step testing guide

## Prerequisites

- Node.js >= 22
- The Mastra agent bundle must be built:

  ```sh
  cd agent
  ./build-browser.sh src/mastra-browser.js dist/mastra-agent.js
  ```

- The code tier bundle must be built:

  ```sh
  cd agent
  ./build-browser.sh src/mastra-code.js dist/mastra-code.js
  ```

---

## Step 1 — Unit tests (9 tests)

Tests the harness in isolation: slash commands, mode validation, cancellation,
setYolo, help text.

```sh
cd agent
node --test test/mastra-code.test.mjs
```

Expected output:

```
✔ requires guest and llm client
✔ slash commands are returned as typed objects without calling getAgent
✔ /mode switches to valid modes and rejects unknown ones
✔ /reset clears the agent and creates a new thread
✔ setYolo propagates to the mastra agent when built
✔ stop aborts only when a task is in flight
✔ setMode validates mode input
✔ SLASH_COMMANDS is a complete map
✔ help text lists all slash commands and modes
```

---

## Step 2 — E2E tests (12 tests)

Tests the harness end-to-end with fake guest and LLM clients, verifying that
slash commands, modes, thread message accumulation, and lazy agent loading work
correctly.

```sh
cd agent
node --test test/mastra-code.e2e.test.mjs
```

Expected output — 12 passing:

```
✔ E2E: harness constructor requires guest and chat-capable client
✔ E2E: bare /help returns a help screen with all slash commands and modes
✔ E2E: /mode switches modes and the change is reflected in subsequent runs
✔ E2E: /mode with an invalid value returns an error without changing the mode
✔ E2E: /exit returns an exit-type result
✔ E2E: /reset clears the agent and creates a fresh thread
✔ E2E: /stop is a no-op when nothing is running
✔ E2E: a non-slash message is appended to the thread messages
✔ E2E: chat mode calls the raw llm directly, bypassing the Mastra agent bundle
✔ E2E: setYolo propagates to the Mastra agent once it is built
✔ E2E: stop aborts the harness abortController when in flight
✔ E2E: thread messages survive /reset followed by a new message
```

---

## Step 3 — Full regression suite (169 tests)

Verifies that the code tier changes did not break any existing functionality.

```sh
cd agent
node --test
```

Expected: 168+ passing (1 pre-existing failure on Windows:
`browser-fullloop.test.mjs` requires a Unix `sh` shell).

---

## Step 4 — Guest script integration

The `code` subcommand in `network/guest/mastra-vm` handles four payload shapes.
Test them with the serial bridge:

| Command | Payload | Expected behaviour |
|---------|---------|--------------------|
| `vmmastra code` (bare, terminal) | `run:<one line from stdin>` | Prompts `code>`, reads one line, sends it |
| `vmmastra code hello world` | `run:hello world` | Sends task directly |
| `vmmastra code threads` | `threads` | Controller lists saved IndexedDB threads |
| `vmmastra code reset` | `reset` | Controller drops the current thread |

Manual test in the guest terminal:

```sh
# Enter interactive mode, type a message at the code> prompt
vmmastra code
code> count the files in this project

# Run a single task non-interactively
vmmastra code hello world

# List threads
vmmastra code threads

# Reset the current thread
vmmastra code reset
```

---

## Step 5 — Browser smoke test

1. Open `index.html` in Chrome/Edge (requires WebGPU)
2. Load a `.litertlm` model via the **Configure LLM** button
3. Wait for v86 to boot the Alpine guest
4. In the guest terminal, run:

   ```sh
   vmmastra code
   code> /help
   ```

   Expected: the help screen appears, listing all slash commands and modes.

5. Run a task:

   ```sh
   vmmastra code what files are in the project?
   ```

   Expected: the agent reads files in the workspace and reports back.

6. Test slash commands:

   ```sh
   vmmastra code
   code> /mode chat
   code> hello
   code> /exit
   ```

7. Test cancellation:

   ```sh
   vmmastra code list every file recursively
   # While it is running, in another terminal:
   vmmastra stop
   ```

---

## Step 6 — Thread persistence

1. Run a task to build some thread history:

   ```sh
   vmmastra code read the README
   ```

2. Reload the browser page.
3. Run:

   ```sh
   vmmastra code threads
   ```

   Expected: the previous thread is listed with its message count.

4. Continue the same thread:

   ```sh
   vmmastra code what else should I know?
   ```

   The conversation history is preserved because the controller builds the
   harness once and reuses it across calls.  (Note: currently the CLI always
   operates on the most recent thread; thread switching is not exposed from
   the terminal.)
