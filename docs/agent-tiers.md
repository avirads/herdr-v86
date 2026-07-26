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

With one correction learned the hard way: **round-trips are not all the same
price.** A `read` RPC is cheap; an `execute` RPC pays fork/exec inside the
guest, and every extra process the command spawns is charged again. So count
trips first, but weigh them — an "optimisation" that traded two cheap trips for
one expensive one measured 1.7 s *slower* (see below).

## Per-feature cost

Median of 3, measured against a real booted guest with the model out of the
loop entirely — each tier's own file layer driven directly. Reproduce with:

```sh
PAGE=tier-feature-bench-e2e.html CHROME_BIN=... node network/test/mastra-runner.mjs
```

Format is `wall / guest round-trips`. The Mastra column is measured twice:
**cold** with its filesystem cache disabled (`cacheTtlMs: 0`) — the true cost
of one call from scratch — and **warm**, what a repeat inside the TTL costs. A
single number would have let a warm cache masquerade as the cost of the work.

| Feature | `vmagent` | `rig` | `mastra` cold | `mastra` warm |
|---|--:|--:|--:|--:|
| read file | 561 ms / 1 | 560 ms / 1 | 1940 ms / 3 | **0 ms / 0** |
| list directory | 550 ms / 1 | **471 ms / 1** | 820 ms / 2 | 853 ms / 2 |
| write file | 515 ms / 1 | **488 ms / 1** | 1107 ms / 2 | 1106 ms / 2 |
| run command | **405 ms / 1** | 418 ms / 1 | 429 ms / 1 | 479 ms / 1 |
| edit file | 888 ms / 2 | — | **618 ms / 1** | 605 ms / 1 |
| grep | **422 ms / 1** | — | 1454 ms / 3 | 1441 ms / 3 |
| file stat | — | — | 575 ms / 1 | **0 ms / 0** |
| mkdir | — | — | **492 ms / 1** | 489 ms / 1 |
| glob | **490 ms / 1** | — | — | — |

**`rig` and `vmagent` are one round-trip per operation.** Their tools map
straight onto a guest RPC, so they sit at the floor — roughly the cost of the
serial exchange itself.

**Mastra pays 2–3 round-trips on a cold file operation.** `read_file` issues
`stat`, `read`, then `stat` again; `write_file` and `list_files` stat first;
`grep` costs three. That is the workspace abstraction earning its generality.
The short-TTL cache in `V86Filesystem` is what removes the duplicates — a
re-read or a repeat `stat` inside the window costs no trip at all, which is why
the whole-task count below is now equal to `vmagent`'s.

**`run command` used to cost 3× the others at the same single round-trip.**
Mastra's sandbox wrapped every command to separate stderr —
`{ cmd; } 2>/tmp/…; printf …; cat …; rm …` — so one RPC carried several extra
process spawns into a guest where fork/exec is expensive. `index.html` now
ships `sandboxOptions: { captureStderr: false }`, which sends the bare command.
Nothing is lost: `vmagent-rpc` already folds stderr into the output with
`2>&1`, so the model still reads the error text; only the structural
`{stdout, stderr}` split goes away — and Deep Agents never offered that split
in the first place. The library default stays `true` for programmatic callers.

**Mastra wins where its abstraction is doing real work.** `edit_file` is one
operation to Mastra and a read-then-write to Deep Agents, so Mastra is faster
there. `file_stat` and `mkdir` are Mastra-only; `glob` is Deep-Agents-only.

## Whole-task cost

Same logical task through each tier — read a file, check the arch, write a
note — with model latency held at zero so the number is the tier, not the
model (`PAGE=tier-bench-e2e.html`):

| Tier | Wall | Round-trips | Model calls |
|---|--:|--:|--:|
| `mastra batch` | **725 ms** | **1** | **1** |
| `rig --codeact` | 973 ms | 1 | 1 |
| `rig` | 1776 ms | 3 | 4 |
| `mastra` (as shipped) | 2537 ms | 5 | 4 |
| `mastra batch`, script failed → fell back | 2778 ms | 5 | 4 |
| `vmagent` (Deep Agents) | 3041 ms | 5 | 4 |
| `mastra` (stderr split on) | 3923 ms | 5 | 4 |

**Mastra's tool loop is now faster than the Deep Agents tier** — the same five
round-trips and ~15% less wall clock, where it was 1.68× slower before. Two
changes did it, and only one of them was about trip count:

1. The filesystem cache took the task from 6 round-trips to 5, matching
   `vmagent`.
2. Dropping the stderr wrapper took ~900 ms out of each command.

`vmagent`'s 5 trips include two at startup, reading `/AGENTS.md` and listing
`skills/`.

### Batch mode is the larger win, and it is bounded

Everything above is a tool loop paying one round-trip per operation. `mastra
batch` and `rig --codeact` instead spend one model call on a single shell
script and one round-trip running it — **3.5× faster than the tool loop**,
which is far more than anything left to win inside the loop.

The reason batch mode is not the default is the row that says *script failed*.
A 2B model writes a correct script often enough to be worth trying and not
often enough to trust. So `mastra batch` differs from `rig --codeact` in one
respect that matters: it prepends `set -e`, so a script that dies halfway exits
non-zero instead of returning its partial output as if it had succeeded. That
makes the exit code worth branching on, and the mode falls back to the full
tool loop when it is not clean.

The trade is priced: **~240 ms lost** on a failed attempt (2778 ms against the
tool loop's 2537 ms), against **~1800 ms saved** when the script works. It wins
outright unless the model fails more than about seven times in eight.
`rig --codeact` has no such fallback — a bad script there returns whatever it
printed.

Enabling Mastra's full 19-tool surface changed round-trips not at all and wall
clock within noise: **extra tools cost prompt tokens, not latency.** With a
real model they also cost prefill time, which this benchmark holds at zero.

### One optimisation that was measured and rejected

Coalescing `stat` and the file body into a single RPC did reduce round-trips
from 6 to 4 — and was **~1.7 s slower**, reproducibly. It moved the file body
onto `guest.execute`, which is a more expensive trip than `guest.read`. Fewer
round-trips is not automatically faster when the trips are not equal. The
prefetch path still exists behind `prefetchMaxBytes`, defaulted to `0`, with
that result recorded at the option.

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

- **`mastra batch`** — fastest of everything here, and the safe way to take
  that speed: a bad script costs ~240 ms and falls back to the tool loop
  instead of returning a half-finished result. Start here for anything
  expressible as one shell script.
- **`rig --codeact`** — the same one-script shape without the bundle or the
  fallback. Needs the model to write a correct script in one shot, and gives
  you no signal when it did not.
- **`rig`** — lowest per-operation overhead, four tools, no bundle. The default
  for simple file-and-shell work.
- **`vmagent`** — one round-trip per operation *and* the widest tool set,
  including `glob`, sub-agent delegation and a persistent conversation. The
  best all-rounder when a task needs more than rig's four tools.
- **`mastra`** — fastest of the three full tool-calling tiers on a whole task,
  though a cold single file read still costs more than `rig`'s, and its full
  surface takes a third of the context window. Choose it for the framework:
  Mastra's workspace abstraction, its planning tools, and single-operation
  `edit_file`.

## Caveats

Measured on one host in headless Chrome against the shipped i686 image;
absolute milliseconds will move with hardware. **Round-trip counts will not** —
they are structural, so carry those rather than the timings.

Model cost is excluded by construction. With a real model each turn adds
inference time that grows with prompt size, which penalises the larger tool
surfaces further than these numbers show.
