# Skill: drive the Mastra agent tier

Operating manual for an agent using the `mastra` command in this guest without
a human in the loop. Installed at `/usr/local/share/mastra/SKILL.md`.

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
| Anything expressible as one shell script | `mastra batch 'TASK'` | 1 round-trip, ~725 ms — fastest here, and falls back if the script fails |
| The same, without loading the 9.7 MB bundle | `rig --codeact 'TASK'` | 1 round-trip, ~973 ms, but no fallback |
| Simple file + shell work | `rig 'TASK'` | 1 round-trip per operation, 4 tools |
| Broadest tool set, or a follow-up conversation | `vmagent 'TASK'` | 1 round-trip per operation, 18 tools, persistent session |
| Mastra's workspace/planning specifically | `mastra 'TASK'` | 5 round-trips on the benchmark task, ~15% faster than `vmagent` |

**Reach for `mastra batch` first.** One model call writes one shell script and
one round-trip runs it, which is ~3.5× faster than any tool loop. It prepends
`set -e`, so a script that dies partway exits non-zero and the run falls back
to the full tool loop automatically — you get the speed without the risk of a
half-finished script reported as success. A failed attempt costs ~240 ms.

Batch mode is not always right: it cannot ask a follow-up question, and a task
that genuinely needs to look at a file before deciding what to do next is
better served by the tool loop. Use plain `mastra` for those.

Mastra's tool loop is no longer the slow tier — it beats Deep Agents on the
benchmark task. A **cold** single file read still costs ~1.9 s against rig's
~0.5 s because `read_file` issues `stat`, `read`, then `stat` again, but a
repeat inside the cache TTL costs nothing. Mastra uniquely offers `file_stat`
and `mkdir`, and is faster than Deep Agents at `edit_file`.

## Preflight — always, before the first task

    mastra status

Proceed only when `model:` names a model. If it says `not configured`, the
browser has no model loaded and **no task can succeed**; stop and report that,
rather than issuing a task that will fail. `status` is safe to run at any time:
it needs no model and will not build the session.

## Commands

    mastra TASK...              run a task
    mastra run TASK...
    mastra batch TASK...        one script, one round-trip; falls back to the
                                tool loop if the script exits non-zero
    mastra status               model, approvals, tool profile, prompt cost
    mastra tools                list the tools currently active
    mastra tools lean|full      8 workspace tools, or all 19
    mastra cost                 system-prompt budget for the active profile
    mastra yolo on|off          approvals for mutations and shell commands
    mastra reset                drop the session and rebuild on next run
    mastra stop                 abort the task in flight

One task per invocation. There is no follow-up prompt — carry context forward
by restating it in the next task.

## Rules that change the outcome

**Verify by side effect, never by the agent's answer.** Mastra hands tool
errors back to the model as tool *results*, so a broken tool produces a fluent,
confident, wrong answer with nothing changed on disk. This is the single most
common way a run silently fails. After any task that should have changed
something:

    mastra 'write a one-line summary to /SUMMARY.md'
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
run. Either `mastra yolo on` first, or restrict yourself to reads. `mastra
yolo` and `vmagent yolo` set the same flag.

**Watch the context budget.** The full 19-tool profile spends ~5,750 tokens —
about 35% of the model's 16k window — before your task is even added. If tasks
start failing or the model ignores instructions, drop to `mastra tools lean`
(8 tools, ~2,830 tokens) and retry. Use `mastra cost` to see the current
figure.

## Failure modes and what to do

| Symptom | Cause | Action |
|---|---|---|
| `no model loaded` | no `.litertlm` loaded in the browser | stop; a human must use **Configure LLM** |
| `WebGPU LLM is not ready` | page still initialising | wait, re-run `mastra status` |
| `another agent task is running` | one task at a time across all tiers | `mastra stop`, or wait |
| `guest bridge is still initializing` | VM not up yet | wait for the shell prompt |
| `tier is not available in this build` | bundle missing | use `rig` or `vmagent` instead |
| confident answer, nothing changed | tool failed and was reported to the model as a result | check the side effect; retry with an absolute path, or `mastra tools lean` |
| model ignores instructions | prompt budget crowding the window | `mastra tools lean` |

`mastra reset` clears a wedged session; the next run rebuilds it. It does not
require a model, so it is always safe.

## A worked autonomous loop

    mastra status                      # gate: is a model loaded?
    mastra yolo on                     # no human to approve mutations
    mastra tools                       # know what is available
    mastra batch 'read /README.md and write a one-line summary to /SUMMARY.md'
    cat /root/project/SUMMARY.md       # verify by side effect, not by the answer

Use `batch` as the default verb in a loop like this. It is the fastest path and
it already retries through the tool loop on its own when the script fails, so
you do not have to code that retry yourself — but it still cannot tell you the
*result* was right, only that nothing exited non-zero. The `cat` is not
optional.

If `SUMMARY.md` is missing: `mastra tools lean`, then retry the same task once
with plain `mastra` (the tool loop can inspect state between steps in a way one
script cannot). If it fails again, fall back to `rig --codeact` — fewer moving
parts, no bundle to load.
