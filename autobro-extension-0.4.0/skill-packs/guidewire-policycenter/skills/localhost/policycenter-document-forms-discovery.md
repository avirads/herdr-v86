# Guidewire PolicyCenter Document Forms Discovery

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to discover PolicyCenter document and form screens, generated forms, statuses, and safe download or view actions.

## Rules

- Discover and view only unless the user asks to generate or regenerate documents.
- Do not delete, regenerate, upload, or update documents without explicit user instruction.
- Downloads are allowed only when the user asks for files or inspection requires it.

## From Policy Or Job Page

Inventory visible actions:


Open only view/list pages first, then extract grids with `policycenter-table-grid-extraction.md`.

## Record

Record:

- route/action ID
- document or form name
- status
- generated date if visible
- view/download action IDs
- whether the action is safe read-only or mutating
