# Guidewire PolicyCenter Environment Diff

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to compare two PolicyCenter instances or sessions by shell counts, menu IDs, LOB availability, fields, and actions.

## Rules

- Diff only; do not mutate data.
- Capture fresh snapshots from both instances with the same user role when possible.
- Explain differences as likely causes, not proof, unless the UI states the cause.

## Snapshot A Session

Use `policycenter-discovery-shell.md` for shell data and `policycenter-generic-form-inventory.md` for page forms.

Save these fields from each instance:

- URL host and path
- browser title
- center page title
- shell counts
- visible top tabs
- visible top-level menus
- visible and hidden menu item IDs
- LOB choices if on New Submission
- current page controls and actions

## Compare IDs


## Interpret

- Missing top tabs usually means permission, product, or module differences.
- Missing menu items under the same tab usually means role, feature flag, or custom configuration differences.
- Same label with different ID usually means version or customization drift.
- More LOB choices means new workflow skills may be needed.
- Fewer fields on the same page can mean product model, jurisdiction, or edition differences.

## Output

Report:

- high-risk differences that may break existing automation
- reusable skills that still appear valid
- skills that should be regenerated from the target instance
