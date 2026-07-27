# Guidewire PolicyCenter Submission Search And Open

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to search for submissions and reopen a draft or completed submission through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not withdraw, quote, bind, or issue unless another skill explicitly covers it.
- Prefer submission number when available.

## Quick Open By Submission Number


If the input is hidden, open the Policy tab first:


## Desktop Submission Search


Inventory fields with `policycenter-generic-form-inventory.md`, submit safe searches with `policycenter-safe-search-form-submit.md`, and inspect rows with `policycenter-table-grid-extraction.md`.

Success shows the requested submission number or a job wizard page.
