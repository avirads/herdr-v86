---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Wizard Field Discovery (Extension + Bridge)

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to capture the field-level surface of each LOB's submission wizard —
the controls, labels, select option sets, and required-field validation per
wizard step. Deeper than `policycenter-instance-id-typelist-discovery.md`
(which captures wizard step IDs only); this captures the fields **inside** each
step, where most client customization lives.

## Depth limit (read first)

PolicyCenter blocks forward navigation past unfilled required fields. So a
no-data walk reaches the Offering step, the Qualification step, and the first
data step (Policy Info) — then validation stops it. The Go bridge workflow captures:

- full field inventory for every **reachable** step, and
- the **validation messages at the blocking step**, which enumerate that step's
  required fields (e.g. "Missing required field Organization Type") — useful
  diff signal without entering data.

Capturing *every* step's fields requires filling required data to advance,
which is a fragile, LOB-specific full-submission flow — out of scope for a
baseline. Observed reachable depth on `10.0.3.1250`: Personal Auto 5 steps,
most commercial LOBs 1–3 steps.

## Rules

- Mutating: creates one draft submission per LOB and withdraws each, with a
  final orphan-draft sweep. Run only where test data is acceptable.
- Withdraw raises a native confirm() — handled via the CDP dialog pattern (see
  `policycenter-instance-id-typelist-discovery.md`).

## Run

```powershell
bridge gotoUrl <PC_URL>
bridge inventoryCurrentPage
bridge relatedActions '["Next|Quote|Withdraw|LOB|Product",100]'
```

Use `ACCOUNT_NUMBER`, `PC_WIZ_MAX_STEPS`, `PC_USERNAME`, and `PC_PASSWORD` from
the environment. The agent writes the collected Go-client JSON to
`PC_WIZ_OUTPUT`.

## How it works

1. Open the test account through `fillInput` and `gwClick`, then open
   account-scoped New Submission and the LOB chooser.
2. For each LOB: Select → enter wizard.
3. Capture `inventoryCurrentPage`, click the exact visible `*-Next` ID with
   `gwClick`,
   action, and re-capture. If the page title did not change, treat it as a
   validation block: record the blocking messages and stop that LOB.
4. Withdraw the draft, handling confirmation with `pendingDialog` and
   `acceptDialog`.
5. After all LOBs, sweep any orphan drafts via the account's
   Open Policy Transactions tile.

## Output shape

```json
{
  "lobs": [{
    "lob": "Personal Auto",
    "stepsReached": 5,
    "steps": [{ "index", "stepTitle", "fieldCount", "fields": [{ "name", "id", "label", "options" }], "messages", "stoppedReason?", "blockingMessages?" }],
    "withdrew": true
  }],
  "orphanSweep": []
}
```

## Diffing

Feed two runs to the same comparison approach as
`policycenter-instance-diff-harness.md` (field-level diff is not yet built into
the structural comparison in `policycenter-instance-diff-harness.md`; compare
`steps[].fields[].name` sets per LOB/step. Field
added/removed on a shared step = product-model or PCF customization; a required
field appearing/disappearing = rule or jurisdiction change.

## Related Skills

- `policycenter-instance-id-typelist-discovery.md` — wizard step IDs, typelists.
- `policycenter-instance-diff-harness.md` — cross-instance diff.
- `policycenter-validation-error-resolver.md` — interpreting required-field messages.
