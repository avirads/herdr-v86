# Guidewire PolicyCenter All LOB Submissions

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for creating, filling, validating, quoting, and documenting new-submission workflows through the Go extension bridge.

## Scope

- Use the PolicyCenter UI only.
- Cover new-submission LOB workflows, not unrelated admin/search/system forms.
- Keep the active Chrome tab on PolicyCenter so the user can watch.
- Use the known UI-created test account and producer setup unless the user asks for a new account:
  - Account: `1445405658`
  - Account holder: `Codex Test236200`
  - Producer: `Codex Test Agency 236200`
  - Producer code: `BH236200`
- If no usable account exists, create one first with `policycenter-account-creation.md`.

## Available LOBs

Product Offers row IDs in this local instance:

| LOB | Row select ID |
| --- | --- |
| Businessowners | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-0-addSubmission` |
| Commercial Auto | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-1-addSubmission` |
| Commercial Package | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-2-addSubmission` |
| Commercial Property | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-3-addSubmission` |
| General Liability | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-4-addSubmission` |
| Homeowners | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-5-addSubmission` |
| Inland Marine | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-6-addSubmission` |
| Workers' Compensation | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-7-addSubmission` |
| Personal Auto | `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV-8-addSubmission` |

## Coverage Status

- Confirmed by UI discovery: all product rows in the table above.
- Confirmed complete issue path: Personal Auto. See `policycenter-submission-issue.md`.
- Confirmed Personal Auto full-app validation blocker from Offerings quote: `The policy must specify at least one vehicle.`
- In-progress templates: Businessowners, Commercial Auto, Commercial Package, Commercial Property, General Liability, Homeowners, Inland Marine, Workers' Compensation.
- Do not mark an LOB as confirmed until a run records its actual submission number, wizard steps, validation blockers, data used, and quote or issue success text in the "Record A Completed LOB" format below.

## Go Bridge Commands

```powershell
& $env:BH_CLIENT gwClick 'Some-Guidewire-Widget-ID'
& $env:BH_CLIENT waitNetworkIdle 30 500
& $env:BH_CLIENT setSelect 'FIELD_NAME' 'value'
& $env:BH_CLIENT inventoryCurrentPage
& $env:BH_CLIENT pendingDialog
& $env:BH_CLIENT acceptDialog true
```

After each manual `gw_click`, prefer:


## Start A LOB Submission

Open the account summary and start a new submission:


Set full app, single policy, and California:


Select the product row from the table above:


## Validation-Driven Fill Loop

PolicyCenter does not expose every mandatory field as HTML `required`. Use the app's own validation as the source of truth.

For each LOB:

1. Capture `inventoryCurrentPage` on the initial wizard screen.
2. Fill obvious top-level choices such as offering, base state, organization, effective date, and policy period.
3. Click `Quote` if available; otherwise click `Next`.
4. Capture validation messages.
5. Navigate to pages named in `Errors located on another page: ...`.
6. Fill only the named blockers.
7. Retry `Quote`.
8. When quoted, open `Bind Options` and choose `Issue Policy` only if the user asked to issue policies, then accept the confirmation dialog.
9. If exploring only, withdraw the draft to avoid leaving clutter.

Generic quote action:


Generic next action:


## Common Fill Defaults

Use these stable defaults when matching fields appear.

### Policy Info


### Qualification Questions

Use low-risk answers:


### Address / Location


If suffix selectors do not work with `fillInput`, inspect
`inventoryCurrentPage` and use the full `name`.

### Commercial Risk Basics

When fields matching these labels appear:

- Legal entity / organization type: choose `Corporation` or the first non-empty value.
- Description of business: `Test business operations`.
- FEIN / Tax ID: `12-3456789`.
- Number of employees: `5`.
- Annual revenue / gross receipts: `250000`.
- Payroll: `250000`.
- Class code / classification: use the first available row/class picker result.

### Personal Auto Defaults

Personal Auto full app was validated in this environment.

Wizard steps:

- `SubmissionWizard-Offering`
- `SubmissionWizard-PreQualification`
- `SubmissionWizard-LOBWizardStepGroup-PolicyInfo`
- `SubmissionWizard-LOBWizardStepGroup-PADrivers`
- `SubmissionWizard-LOBWizardStepGroup-PersonalVehicles`
- `SubmissionWizard-LOBWizardStepGroup-PALine`
- `SubmissionWizard-RiskAnalysis`
- `SubmissionWizard-PolicyReview`
- `SubmissionWizard-ViewQuote`
- `SubmissionWizard-Forms`
- `SubmissionWizard-BillingInfo`

Minimum known blockers after Quote:

- Vehicles: `The policy must specify at least one vehicle.`
- If a vehicle exists: VIN is required.
- Drivers: license number and license state are required.
- Driver Roles: account-level number of accidents and violations are required.

Use `policycenter-submission-issue.md` for the complete PA path.

## LOB Checklist

For each LOB below, run the validation loop and append exact blockers to this skill after completing a successful quote/issue run.

### Businessowners

Expected areas: Offerings, Qualification, Policy Info, Locations, BOP line/coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Business location.
- Organization/legal entity details.
- Building or premises details.
- BOP coverage/package choices.
- Classification or business description.

### Commercial Auto

Expected areas: Offerings, Qualification, Policy Info, Locations, Drivers, Vehicles, CA coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Business location.
- At least one vehicle.
- Vehicle VIN, year, make, model, cost, garaging location.
- At least one driver or vehicle assignment if prompted.
- Coverage selections.

### Commercial Package

Expected areas: Offerings, Qualification, Policy Info, line selection, line-specific screens, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Package line selection.
- Required forms for each selected line.
- Locations and exposure details for selected lines.

### Commercial Property

Expected areas: Offerings, Qualification, Policy Info, Locations, Buildings, Coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Location.
- Building construction/occupancy details.
- Building limit and valuation fields.
- Property coverage terms.

### General Liability

Expected areas: Offerings, Qualification, Policy Info, Locations, GL exposures/classifications, Coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Location.
- GL class code or classification.
- Basis amount such as payroll, receipts, area, or units.
- Coverage selections.

### Homeowners

Expected areas: Offerings, Qualification, Policy Info, Dwelling/location, Coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Residence address.
- Dwelling construction/year/usage fields.
- Coverage A or replacement cost details.
- Protection class or public protection fields if shown.

### Inland Marine

Expected areas: Offerings, Qualification, Policy Info, Locations, scheduled property or IM line items, Coverages, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Location.
- Inland marine item/class/category.
- Item value/limit.
- Coverage choices.

### Workers' Compensation

Expected areas: Offerings, Qualification, Policy Info, Locations, WC coverages, jurisdictions, class codes, Risk Analysis, Policy Review, Quote, Forms, Payment.

Likely required data:

- Employer/legal entity details.
- Primary location.
- Jurisdiction/state.
- Class code.
- Payroll amount.
- Employee count if shown.

### Personal Auto

Use the exact complete workflow in `policycenter-submission-issue.md`.

## Withdraw Exploration Draft

If the task is discovery rather than issuing:


Success cleanup may show `Submission Withdrawn`.

## Record A Completed LOB

After a successful quote or issue, append a section to this skill:

```markdown
### <LOB> Confirmed Run

- Account:
- Submission:
- Policy, if issued:
- Product row:
- Wizard step IDs:
- Required fields encountered:
- Data used:
- Quote action:
- Bind/issue action:
- Success text:
```
