# Skill: drive the Mastra agent tier

Operating manual for an agent using the `vmmastra` command in this guest without
a human in the loop. Installed at `/usr/local/share/mastra/SKILL.md`.

Before choosing shell tools, read `/usr/local/share/vm-agent-capabilities.md`.
It includes the installed Grafana `k6` command for JavaScript HTTP/API
performance and load testing.

Deep Agents auto-discovers skills under `/root/project/skills/*/SKILL.md`.
Mastra does **not** read skills or `AGENTS.md` at all — if you are the Mastra
agent, this file only reaches you when something puts it in your context. To
let Deep Agents pick it up:

    mkdir -p /root/project/skills/mastra && \
      cp /usr/local/share/mastra/SKILL.md /root/project/skills/mastra/

## Decide whether to use it at all

Three tiers share this guest. Measured per-operation cost (`docs/agent-tiers.md`):

| Want | Use | Why |
|---|---|---|
| Anything expressible as one shell script | `vmmastra batch 'TASK'` | 1 round-trip, ~725 ms — fastest here, and falls back if the script fails |
| The same, without loading the 9.7 MB bundle | `rig --codeact 'TASK'` | 1 round-trip, ~973 ms, but no fallback |
| Simple file + shell work | `rig 'TASK'` | 1 round-trip per operation, 4 tools |
| Broadest tool set, or a follow-up conversation | `vmlang 'TASK'` | 1 round-trip per operation, 18 tools, persistent session |
| Mastra's workspace/planning specifically | `vmmastra 'TASK'` | 5 round-trips on the benchmark task, ~15% faster than `vmlang` |

**Reach for `vmmastra batch` first, then check its work.** One model call
writes one shell script and one round-trip runs it, ~3.5x faster than any tool
loop. It prepends `set -e`, so a script that *dies* partway exits non-zero and
the run falls back to the full tool loop automatically. A failed attempt costs
~240 ms.

**But `set -e` does not catch wrong answers.** Measured on real weights over
eight tasks: 7 worked, 1 was wrong, and `set -e` caught **none of them** — the
model's typical mistake is a script that exits 0 having done the wrong thing.
Asked to put `uname -m` in a file it wrote `printf "uname -m
" > ARCH.txt`,
storing the text instead of running the command. Batch mode cannot detect that
and will report success. Verify by side effect, every time.

Batch mode is not always right: it cannot ask a follow-up question, and a task
that genuinely needs to look at a file before deciding what to do next is
better served by the tool loop. Use plain `vmmastra` for those.

Mastra's tool loop is no longer the slow tier — it beats Deep Agents on the
benchmark task, and `grep`, `glob`, `mkdir`, `file_stat`, `edit_file` and
`execute_command` all cost a single round-trip. A **cold** single file read
still costs ~1.9 s against rig's ~0.5 s because `read_file` issues `stat`,
`read`, then `stat` again, but a repeat inside the cache TTL costs nothing.

**Use `glob`, not a recursive `list_files`.** Asking "which .md files are in
this tree" costs 494 ms with `glob` and 4738 ms with `list_files` — and
`list_files` truncates at depth 2, so it will quietly omit anything deeper.
The matcher is the guest's `find -path`, where `*` crosses `/`: write
`*.md` to search recursively. `**/*.md` skips files in the top directory.

## Preflight — always, before the first task

    vmmastra status

Proceed only when `model:` names a model. If it says `not configured`, the
browser has no model loaded and **no task can succeed**; stop and report that,
rather than issuing a task that will fail. `status` is safe to run at any time:
it needs no model and will not build the session.

## Commands

    vmmastra TASK...              run a task
    vmmastra run TASK...
    vmmastra batch TASK...        one script, one round-trip; falls back to the
                                tool loop if the script exits non-zero
    vmmastra status               model, approvals, tool profile, prompt cost
    vmmastra tools                list the tools currently active
    vmmastra tools lean|full      9 workspace tools, or all 20
    vmmastra cost                 system-prompt budget for the active profile
    vmmastra yolo on|off          approvals for mutations and shell commands
    vmmastra reset                drop the session and rebuild on next run
    vmmastra stop                 abort the task in flight

One task per invocation. There is no follow-up prompt — carry context forward
by restating it in the next task.

## Rules that change the outcome

**Verify by side effect, never by the agent's answer.** Mastra hands tool
errors back to the model as tool *results*, so a broken tool produces a fluent,
confident, wrong answer with nothing changed on disk. This is the single most
common way a run silently fails. After any task that should have changed
something:

    vmmastra 'write a one-line summary to /SUMMARY.md'
    cat /root/project/SUMMARY.md    # the actual check

If the file is absent or unchanged, the run failed regardless of what it said.

**Use absolute workspace paths.** `/README.md`, not `README.md`. Relative paths
now resolve against the project root, but absolute is unambiguous and is what
the tools document.

**Batch the work.** Every tool call is one serial round-trip to an emulated
i686 (~400 ms floor, and Mastra pays 2–3 per file operation). One task that
says "read A and B, then write C" beats three tasks.

**Approvals block progress.** With YOLO off, every mutation and shell command
waits on a browser confirmation dialog that nobody will click in an autonomous
run. Either `vmmastra yolo on` first, or restrict yourself to reads. `vmmastra
yolo` and `vmlang yolo` set the same flag.

**Watch the context budget.** The full 19-tool profile spends ~5,750 tokens —
about 35% of the model's 16k window — before your task is even added. If tasks
start failing or the model ignores instructions, drop to `vmmastra tools lean`
(8 tools, ~2,830 tokens) and retry. Use `vmmastra cost` to see the current
figure.

## Failure modes and what to do

| Symptom | Cause | Action |
|---|---|---|
| `no model loaded` | no `.litertlm` loaded in the browser | stop; a human must use **Configure LLM** |
| `WebGPU LLM is not ready` | page still initialising | wait, re-run `vmmastra status` |
| `another agent task is running` | one task at a time across all tiers | `vmmastra stop`, or wait |
| `guest bridge is still initializing` | VM not up yet | wait for the shell prompt |
| `tier is not available in this build` | bundle missing | use `rig` or `vmlang` instead |
| confident answer, nothing changed | tool failed and was reported to the model as a result | check the side effect; retry with an absolute path, or `vmmastra tools lean` |
| model ignores instructions | prompt budget crowding the window | `vmmastra tools lean` |

`vmmastra reset` clears a wedged session; the next run rebuilds it. It does not
require a model, so it is always safe.

## A worked autonomous loop

    vmmastra status                      # gate: is a model loaded?
    vmmastra yolo on                     # no human to approve mutations
    vmmastra tools                       # know what is available
    vmmastra batch 'read /README.md and write a one-line summary to /SUMMARY.md'
    cat /root/project/SUMMARY.md       # verify by side effect, not by the answer

Use `batch` as the default verb in a loop like this. It is the fastest path and
it already retries through the tool loop on its own when the script fails, so
you do not have to code that retry yourself — but it still cannot tell you the
*result* was right, only that nothing exited non-zero. The `cat` is not
optional.

If `SUMMARY.md` is missing: `vmmastra tools lean`, then retry the same task once
with plain `vmmastra` (the tool loop can inspect state between steps in a way one
script cannot). If it fails again, fall back to `rig --codeact` — fewer moving
parts, no bundle to load.
