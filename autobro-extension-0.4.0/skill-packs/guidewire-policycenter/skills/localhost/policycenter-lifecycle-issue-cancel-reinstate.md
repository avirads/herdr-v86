# Guidewire PolicyCenter Lifecycle: Issue / Cancel / Reinstate (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Drive a submission past Quote into a bound, **issued** policy, then through
**cancel** and **reinstate**. Mutating and persistent — creates and modifies a
real policy. Run only on test accounts with approval. Proven end-to-end on
Personal Auto, 10.0.3.1250 (Policy 8639009137: issued → cancelled → reinstated).

## Critical gotchas (these cause silent failure)

1. **Add list-detail items via the hidden dropdown menu item, NOT a
   visible-only click.** "Add Driver" / "Add" toolbar buttons are
   `gw-AddButtonWidget` dropdowns whose real adders are hidden child menu items
   (`...AddDriver-AddExistingContact-0-UnassignedDriver`). `gwClick` fires hidden
   items; a visible-only matcher finds nothing and the add silently no-ops. If
   you skip this, the policy ends up with **zero drivers** and the
   driver→vehicle assign button renders disabled (`DisabledAddDriverButton`) —
   which looks like a mysterious config block but is just "no drivers exist".
2. **Conditional selects reload on change.** The cancellation Reason list depends
   on Source — set Source, wait for the postback, THEN read the (new) Reason
   options and set one that exists for that Source. A reason valid for "Insurer"
   is absent for "Insured".
3. **Bind/Issue/Reinstate ids are screen-scoped and NOT under the LOB step
   group.** They are `SubmissionWizard-SubmissionWizard_QuoteScreen-...`,
   `CancellationWizard-CancellationWizard_QuoteScreen-...`,
   `ReinstatementWizard-ReinstatementWizard_QuoteScreen-...`. The final action is
   hidden under a `BindOptions` dropdown (or a direct button) — gwClick it by
   exact id.
4. **Native confirm() on bind** — handle with the CDP dialog pattern
   (`pendingDialog`/`acceptDialog`), see `policycenter-instance-id-typelist-discovery.md`.

## ISSUE (Personal Auto recipe)

1. Account → New Submission → Personal Auto (see `policycenter-wizard-subentity-drilldown.md`).
2. Offering: `OfferingSelection` = Standard Program → Next.
3. Qualification: first choice question (currently insured) = Yes → Next.
4. Policy Info → Next.
5. Drivers: add existing contact (hidden menu). Fill `LicenseInputSet-LicenseNumber`,
   `LicenseInputSet-LicenseState`=CA, `PolicyContactRoleNameInputSet-DateOfBirth`.
   Roles card tab: `PolicyDriverInfoDV-yearlicensed`, and BOTH the policy-level
   (`-PolicyDriverNumberOfAccidents/Violations`) and account-level
   (`-DriverNumberOfAccidents/Violations`) counts = 0 (discriminate by the
   `-DriverNumberOf` vs `-PolicyDriverNumberOf` segment). → Next.
6. Vehicles: Add (visible). Fill `VehicleDV-Year/Make/Model`, `Vin_DV`,
   `LicenseState`, `CostNew` (a valid VIN may auto-fill year/make/model).
7. Assign driver: click `...DriverPctLV_tb-AddDriver` then its hidden child
   `...DriverPctLV_tb-AddDriver-0-Driver`; percentage auto-fills 100. → Next.
8. Coverages → Quote (`...QuoteTypeToolbarButtonSet-Quote`). Resolve any
   remaining required fields surfaced as `Errors:` and re-Quote until clean.
9. Issue: open `...QuoteScreen-JobWizardToolbarButtonSet-BindOptions`, then
   gwClick `...-BindOptions-BindAndIssue` ("Issue Policy"). Page → "Submission
   Bound" with the new Policy #.

## CANCEL

