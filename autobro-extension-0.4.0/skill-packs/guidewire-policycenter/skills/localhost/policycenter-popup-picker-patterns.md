# Guidewire PolicyCenter Popup Picker Patterns

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for PolicyCenter popups that select organizations, contacts, accounts, policies, producer codes, or other related records.

## Rules

- Open the picker through the UI.
- Search with the smallest stable criterion available.
- Extract result rows before selecting.
- Verify the original field changed after selecting a result.

## Open Picker

Use the workflow-specific picker ID when known:


If the popup appears in the same tab, inventory the page. If Chrome opens a new target, activate it:


## Search In Popup


## Select First Result


## Verify Selection

Back on the original form, read the field or display value that the picker should populate.

