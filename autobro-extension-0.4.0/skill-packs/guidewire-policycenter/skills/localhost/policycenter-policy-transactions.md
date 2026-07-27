# Guidewire PolicyCenter Policy Transactions: Change / Renewal / Rewrite (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

The non-issuance policy transactions started from an in-force PolicyFile:
**Policy Change** (endorsement), **Renewal**, **Rewrite** — alongside Cancel and
Reinstate (covered in `policycenter-lifecycle-issue-cancel-reinstate.md`).
Mutating; run on test policies. Proven on BOP policy 4496280336, 10.0.3.1250.

## Which transactions are available when

On an **in-force** policy, the PolicyFile Actions → New Transaction menu exposes
exactly: **Change Policy**, **Cancel Policy**, **Renew Policy** (ids
`PolicyFile-PolicyFileMenuActions-PolicyFileMenuActions_NewWorkOrder-PolicyFileMenuActions_<Name>`:
`ChangePolicy`, `CancelPolicy`, `RenewPolicy`). **Rewrite is NOT offered on an
in-force policy** — it appears only on cancelled / non-renewed / expired
policies. Verify the menu per policy state rather than assuming.

To reach the PolicyFile from a just-bound job wizard, use the wizard
Actions → Go to → Policy File (`...WizardMenuActions_ToPolicyFile`) or the
"View your policy" link on a JobComplete screen — Policy-tab retrieval lands
back in the open/locked wizard.

## Policy Change (endorsement) — proven end-to-end

1. PolicyFile Actions → `..._ChangePolicy` (hidden gwClick).
2. **Start Policy Change** screen: Effective Date (defaults), Description
   (`StartPolicyChangeDV-Description`). Click
   `StartPolicyChangeScreen-NewPolicyChange` ("Next") → enters
   `PolicyChangeWizard` at Offerings.
3. The change wizard mirrors the submission's LOB steps. Make the change you
   need (edit a coverage/limit/sub-entity via the same drill-down as issuance),
   or leave empty — **an empty endorsement is allowed** and quotes to a $0 delta
   on this build.
4. Quote (`...QuoteTypeToolbarButtonSet-Quote`), then bind via the direct
   `...JobWizardToolbarButtonSet-BindPolicyChange` ("Issue Policy") button (not a
   BindOptions dropdown). Page → "Policy Change Bound".

## Renewal — time-windowed (special flow)

1. PolicyFile Actions → `..._RenewPolicy` (hidden gwClick) → `RenewalWizard`,
   status "Renewal (New)".
2. The renewal wizard carries all policy data forward; you can walk every LOB
   step with `RenewalWizard-Next` (no Quote button on the Offerings screen —
   navigation is Next / `RenewalWizard-ViewQuote`).
3. **But quote/bind is gated by the renewal window.** Far from expiry the
   renewal parks in `Workflow: (Wait Timeout/Manual)` and "View Quote" does not
   produce a quotable/bindable state — the job's Effective date is the *next
   term* start (e.g. one year out). You can create and inspect the renewal but
   cannot complete it until within the renewal window. This is a genuine
   transaction-specific constraint — don't assume the submission quote→bind
   pattern applies.
4. Cleanup: withdraw the draft renewal via
   `...CloseOptions-Withdraw` ("Withdraw Transaction"). Note the renewal uses
   `-Withdraw`, **not** `-WithdrawJob` like submissions/changes.

## Rewrite

Not available on in-force policies (menu omits it). Reachable only from a
cancelled/expired policy; discover it there when a cancelled policy is on hand.

## Dialog handling

Bind/withdraw raise a native confirm() that freezes the page — send the
bridge's `acceptDialog` with the PolicyCenter tab's explicit `tabId` (see
`policycenter-lifecycle-issue-cancel-reinstate.md`). Long bind ids should be
fired via `gwEvents.abstractOnEvent` in a page eval, not passed as a CLI arg.

## Related Skills

- `policycenter-lifecycle-issue-cancel-reinstate.md` — issue, cancel, reinstate.
- `policycenter-wizard-subentity-drilldown.md` — editing sub-entities inside a change.
- `policycenter-job-withdrawal-cleanup.md` — draft/job cleanup.
