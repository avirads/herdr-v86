# Guidewire PolicyCenter LOB Catalog — Step Structure & Sub-Entities (Extension + Bridge)

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Per-LOB submission shape for all 9 lines on this build (10.0.3.1250): wizard
steps, sub-entities (list-detail "Add" panels you must drill into), and
LOB-specific required fields. Use this to plan automation for a given LOB before
driving it — the issue/cancel/reinstate *mechanism* is shared
(`policycenter-lifecycle-issue-cancel-reinstate.md`) but the data entry differs
per LOB. **Check the specific LOB here first; don't assume one LOB's fields.**

Coverage depth: **PA and BOP are proven end-to-end** (issued→cancelled→reinstated,
sub-entity detail screens captured — see the lifecycle + subentity skills). The
other 7 are **structurally mapped** (steps, sub-entities, key required fields)
via a no-data walk; their detail screens follow the same add→card-tab→fill loop.

## Personal lines

**Personal Auto** — Offering: Basic/Standard/Premium Program. Steps: Offerings →
Qualification → Policy Info → Drivers → Vehicles → PA Coverages. Sub-entities:
**Drivers** (4 card-tabs: Contact Detail, Roles, Addresses, MVR), **Vehicles**
(assign driver via DriverPctLV). Required: License#/State, DOB, Year Licensed,
policy+account violation/accident counts; VIN/CostNew; driver→vehicle assignment.
*Fully proven.*

**Homeowners** — personal dwelling; **no list-based sub-entities** (single
dwelling, field-based). Qualification gates on **HOPCoveragePartType**,
**HOPCoverageForm**, and a choice question before the dwelling steps render.

## Commercial lines — Locations/Buildings family

**Businessowners (BOP)** — Offering: Silver/Platinum. Steps: Offerings →
Qualification → Policy Info → Businessowners Line → Locations → Buildings →
Modifiers. Sub-entities: **Locations** (`BOPLocationPopup`, territory Autofill),
**Buildings** (`BOPBuildingPopup`, class-code Search picker). Required: Org Type,
Small Business Type; per location a building; territory code. *Fully proven.*

**Commercial Property** — Steps: Policy Info → Buildings and Locations →
Blankets → Modifiers → Risk Analysis → Policy Review. Sub-entities: **Buildings
and Locations**, **Blankets** (Add Blanket).

**General Liability** — Steps: Offerings → Qualification → Policy Info →
Locations → Coverages → Exposures → Modifiers → Risk Analysis → Policy Review.
Sub-entities: **Locations** (New / Add Existing), **Exposures**.

**Commercial Package** (multi-line, most complex) — Steps: Offerings →
Qualification → Policy Info → **Line Selection** → Locations → Coverages →
Exposures → Modifiers → Line Review → Buildings and Locations → Blankets.
Required: **PackageRisk**. Combines GL + Property lines under one job — expect
per-line review sub-steps. Sub-entities: Locations, Buildings and Locations,
Blankets.

**Inland Marine** — Steps: Policy Info → **Coverage Part Selection** → Buildings
and Locations → Risk Analysis → Policy Review. Sub-entity: **Buildings and
Locations**.

## Commercial lines — vehicle/payroll family

**Commercial Auto** — *Fully proven (issued→cancelled→reinstated, policy
1789238991).* Offering: Standard/Special Risk. Steps: Policy Info → Commercial
Auto Line → Locations → Vehicles → State Info → Drivers → Covered Vehicles →
Modifiers → Risk Analysis → Policy Review. Required: **Product**
(`BALineDV-PolicyType`: Business Auto / Garagekeepers / Motor Carrier / Physical
Damage), **Fleet** (10+ / fewer than 10). Recipe:
- **Locations** — reuse BOP location recipe (`addAllLocationsButton` to pull
  account locations); each location needs a CA-line **territory code** — remove
  extras that lack one (same as BOP).
- **Vehicles** (`BAVehiclesLV_tb-Add` "Create Vehicle", `BAVehiclePopup`) —
  GarageLocation (point at a kept location!), Type, VIN, Year, Make, Model, Cost,
  and **Class** via a Search picker (`ClassCode-SelectClassCode` → dimensions
  SizeClass/PrimaryUse/Radius/Industry; an **empty search lists all valid
  classes for the chosen vehicle Type** — guessing dimensions returns zero).
  Commit `BAVehiclePopup-VehicleScreen-Update`.
- **Liability coverage is required because vehicles exist** — enable it on
  Commercial Auto Line → **Coverages card tab** (`BALinePanelSet-CoveragesCardTab`)
  → check "Commercial Auto Owned Liability" (`BALineCoveragePanelSet-1` checkbox).
  Quote will otherwise error "Liability is required and must be added".
- Issue/cancel/reinstate via the shared recipe (no LOB variance).

**Workers' Compensation** — Steps: Qualification → Policy Info → (State/Class
exposure steps). Required at Policy Info: **SSN**, **Industry Code**,
**Organization Type**. WC is **state-driven**: payroll/class-code exposures are
added per covered state. Sub-entity: state class-code exposures.

## Common patterns across all LOBs

- Most steps walk forward on **Next** with empty data; hard required fields
  surface as `Errors: Missing required field "X"` and block at that step or at
  Quote. Fill, retry. Risk Analysis exposes **Add UW Issue** / **Add
  Contingency** on nearly every LOB.
- Sub-entity "Add" buttons are dropdowns whose real adders are hidden child menu
  items — `gwClick` the hidden id (see
  `policycenter-wizard-subentity-drilldown.md`).
- Detail screens are modals/popups (`*Popup-*Screen-Update` = OK) or inline card
  tabs; required fields spread across card tabs.

## Reproduce

Use the Go bridge workflow to walk LOBs from the comma-separated `LOBS`
environment value and write `lob-structure.json`. The Go client drives any single
LOB interactively (`enter "<LOB>"`, `next`, `fill`, `click`, `withdraw`).

## Related Skills

- `policycenter-lifecycle-issue-cancel-reinstate.md` — issue/cancel/reinstate (PA+BOP).
- `policycenter-wizard-subentity-drilldown.md` — add-item sub-entity loop.
- `policycenter-policy-transactions.md` — change/renewal/rewrite.
- `policycenter-wizard-field-discovery.md` — per-step field capture for all 9 LOBs.
