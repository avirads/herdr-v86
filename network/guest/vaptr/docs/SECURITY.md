# Security Model

The framework is designed so that **an LLM (or a compromised agent) cannot cause
harm beyond the authorized scope**, even if it tries. This document states the
invariants and how they are enforced in code.

## Threat model

- The **LLM is untrusted** for control decisions. It may be prompt-injected by
  target content (a crawled page, a response body) into *trying* to run commands
  or read files. It must not be able to.
- **Agents are semi-trusted** deterministic code, but are still constrained so a
  bug can't escape scope or the workspace.
- The **operator is trusted** and authorizes the engagement via config.

## Invariants

### I1 — The LLM never executes anything
The LLM is reachable only through `llm.Provider.Summarize(ctx, Report)`. It
receives a finished, validated `model.Report` (data) and returns a string. There
is no tool-calling surface, no shell, no file API exposed to it. Control flow is
owned by `controller`.

### I2 — All execution goes through the Tool Registry
`registry.Build` is the **only** constructor of a `runner.Invocation`. It:
- rejects unknown capabilities,
- rejects any flag not in the tool's `AllowedArgs` allowlist,
- rejects values containing shell metacharacters `` `$;&|<>\n\r"'\ `` or `..`.

Agents name *capabilities* (`scan`), never binaries or flags. See
`registry_test.go` for the enforced cases.

### I3 — No shell
`runner.Exec.Run` calls `exec.CommandContext(bin, args...)` with an explicit
argv. There is no `sh -c`. A value can never be re-parsed as a command, a second
flag, or a redirection.

### I4 — Scope is enforced before anything runs
`controller.Run` executes the Scope Guard first and **aborts if nothing is
approved**. The guard rejects, by default:
- wildcard target expressions,
- `localhost` / loopback,
- RFC1918 / link-local / unique-local IPs,
- bare public IPs (unless listed in `allowed_cidrs`),
- any host not matching `allowed_domains`.

Each of these is opt-in via explicit config flags (`allow_wildcard`,
`allow_private`, `allowed_cidrs`), and every decision is audited.

### I5 — The workspace is a jail
`workspace.path` rejects artifact names containing `/`, `\`, or `..`. All
reads/writes, including the audit log and the resume checkpoint, go through the
workspace. There is no API to write outside the scan directory.

### I6 — Rate limits are unforgeable
`agents.rateArgs` is the single site that translates the operator's `rate_limit`
and `max_concurrency` into per-tool flags. Every agent calls it; none constructs
rate flags by hand.

### I7 — Tamper-evident audit
`audit.Log` writes a hash-chained `audit.jsonl` (`prev_hash → hash`). `Verify`
detects edits and truncation after the fact. Recorded events include scope
decisions, tool invocations, and stage transitions.

## What the LLM *can* do

- Read the structured `Report` it is given.
- Produce prose (executive summary). If no provider is configured, a
  deterministic offline template is used instead (`llm.TemplateSummary`), so the
  framework is fully functional and safe with **no LLM at all**.

## What the LLM *cannot* do

- Execute shell commands or tools.
- Read or write files outside the workspace (it has no filesystem API).
- Install packages or modify system files.
- Widen scope, disable rate limits, or select "all templates".

## Secrets handling

- API keys are **never** stored in config. `llm.api_key_env` names an
  environment variable; the key is read at runtime and never written to the
  workspace.
- The audit log records *that* a tool ran and how many args it had — not secret
  values.

## Operator responsibilities

- Only list assets you own or are authorized to test in `allowed_domains` /
  `allowed_cidrs`.
- Record the engagement authority in `scope.authorization` (required field).
- Keep `rate_limit` / `max_concurrency` within what the target and any contract
  permit.
