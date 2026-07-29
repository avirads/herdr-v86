---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Submission Issue

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this for creating and issuing a Personal Auto submission through AutoBro Web Bridge.

## Rules

- Use the PolicyCenter UI only.
- Do not use SOAP, REST, database writes, or backend APIs.
- Keep the active Chrome tab on the PolicyCenter workflow so the user can watch.
- Prefer an existing UI-created account with producer `Codex Test Agency 236200` and producer code `BH236200`.

## Defaults

- Login: `su` / `gw`.
- Product: Personal Auto.
- Base state: California.
- Quote type: Quick Quote first, then convert to Full App before issue.
- Offering: Basic Program.
- Driver:
  - Date of Birth: `01/01/1990`
  - Marital Status: `S`
  - Year First Licensed: `2008`
  - License Number: `D1234567`
  - License State: `CA`
  - Policy/account accidents: `0`
  - Policy/account violations: `0`
- Vehicle:
  - Year: `2024`
  - Make: `Toyota`
  - Model: `Camry`
  - VIN: generate or use a valid-looking 17-character VIN such as `4T1G11AKXRU123456`
  - Cost New: `30000`
  - Body Type: `fourdoor`
  - Color: `Blue`
  - License Plate: generate a short value such as `TEST236`
  - License State: `CA`
  - Annual Mileage: `12000`
  - Commuting Miles: `10`
  - Primary Use: `commuting`
  - Assign the primary driver at `100%`

## Go Bridge Commands

```powershell
bridge gwClick 'Some-Guidewire-Widget-ID'
bridge waitNetworkIdle 20 500
bridge setSelect 'FIELD_NAME' 'value'
bridge inventoryCurrentPage
bridge extractMessages
```

## Start From Account

Use an account summary page with a usable producer code. If no account exists, use the local `policycenter-account-creation.md` skill first.

From the account summary page:


On Product Offers:


If the Personal Auto row index differs, inspect visible IDs containing `ProductSelectionLV` and click the row whose text is `Personal Auto`.

## Quick Quote

On Quick Quote Information, add the account holder as Driver 1:


Fill Driver 1:


Add Vehicle 1 if it is not expanded:


Fill Vehicle 1 and assign the primary driver:


Quote the quick application:


Expected result: Quote page with status `Submission (Quoted)`.

## Convert To Full App

On the quick quote page:


On Offerings:


On Qualification:


## Full App Required Fields

If Quote reports these blockers, fill them on the Drivers and Vehicles pages:

- `Missing required field "VIN"`
- `License number and license state are required for all drivers.`
- `Roles tab: Not all Account Level Number of Violations & Accidents are set for all drivers.`

Drivers page:


Vehicles page:


Quote full app:


Expected result: Quote page with `Bind Options`.

## Issue Policy

Open Bind Options and issue:


If `page_info()` reports a confirm dialog:


## Verify Success


Success shows:

- Title: `Submission Bound`
- Body: `Your Submission (#...) has been bound.`
- Info bar includes `Policy: <policy number>`
- No visible error messages

## Troubleshooting

- If a click does nothing, use `gwClick` with an exact ID from
  `inventoryCurrentPage`.
- If the page enters `Under UW Review`, continue; `Bind Options` can still appear after full app quote.
- If `BindAndIssue` opens a JavaScript confirm dialog, `js(...)` will time out until the dialog is accepted with `Page.handleJavaScriptDialog`.
- If a product row index changes, inspect visible IDs/text and click the row labeled `Personal Auto`.
- If validation reports fields on another page, navigate through the left wizard IDs and fill only the named blockers.
