# Guidewire PolicyCenter Policy Search And Open

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to search for policies and open a target policy through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not start transactions, cancel, rewrite, renew, bind, or issue unless another skill explicitly covers it.
- Prefer policy number when available.

## Quick Open By Policy Number


If the input is hidden, open the Policy tab first:


## Policy Search Page


Useful fields usually include:

- policy number
- account number
- first name
- last name

Submit with `policycenter-safe-search-form-submit.md` and inspect rows with `policycenter-table-grid-extraction.md`.

Success shows a policy summary or policy file page with the requested policy number.
