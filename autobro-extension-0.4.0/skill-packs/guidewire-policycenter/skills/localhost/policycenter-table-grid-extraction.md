# Guidewire PolicyCenter Table Grid Extraction

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to extract Guidewire list views, table rows, headers, pagination controls, and row action IDs from PolicyCenter pages.

## Rules

- Extract rows before selecting one.
- Prefer row action IDs such as `_Select`, `_View`, `_Edit`, or row menu IDs over coordinate clicks.
- Do not perform row actions that mutate data unless a workflow skill explicitly calls for it.

## Extract Visible Grids


## Select A Row

After extracting rows, choose the row by matching visible text and fire its `_Select` action.


Set `target_text` to a unique value from the row before running.
