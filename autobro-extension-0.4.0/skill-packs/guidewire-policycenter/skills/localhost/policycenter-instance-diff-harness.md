# Guidewire PolicyCenter Cross-Instance Diff Harness (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to compare two PolicyCenter discovery snapshots and produce a markdown
report that separates **version drift** from **client customization**. It
consumes the JSON emitted by `policycenter-instance-id-typelist-discovery.md`
(the Go bridge discovery workflow output) and is fully offline after capture
live instance needed once the two JSON files exist.

This is the deterministic, scriptable companion to `policycenter-environment-diff.md`
(which describes the manual/conceptual diff). Prefer this harness when you have
two discovery JSONs in hand.

## When to use

- You captured a baseline (e.g. OOTB `10.0.3.1250`) and a target (a client
  deployment) and need to know what changed and why.
- You want a repeatable, reviewable artifact rather than eyeballing two JSONs.

## Inputs

Two JSON files from the Go bridge ID and typelist discovery workflow (read-only and/or
`--mutating`). Both should be captured with the **same role and locale** so
differences reflect the instance, not the session.

## Run

```powershell
$baseline = Get-Content .\baseline.json -Raw | ConvertFrom-Json -Depth 100
$target = Get-Content .\target.json -Raw | ConvertFrom-Json -Depth 100
Compare-Object ($baseline | ConvertTo-Json -Depth 100) ($target | ConvertTo-Json -Depth 100)
```

Generate both input snapshots through the Go bridge commands in
`policycenter-instance-id-typelist-discovery.md`. Compare stable IDs, options,
LOBs, and wizard steps structurally and write the report as Markdown.

## What it compares

- **Anchor screens** present/absent.
- Per shared screen:
  - **Stable IDs** added/removed (TabBar-*, *MenuActions, search/reset actions,
    columnsMenu, WithdrawJob, etc.).
  - **Typelists** per `<select>` (matched by `name`): codes added/removed, and
    **label→code drift** — same option text, different value.
- **LOB products** added/removed.
- Per shared LOB: **wizard step IDs** added/removed.

## How to read the report

| Signal | Most likely cause |
|---|---|
| Missing/added anchor screen or stable ID | permission, product, or module difference |
| Same label, different code/id (⚠ drift) | **version or customization drift** — rediscover the workflow before reusing automation |
| Added/removed typelist codes | config, jurisdiction, or edition difference |
| LOB product delta | licensing or product-model difference |
| Wizard step delta on a shared LOB | PCF customization or version difference |

The ⚠ **label→code drift** line is the key version-vs-customization
discriminator: a stable label whose backing code changed almost always means
the typelist was re-keyed by a version upgrade or a customer reconfiguration —
existing automation keyed on the old code will silently break.

## Workflow

1. On the baseline instance, run the Go bridge discovery workflow and save
   `baseline.json`.
2. On the target instance, run the same workflow and save `target.json`.
3. Compare the two JSON documents and write `report.md`.
4. Triage the report top-down: screen/ID gaps first (broadest impact), then
   drift lines (silent breakage risk), then typelist/LOB/wizard deltas.

## Related Skills

- `policycenter-instance-id-typelist-discovery.md` — produces the input JSON.
- `policycenter-environment-diff.md` — manual/conceptual diff approach.
- `policycenter-instance-feature-discovery-automation.md` — feature surface capture.
