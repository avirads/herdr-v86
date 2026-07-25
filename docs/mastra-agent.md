# Mastra agent tier

A third agent tier beside `rig` and `vmagent`, running
[Mastra](https://mastra.ai) entirely in the page — no server. Neither existing
tier is modified.

    mastra 'TASK'

Like `rig`, one task per invocation; there is no persistent conversation and no
separate panel. Lifecycle and approvals are shared with `vmagent`:
`vmagent yolo on|off` governs this tier too.

## How it is put together

| Piece | Role |
|---|---|
| `agent/src/litert-provider.js` | AI SDK spec-v2 model over the page-local WebGPU LiteRT client |
| `agent/src/v86-workspace.js` | `MastraFilesystem`/`MastraSandbox` over the guest RPC |
| `agent/src/vm-tools.js` | the `vm*` and AutoBro tools, ported from the Deep Agents tier |
| `agent/src/mastra-browser.js` | page entry — takes `guestReadonlyClient` + `webGpuLlmClient` |
| `agent/shims/` | 12 shims covering the 14 node builtins `@mastra/core` imports |
| `agent/dist/mastra-agent.js` | ~9.7 MB bundle, imported lazily on first `mastra` run |

The bundle is only fetched when someone actually runs `mastra`, so users who
never touch this tier download none of it.

## Tools and the prompt budget

The on-device model has a 16k context window, so the tool surface is a real
cost, not a free feature. Measured with `systemPromptCost()` (char/4, which is
a floor — real tokenisers run higher on JSON schema text):

| Configuration | Tools | System prompt | Share of 16k |
|---|---|---|---|
| workspace only | 8 | ~2,740 tok | 16.7% |
| + planning | 10 | ~3,746 tok | 22.9% |
| + `vm*` | 14 | ~3,995 tok | 24.4% |
| full parity | 19 | ~5,657 tok | 34.5% |

`index.html` enables the full set, matching the Deep Agents tier's 18 tools.
Calling `createMastraVMAgent` directly defaults to workspace-only; opt in with
`enableVmTools` and `enablePlanning`. `delete` and `lsp_inspect` stay disabled.

To trim further, rename tools: `tools: { [TOOL]: { name: 'sh' } }`.

## Parity with Deep Agents

Same guest command strings and the same approve/YOLO contract, asserted in
`agent/test/vm-tools.test.mjs`: `vmfetch`, `vmgithub`, `vmclip`, `vmexport`,
`vmai`, `vmllm_info`, `browser_search`, `autobro_command`, `autobro_automate`.
Planning uses Mastra's native `taskWrite`/`taskUpdate` rather than a port of
`write_todos`. The filesystem and shell tools come from Mastra's own workspace.

Browser tools carry the Deep Agents once-per-turn guard — a small model will
otherwise re-run a completed browser task repeatedly.

## Testing

```sh
cd agent && node --test test/*.test.mjs                     # unit + integration
cd .. && CHROME_BIN=... node network/test/mastra-runner.mjs # scripted transport e2e
PAGE=mastra-litert-e2e.html CHROME_BIN=... node network/test/mastra-runner.mjs
```

Both e2es boot a real guest and assert on **guest side effects, never on agent
text** — Mastra hands tool-execution errors back to the model as tool results,
so a broken shim yields a confident answer over dead tool calls. Asserting on
text would pass; asserting on the guest would not.

The second e2e drives the genuine `LiteRtLmClient`, substituting only its
`engine` handle.

### What is still unverified

**Real WebGPU inference.** Headless Chrome exposes `navigator.gpu` but
`requestAdapter()` returns null, so weights cannot run in CI here — and a 2 GB
model under software rendering would exceed the 180 s budget anyway. Everything
above that seam is covered: message normalisation, session/KV reuse, tool-call
parsing, transport, and the guest bridge. Loading a real `.litertlm` model via
**Configure LLM** and running `mastra 'TASK'` is the remaining manual check.

## Gotchas

**`setImmediate`** is the dangerous shim. Mastra's tool path calls it, browsers
lack it, and Mastra *catches* the resulting TypeError and returns it to the
model as a tool result. Nothing crashes; every tool "succeeds" with an error
string. `test/browser-fullloop.test.mjs` guards this with a negative control —
remove the polyfill and it flips to `tools never reached the guest bridge`.

**`AsyncLocalStorage` is a synchronous stub** and does not propagate across
`await`. The leak this was expected to cause does not exist: `requestContext`
is threaded explicitly, and Mastra's only ALS instance is `spanContextStorage`
(tracing). Concurrent runs measure clean — `test/als-concurrency.test.mjs`
pins that and fails if a future release moves something onto it. Residual cost
is mis-parented tracing spans.

**Timeouts are layered.** The guest client rejects at 30 s; the sandbox is set
to 25 s so a slow command surfaces as `exitCode: 124` rather than a transport
throw. Raise one, raise both.

**Every guest call is one serial round-trip**, serialised through a single
queue. `writeFile` with `expectedMtime` costs two. On an emulated CPU this
dominates latency — prefer few batched commands.

**Pin `@mastra/core`.** Verified against 1.52.1. A release can add a builtin
import to a shared chunk (breaks the build, loud) or a *call* to an
already-stubbed one (breaks at runtime, quiet).
