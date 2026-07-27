# Agent tiers: vmlang, rig, vmmastra

Three agent tiers ship in the guest. They are not ranked — they trade the same
three resources differently: **guest round-trips**, **system-prompt tokens**,
and **capability**.

| | `vmlang` | `rig` | `vmmastra` |
|---|---|---|---|
| Framework | Deep Agents (LangChain) | hand-rolled loop | `@mastra/core` |
| Tools | 18 | 4 | 9, or 20 with `enableVmTools`/`enablePlanning` |
| Conversation | persistent (`vmlang>`) | one task per run | one task per run |
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

| Feature | `vmlang` | `rig` | `vmmastra` cold | `vmmastra` warm |
|---|--:|--:|--:|--:|
| read file | 492 ms / 1 | 478 ms / 1 | 1861 ms / 3 | **0 ms / 0** |
| list directory (recursive) | **465 ms / 1** | 480 ms / 1 | 2077 ms / 5 | 2036 ms / 5 |
| write file | 516 ms / 1 | **503 ms / 1** | 1153 ms / 2 | 1125 ms / 2 |
| run command | **435 ms / 1** | 468 ms / 1 | 442 ms / 1 | 427 ms / 1 |
| edit file | 963 ms / 2 | — | **625 ms / 1** | 621 ms / 1 |
| grep | **460 ms / 1** | — | 506 ms / 1 | 459 ms / 1 |
| glob | 512 ms / 1 | — | **488 ms / 1** | 489 ms / 1 |
| file stat | — | — | 647 ms / 1 | **0 ms / 0** |
| mkdir | — | — | **526 ms / 1** | 513 ms / 1 |

**`rig` and `vmlang` are one round-trip per operation.** Their tools map
straight onto a guest RPC, so they sit at the floor — roughly the cost of the
serial exchange itself.

**Mastra now matches that floor everywhere except reading and listing.**
`read_file` still issues `stat`, `read`, then `stat` again, and `list_files`
walks the tree with a `readdir` per directory. The short-TTL cache in
`V86Filesystem` removes the duplicates on a repeat, which is why the
whole-task count below equals `vmlang`'s.

`grep` and `glob` reach the floor because they bypass Mastra's own
implementations and call the guest directly — see below. `run command` reaches
it because `index.html` ships `sandboxOptions: { captureStderr: false }`;
separating stderr wrapped every command in a temp file plus two extra spawns,
which cost ~900 ms. Nothing is lost: `vmagent-rpc` already folds stderr into
the output with `2>&1`, so the model still reads the error text; only the
structural `{stdout, stderr}` split goes away, and Deep Agents never offered
that split at all. The library default stays `true` for programmatic callers.

**Mastra wins where its abstraction is doing real work.** `edit_file` is one
operation to Mastra and a read-then-write to Deep Agents. `file_stat` and
`mkdir` are Mastra-only.

### Why `glob` and `grep` bypass Mastra

Both exist in `@mastra/core/workspace` already. Both were replaced because
their generic implementations are pathologically expensive against a guest
where every round-trip is ~450 ms:

| Question | Mastra's own way | Ours |
|---|--:|--:|
| which `.md` files are in this tree | `list_files` + `pattern`: 4738 ms / 11 | `glob`: 494 ms / **1** |
| which files contain this string | reads every file to search it: 6576 ms / 34 | `grep`: 506 ms / **1** |

`list_files` also truncates its tree at depth 2, so a file three directories
down is not in the answer at all; `glob` returns flat paths at any depth. The
grep figure is worse than it looks — it scales with the number of files, so 34
round-trips on a six-file project becomes hundreds on a real one.

`fastGrep` **replaces** the workspace grep rather than sitting beside it; two
tools named `grep` would just make the model guess. The trade is that ours is
the guest's `grep -R -n -F`: fixed-string, no context lines, no regex. Set
`{ fastGrep: false }` to get Mastra's back at the price above. Both tools
together made the lean prompt *cheaper* — 2621 tokens against 2832 before —
because their descriptions are shorter than the one they displaced.

One caveat worth knowing: the guest matches with `find -path`, where `*`
crosses `/`. So `*.md` is the **recursive** form here and `**/*.md` silently
skips top-level files — backwards from ordinary glob. The tool description
says so explicitly, because a model will otherwise reach for `**/*.md`.

## Whole-task cost

Same logical task through each tier — read a file, check the arch, write a
note — with model latency held at zero so the number is the tier, not the
model (`PAGE=tier-bench-e2e.html`):

| Tier | Wall | Round-trips | Model calls |
|---|--:|--:|--:|
| `vmmastra batch` | **725 ms** | **1** | **1** |
| `rig --codeact` | 973 ms | 1 | 1 |
| `rig` | 1776 ms | 3 | 4 |
| `vmmastra` (as shipped) | 2537 ms | 5 | 4 |
| `vmmastra batch`, script failed → fell back | 2778 ms | 5 | 4 |
| `vmlang` (Deep Agents) | 3041 ms | 5 | 4 |
| `vmmastra` (stderr split on) | 3923 ms | 5 | 4 |

**Mastra's tool loop is now faster than the Deep Agents tier** — the same five
round-trips and ~15% less wall clock, where it was 1.68× slower before. Two
changes did it, and only one of them was about trip count:

1. The filesystem cache took the task from 6 round-trips to 5, matching
   `vmlang`.
2. Dropping the stderr wrapper took ~900 ms out of each command.

`vmlang`'s 5 trips include two at startup, reading `/AGENTS.md` and listing
`skills/`.

### Batch mode is the larger win, and it is bounded

Everything above is a tool loop paying one round-trip per operation. `vmmastra
batch` and `rig --codeact` instead spend one model call on a single shell
script and one round-trip running it — **3.5× faster than the tool loop**,
which is far more than anything left to win inside the loop.

The reason batch mode is not the default is the row that says *script failed*.
A 2B model writes a correct script often enough to be worth trying and not
often enough to trust. So `vmmastra batch` differs from `rig --codeact` in one
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
| `vmmastra` lean | 9 | ~2,621 tok | 16% |
| `vmlang` | 18 | — | — |
| `vmmastra` full | 20 | ~5,537 tok | **34%** |

## Choosing

- **`vmmastra batch`** — fastest of everything here, and the safe way to take
  that speed: a bad script costs ~240 ms and falls back to the tool loop
  instead of returning a half-finished result. Start here for anything
  expressible as one shell script.
- **`rig --codeact`** — the same one-script shape without the bundle or the
  fallback. Needs the model to write a correct script in one shot, and gives
  you no signal when it did not.
- **`rig`** — lowest per-operation overhead, four tools, no bundle. The default
  for simple file-and-shell work.
- **`vmlang`** — one round-trip per operation *and* the widest tool set,
  including `glob`, sub-agent delegation and a persistent conversation. The
  best all-rounder when a task needs more than rig's four tools.
- **`vmmastra`** — fastest of the three full tool-calling tiers on a whole task,
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
