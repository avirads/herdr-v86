# Guidewire PolicyCenter Generic Form Inventory

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to inspect visible fields, labels, select options, actions, messages, and required-looking controls before filling any PolicyCenter form.

## Rules

- Inventory first, fill second.
- Do not submit mutating actions during inventory.
- Treat HTML `required` as unreliable; Guidewire commonly exposes required fields through labels, styles, and validation messages.

## Inventory Current Page


## Fill Pattern

Use the Go client `fillInput` command for text inputs and `setSelect` for selects.


## Record For New Skills

When creating a workflow skill, save:

- page title and route context
- field `name` and `id`
- label text
- select values used
- submit action ID
- validation messages encountered
- success verification text
