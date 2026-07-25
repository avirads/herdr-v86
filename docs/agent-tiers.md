# Agent tiers: vmagent, rig, mastra

Three agent tiers ship in the guest. They are not ranked — they trade the same
three resources differently: **guest round-trips**, **system-prompt tokens**,
and **capability**.

| | `vmagent` | `rig` | `mastra` |
|---|---|---|---|
| Framework | Deep Agents (LangChain) | hand-rolled loop | `@mastra/core` |
| Tools | 18 | 4 | 8, or 19 with `enableVmTools`/`enablePlanning` |
| Conversation | persistent (`vmagent>`) | one task per run | one task per run |
| Bundle | `agent/dist/agent.js` | none (in the controller) | `agent/dist/mastra-agent.js`, ~9.7 MB, lazy |

## Why round-trips are the metric

Every tool call is one serial exchange with an emulated i686. `vmbench` puts
that guest at ~1 s for 100k syscalls and ~1.8 s for 200 fork/execs, and a
single round-trip measures ~400 ms wall clock here. Nothing else a tier does
comes close to that, so **round-trip count, not framework efficiency, decides
how fast a tier feels.**

## Per-feature cost

Median of 3, measured against a real booted guest with the model out of the
loop entirely — each tier's own file layer driven directly. Reproduce with:

```sh
PAGE=tier-feature-bench-e2e.html CHROME_BIN=... node network/test/mastra-runner.mjs
```

Format is `wall / guest round-trips`.

| Feature | `vmagent` | `rig` | `mastra` |
|---|--:|--:|--:|
| read file | 556 ms / 1 | **411 ms / 1** | 1736 ms / 3 |
| list directory | 442 ms / 1 | **395 ms / 1** | 786 ms / 2 |
| write file | 484 ms / 1 | **487 ms / 1** | 1082 ms / 2 |
| run command | 398 ms / 1 | **397 ms / 1** | 1290 ms / 1 |
| edit file | 872 ms / 2 | — | **585 ms / 1** |
| grep | **408 ms / 1** | — | 1394 ms / 3 |
| file stat | — | — | **556 ms / 1** |
| mkdir | — | — | **478 ms / 1** |
| glob | **411 ms / 1** | — | — |

Three things this shows:

**`rig` and `vmagent` are one round-trip per operation.** Their tools map
straight onto a guest RPC, so they sit at the floor — roughly the cost of the
serial exchange itself.

**Mastra pays 2–3 round-trips for most file operations.** `read_file` issues
`stat`, `read`, then `stat` again; `write_file` and `list_files` stat first;
`grep` costs three. That is the workspace abstraction earning its generality,
and it is why Mastra reads a file ~4× slower than `rig` does.

**`run command` is the interesting one: same single round-trip, 3× the time.**
Mastra's sandbox wraps the command to capture stderr separately —
`{ cmd; } 2>/tmp/…; printf …; cat …; rm …` — so one RPC carries several extra
process spawns into a guest where fork/exec is expensive. The abstraction cost
is inside the guest, not in the number of trips.

**Mastra wins where its abstraction is doing real work.** `edit_file` is one
operation to Mastra and a read-then-write to Deep Agents, so Mastra is faster
there. `file_stat` and `mkdir` are Mastra-only; `glob` is Deep-Agents-only.

## Whole-task cost

Same logical task through each tier — read a file, check the arch, write a
note — with model latency held at zero so the number is the tier, not the
model (`PAGE=tier-bench-e2e.html`):

| Tier | Wall | Round-trips | Model calls |
|---|--:|--:|--:|
| `rig --codeact` | **950 ms** | **1** | **1** |
| `rig` | 1402 ms | 3 | 4 |
| `vmagent` | 2573 ms | 5 | 4 |
| `mastra` (8 tools) | 4311 ms | 6 | 4 |
| `mastra` (19 tools) | 4114 ms | 6 | 4 |

`rig --codeact` collapses the whole task into one shell script and one
round-trip, which is why it wins by a wide margin — when the model can write a
correct script. `vmagent`'s 5 trips include two at startup, reading
`/AGENTS.md` and listing `skills/`.

Enabling Mastra's full 19-tool surface changed round-trips not at all and wall
clock within noise: **extra tools cost prompt tokens, not latency.** With a
real model they also cost prefill time, which this benchmark holds at zero.

## Prompt budget

The on-device model has a 16k window, so the tool surface is a standing cost
on every turn:

| Tier | Tools | System prompt | Share of 16k |
|---|--:|--:|--:|
| `rig` | 4 | small | — |
| `mastra` lean | 8 | ~2,832 tok | 17% |
| `vmagent` | 18 | — | — |
| `mastra` full | 19 | ~5,749 tok | **35%** |

## Choosing

- **`rig --codeact`** — fastest by a large margin for anything expressible as
  one shell script. Needs the model to write a correct script in one shot.
- **`rig`** — lowest per-operation overhead, four tools, no bundle. The default
  for simple file-and-shell work.
- **`vmagent`** — one round-trip per operation *and* the widest tool set,
  including `glob`, sub-agent delegation and a persistent conversation. The
  best all-rounder when a task needs more than rig's four tools.
- **`mastra`** — slowest per operation, and its full surface takes a third of
  the context window. Choose it for the framework: Mastra's workspace
  abstraction, its planning tools, and single-operation `edit_file`.

## Caveats

Measured on one host in headless Chrome against the shipped i686 image;
absolute milliseconds will move with hardware. **Round-trip counts will not** —
they are structural, so carry those rather than the timings.

Model cost is excluded by construction. With a real model each turn adds
inference time that grows with prompt size, which penalises the larger tool
surfaces further than these numbers show.
