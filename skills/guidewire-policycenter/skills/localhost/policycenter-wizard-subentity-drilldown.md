---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Wizard Sub-Entity Drill-Down (Extension + Bridge)

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to discover and fill the **sub-entity detail screens** inside a
submission wizard — the add-item panels for Drivers, Vehicles, Locations,
Buildings, etc. — that `policycenter-wizard-field-discovery.md` cannot reach
because they only render after you add an item. This is how you go deeper than
the top-level step fields.

## Rules

- Mutating: requires a draft submission. Withdraw it (or continue to issue) when
  done; sweep orphan drafts.
- Add existing contacts/items where possible (e.g. add the account holder as the
  driver) to avoid creating new contact records.

## The pattern (proven on Personal Auto)

1. Advance to a sub-entity step (Drivers, Vehicles, Locations, Buildings).
2. The step has a list-detail panel with a toolbar **Add** button that is an
   `gw-AddButtonWidget` / `gw-AddMenuItemWidget` dropdown, e.g.
   `...DriversLV_tb-AddDriver`. Its hidden child menu items are the real adders:
   - `...-AddDriver-0-ContactType` = New Person
   - `...-AddDriver-AddFromSearch` = From Address Book
   - `...-AddDriver-AddExistingContact-0-UnassignedDriver` = an existing contact
   `gwClick` fires these even while hidden (no need to expand the menu).
3. Adding an item reveals a **detail panel**, often a `gw-CardTabsWidget` with
   multiple card tabs. PA driver detail tabs:
   `DriverDetailsCV-PolicyContactDetailCardTab` (Contact Detail),
   `-RolesCardTab` (Roles), `-AddressDetailCardTab` (Addresses),
   `-MVRDetailCardTab` (Motor Vehicle Record). Click each card tab and inventory
   its fields — required fields are spread across tabs.
4. Required fields surface via validation on Next/Quote ("Missing required field
   X", and "Errors located on another page: <tab>"). Fill, then retry. Repeat
   until the gate clears.

## Reference: Personal Auto required-field chain (10.0.3.1250)

| Step | Required to advance |
|---|---|
| Offerings | Offering Selection (Basic/Standard/Premium Program) |
| Qualification | "Is the applicant currently insured?" (radios default to No) |
| Policy Info | (defaults sufficient; Producer pre-set BH236200) |
| Drivers | per driver: License # , License State, Year First Licensed (Roles tab), Date of Birth (Contact Detail tab), Policy-level # Violations & # Accidents (Roles tab) |
| Vehicles | per vehicle: VIN, License State, Cost New (Year/Make/Model optional if VIN given); each vehicle needs an assigned driver |
| PA Coverages | defaults; Quote gate re-checks all of the above |

Sub-entity add IDs: `...PADriversScreen-PADriversPanelSet-DriversListDetailPanel-DriversLV_tb-AddDriver`,
`...PAVehiclesScreen-PAVehiclesPanelSet-VehiclesListDetailPanel_tb-Add`.

Commercial LOBs follow the same shape with Locations/Buildings list-detail
panels instead of Drivers/Vehicles — apply the identical add→card-tab→fill loop.

## Tooling

Use the Go client interactively for this loop:

```powershell
bridge inventoryCurrentPage
bridge fillInput '<selector>' '<value>'
bridge setSelect '<selector-or-name>' '<value>'
bridge gwClick '<exact-visible-action-id>'
bridge waitNetworkIdle 20 500
bridge pendingDialog
bridge acceptDialog true
```

## Related Skills

- `policycenter-wizard-field-discovery.md` — top-level step fields.
- `policycenter-lifecycle-issue-cancel-reinstate.md` — drive past Quote to bind/issue and beyond.
- `policycenter-popup-picker-patterns.md` — address-book / contact pickers.
