# Guidewire PolicyCenter Navigation Map Builder

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to safely expand top-level PolicyCenter menus and record menu IDs, labels, and visible routes for a target instance.

## Rules

- Discover navigation only.
- Do not click menu items whose label implies a create, update, import, export, bind, issue, cancel, or delete operation unless the user explicitly asks.
- Use `policycenter-discovery-shell.md` first when comparing another instance.

## Extract Current Navigation


## Expand A Top-Level Menu


## Record

For each menu, record:

- top-level tab/menu ID
- visible label
- child menu IDs
- safe search/view routes
- mutating routes to avoid unless requested

Save new workflow-specific skills only after a route has been verified.
