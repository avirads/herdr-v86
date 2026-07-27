# Guidewire PolicyCenter Account Search And Open

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to search for accounts and open the correct account through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not edit account details unless another skill explicitly covers the workflow.
- Prefer account number when available.

## Quick Open By Account Number


If the input is hidden, open the Account tab first:


## Account Search Page


Fill the smallest available criteria:

- account number
- last name
- first name
- city
- postal code

Then use `policycenter-safe-search-form-submit.md`.

## Select Result

Use `policycenter-table-grid-extraction.md`, then select the row whose account number or name matches the target.

Success shows `Account Summary:` in `#gw-center-title-toolbar`.