1. Open the policy (Policy tab → retrieve by number).
2. Actions → `...PolicyFileMenuActions_CancelPolicy` (hidden gwClick).
3. Start Cancellation screen: set `CancelPolicyDV-Source` (Insured/Insurer);
   wait; set `CancelPolicyDV-Reason` from the now-valid options; effective date
   defaults. Click `StartCancellationScreen-NewCancellation` ("Start
   Cancellation") → a Cancellation job (Quoted) on a Confirmation screen.
4. `...CancellationWizard_QuoteScreen-...-BindOptions` → `-CancelNow` ("Cancel
   Now") or `-SubmitCancellation` ("Schedule Cancellation"). Page →
   "Cancellation Bound"; policy is cancelled.

## REINSTATE

1. Retrieve the cancelled policy. Actions →
   `...PolicyFileMenuActions_ReinstatePolicy` (hidden gwClick).
2. Start Reinstatement: set `ReinstatePolicyDV-ReasonCode` (Other / Payment
   received) → Next → Risk Analysis ("No issues identified") → Quote.
3. Click the direct `...ReinstatementWizard_QuoteScreen-...-Reinstate` button
   (no BindOptions dropdown here). Page → "Reinstatement Bound"; policy back in
   force.

## LOB variance — check each, don't assume (proven: PA + BOP)

The issue/cancel/reinstate *mechanism* is identical across LOBs, but the
submission data entry differs. Verify each LOB rather than reusing field lists.

**Businessowners (BOP) specifics, 10.0.3.1250:**
- Policy Info requires **Organization Type**; Businessowners Line requires
  **Small Business Type**.
- **Locations** sub-entity: "New Location" opens a `BOPLocationPopup` modal
  (address fields + Territory Code). The territory code must be valid for the
  state — use the **"Autofill Territory Code"** link
  (`...TerritoryCodeInputSet-AutofillLink`) rather than guessing. Commit with
  `BOPLocationPopup-LocationScreen-Update` (OK).
- **Buildings** sub-entity: per-location. On the Buildings step, select a
  location row, then `...BOPLocationBuildingsLV_tb-Add` opens a
  `BOPBuildingPopup`. Required: Building Class Code, Building Limit, Business
  Personal Property Limit. Class Code uses a **Search picker popup**
  (`...BOPBuildingClassCodePicker` → "Class Code Search" → fill Classification →
  Search → `ClassCodeSearchResultsLV-N-_Select`). Commit with
  `BOPSingleBuildingDetailScreen-Update`.
- **Every location needs ≥1 building** or quote fails. The account's existing
  location is auto-added alongside any you create — remove extras you don't
  need (Locations step → check row `_Checkbox` → `LocationsEdit_DP_tb-Remove`).
- Cancellation **Reason list depends on Source**: Insured and Insurer expose
  different reason sets (both captured in `deep-bop/05-cancel-start.json`).

## Navigation & dialog gotchas (learned driving BOP)

- **Reaching the PolicyFile from a just-bound submission:** the bound wizard
  holds a lock and Policy-tab retrieval lands back *in the wizard*. Use the
  wizard **Actions → Go to → Policy File**
  (`...WizardMenuActions_Goto-WizardMenuActions_ToPolicyFile`). From a
  JobComplete/confirmation screen, use the **"View your policy"** link
  (`...JobCompleteDV-ViewPolicy`).
- **Long bind/issue ids get mangled through the shell CLI** (`fired:false` on a
  valid element). Fire them by calling `gwEvents.abstractOnEvent` on the element
  inside a single page-eval expression instead of passing the id as a CLI arg.
- **The confirm() on bind/cancel/reinstate freezes the page**, so follow-up
  evals time out. Send the bridge's `acceptDialog` **with the PolicyCenter tab's
  explicit `tabId`** — if the user switched the active Chrome tab, a bare
  `acceptDialog` hits the wrong tab. Find the id via `listTabs` (match
  `/pc/PolicyCenter`).

## Cleanup / state

A bound policy CANNOT be withdrawn — only cancelled. Drafts (un-bound) should be
withdrawn and swept through exact `gwClick` actions. Leaving a test policy
reinstated/in-force is a clean end state. Use the Go bridge workflow and the
end-to-end captures live in `D:/guidewire/audit/baseline/` (`deep-pa/06..11`).

## Related Skills

- `policycenter-wizard-subentity-drilldown.md` — the add-item sub-entity loop.
- `policycenter-wizard-field-discovery.md` — per-step fields.
- `policycenter-job-withdrawal-cleanup.md` — draft cleanup.
