# Guidewire PolicyCenter Generic LOB Discovery (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

An **LOB-agnostic algorithm** for mapping any Line of Business's submission flow
— steps, required fields, sub-entities, and special widgets — without prior
knowledge of that LOB. Use this to onboard a new/unknown LOB (or a customized
one) before automating it. The flow *shape* differs per LOB but the *discovery
method* is identical; this skill is that method. For already-mapped lines see
`policycenter-lob-catalog.md`.

Discovery is structural and reversible: it creates one draft and withdraws it.

## Principle

PolicyCenter tells you what it needs. You do not guess fields — you **read them
off the DOM** (select options, labels) and **off validation messages** (`Missing
required field "X"`). The generic loop: snapshot → try to advance → if blocked,
the error names the next required field → resolve it → repeat.

## Algorithm

### 1. Initiate (LOB-agnostic)

```
open account  → AccountFile-AccountFileMenuActions-AccountFileMenuActions_Create-AccountFileMenuActions_NewSubmission
chooser LV    → NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV
                each product row: "<row>-Description" (LOB name) → "<row>-addSubmission" (enter wizard)
```
Enumerate product rows to list available LOBs; gwClick the target's
`-addSubmission`. Poll for `[id*="SubmissionWizard"]` to confirm the wizard.

### 2. Map the step spine

Repeat per step until you reach "Quote"/"Policy Review":
- **Snapshot** the current step:
  - title = `#gw-center-title-toolbar` (first token before "Back"/"Next")
  - empty required selects = `select` with no value + their option lists
  - sub-entity adds = visible ids matching `_tb-Add`, `_tb-Create`,
    `addLocationButton`, `_tb-AddDriver`
  - messages = `.gw-message`, `.gw-MessagesWidget`
- **Advance** by firing the wizard Next (`*-Next`, or `SubmissionWizard-Next`).
- If the title didn't change → **validation block**: the `messages` enumerate the
  step's required fields. Record them; either fill (to go deeper) or stop and
  record the gate.

This yields the step sequence + per-step required-field set without any data.
Automate this loop with `inventoryCurrentPage`, `relatedActions`, `gwClick`,
and `waitNetworkIdle`.

### 3. Resolve a required field (decision tree)

Each `Missing required field "X"` maps to a control. Find it, then by control
type:
- **`<select>`** → read options off the DOM; pick the first real value, or one
  whose text matches intent. Some reload on change (set the *driver* field
  first, wait, then read the dependent list — e.g. cancel Reason after Source,
  reason list after a type pick).
- **text/number input** → a sensible value (dates `MM/DD/YYYY`, money plain
  digits, VIN a 17-char valid VIN).
- **picker (has a "Search" link / `*Picker` id)** → open it, fill a search
  field, run search (`*SearchLinksInputSet-Search`), select a result row
  (`*ResultsLV-N-_Select`). Returns to the detail with the value set. (BOP class
  code is the reference example.)
- **autofill link** (`*AutofillLink`, e.g. territory) → click it to derive the
  value from context rather than guessing.
- **"another page" errors** (`Errors located on another page: <tab>`) → the
  field is on a sub-entity card tab or a different step; navigate there.

### 4. Drill into sub-entities

For each `_tb-Add` discovered: it is usually a dropdown whose real adders are
**hidden child menu items** (`...-AddExistingContact-0-…`, `...-0-ContactType`,
`...-addSubmission`). `gwClick` the hidden id directly (it fires while hidden).
The added item exposes a **detail panel/popup**, often a `gw-CardTabsWidget`
with several card tabs — inventory each tab's fields; required fields are spread
across tabs. Commit with the panel's OK/Update (`*Popup-*Screen-Update`).

Record per sub-entity: the add id, the detail card tabs, and the required
fields per tab.

### 5. Record

Per LOB capture: offering options, ordered step list, required fields per step
(name + control type + option set/picker), sub-entity add ids + detail
structure, and the validation gates. This is the input an automation/diff needs.

## Tooling

- Interactive flow: use `inventoryCurrentPage`, `fillInput`, `setSelect`,
  `gwClick`, and dialog commands.
- Batch structural walk: repeat the same Go commands for each value in `LOBS`
  and aggregate `lob-structure.json`.
- Per-step field inventory: use
  `policycenter-wizard-field-discovery.md`.

## Safety

Structural discovery only creates a draft; always `withdraw`/`sweep` it. Do not
quote/bind during discovery unless you intend to issue (see the completion
skill).

## Related Skills

- `policycenter-generic-lob-flow-completion.md` — drive any LOB to issue + all functions.
- `policycenter-lob-catalog.md` — already-mapped per-LOB data.
- `policycenter-wizard-subentity-drilldown.md`, `policycenter-popup-picker-patterns.md`.
