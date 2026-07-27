# Guidewire PolicyCenter Generic LOB Flow Completion (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

An **LOB-agnostic algorithm** to drive any Line of Business from initiation
through **issue**, then every policy function (**Change/endorsement, Cancel,
Reinstate, Renewal, Rewrite**). The submission data entry is LOB-specific
(discover it with `policycenter-generic-lob-discovery.md` or look it up in
`policycenter-lob-catalog.md`); everything from Quote onward, and all
policy-level transactions, are **shared across LOBs** and encoded here. Proven
on Personal Auto and BOP end-to-end.

Mutating and persistent — issuing creates a real policy. Test accounts only.

## Phase A — Submission to Issue (any LOB)

1. **Initiate**: account → New Submission → select the LOB
   (`...ProductSelectionLV-<row>-addSubmission`); poll for
   `[id*="SubmissionWizard"]`.
2. **Offering**: set the offering `<select>` (`*-OfferingSelection`) if present.
3. **Fill-and-advance loop** (the core): for each step, fire Next; if the title
   doesn't change, read `Missing required field "X"` and resolve each per the
   discovery decision tree (select / input / picker / autofill / another-page).
   For **sub-entities**, add via the hidden dropdown child id, then fill the
   detail card tabs (see `policycenter-wizard-subentity-drilldown.md`). Re-Next.
   - Resolve **cross-references** too: e.g. an auto LOB needs each vehicle to
     have an **assigned driver** (`DriverPctLV_tb-AddDriver` → hidden `-0-Driver`,
     percentage auto-100); a property LOB needs **each location to have a
     building**, and removes extra auto-added locations.
4. **Quote**: `...QuoteTypeToolbarButtonSet-Quote`. Each quote re-validates the
   whole job and surfaces the next batch as `Errors:` — loop step 3 until clean.
5. **Issue**: open `...<Wizard>_QuoteScreen-JobWizardToolbarButtonSet-BindOptions`,
   then gwClick its hidden child `...-BindOptions-BindAndIssue` ("Issue Policy").
   Some jobs use a **direct button** instead of a dropdown (e.g. policy change:
   `...-BindPolicyChange`). Page → "Submission Bound" with the new Policy #.

## Phase B — Policy functions (LOB-agnostic, from the PolicyFile)

Reach the PolicyFile: from a just-bound wizard use **Actions → Go to → Policy
File** (`...WizardMenuActions_ToPolicyFile`) or the JobComplete **"View your
policy"** link (`...JobCompleteDV-ViewPolicy`) — Policy-tab retrieval lands back
in the locked wizard. An **in-force** policy's Actions → New Transaction exposes:
`PolicyFileMenuActions_NewWorkOrder-PolicyFileMenuActions_<Name>` where `<Name>`
∈ {ChangePolicy, CancelPolicy, RenewPolicy}; **Rewrite** only on cancelled/
expired policies.

All transactions follow the same shape: **start screen (set reason/date/options)
→ job wizard (edit if needed) → Quote → bind**. Bind id varies by job — find the
visible `Bind|Issue|Reinstate|CancelNow` action on the QuoteScreen toolbar.

| Function | Start action | Bind/complete action | Notes |
|---|---|---|---|
| **Change** (endorsement) | `..._ChangePolicy` → fill Description → `StartPolicyChangeScreen-NewPolicyChange` | direct `...-BindPolicyChange` ("Issue Policy") | empty change allowed ($0); edit a sub-entity to make a real change |
| **Cancel** | `..._CancelPolicy` → Source (wait) → Reason (reloads by Source) → date → `StartCancellationScreen-NewCancellation` | `...CancellationWizard_QuoteScreen-...-BindOptions-CancelNow` (or `-SubmitCancellation`) | → "Cancellation Bound" |
| **Reinstate** | `..._ReinstatePolicy` → ReasonCode → Next → Quote | direct `...ReinstatementWizard_QuoteScreen-...-Reinstate` | only on a cancelled policy → "Reinstatement Bound" |
| **Renewal** | `..._RenewPolicy` → walks LOB steps (Next / ViewQuote) | quote/bind **only within the renewal window** | far from expiry it parks in `Workflow:(Wait Timeout/Manual)`; withdraw via `CloseOptions-Withdraw` (not `-WithdrawJob`) |
| **Rewrite** | from a cancelled/expired policy | (same job-wizard shape) | not offered on in-force policies |

## Cross-cutting mechanics (apply to every phase)

- **Tab lock**: resolve the PolicyCenter tab once (`listTabs` → match
  `/pc/PolicyCenter`) and pass `tabId` on every bridge command — the user may
  switch the active Chrome tab.
- **Native confirm() freezes the page** on bind/withdraw/cancel: send the
  bridge's `acceptDialog` with the **PC tab's explicit tabId** (don't let it hit
  the wrong tab). It is freezing the page, so issue follow-up evals only after
  accepting.
- **Long action ids mangle through the shell CLI** → fire
  `gwEvents.abstractOnEvent(el, new MouseEvent('click',{bubbles:true}), false)`
  inside a page eval instead of passing the id as a CLI arg. `gwClick` fires
  hidden menu items.
- **Step links** are exact ids (`<Wizard>-LOBWizardStepGroup-<Step>`); a
  substring match can hit a non-navigating container — prefer Next, or the exact
  id.
- **Session/bridge resilience**: re-check `$env:BH_CLIENT health`; bridge
  restart → `$env:BH_ADMIN start`; logged out → fill the login controls on the
  PC tab; if the popup is
  disconnected, ask the user to click **Bridge** (cannot be done from outside
  Chrome).

## Cleanup / end state

- Un-bound drafts: `withdraw` + `sweep`. A **bound policy cannot be withdrawn**
  — only cancelled; don't bind unless you intend to keep or cancel it.
- Restore with `home` (Desktop → My Summary).

## Suggested deterministic shape

Encode per LOB as: `enter → [fill map + sub-entity recipe from catalog] →
quote-until-clean → issue`, then reuse the shared Phase-B table for transactions.
The Go bridge client is the interactive driver; `policycenter-submission-issue.md`
is the worked end-to-end example
to clone per LOB.

## Related Skills

- `policycenter-generic-lob-discovery.md` — map an unknown LOB first.
- `policycenter-lob-catalog.md` — per-LOB steps/sub-entities/required fields.
- `policycenter-lifecycle-issue-cancel-reinstate.md`, `policycenter-policy-transactions.md` — the worked references.
- `policycenter-wizard-subentity-drilldown.md`, `policycenter-popup-picker-patterns.md`, `policycenter-validation-error-resolver.md`.
