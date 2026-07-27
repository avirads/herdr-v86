# Guidewire PolicyCenter Activity Creation And Completion

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to create, search, assign, and complete PolicyCenter activities through the UI.

## Rules

- Use only when the user asks to create or complete an activity.
- Prefer test accounts, test policies, or test submissions.
- Do not change unrelated activities.

## Create Activity

From an account, policy, or job page, inventory actions containing `Activity`, `New`, or `Assign`.


Fill subject, priority, due date, assignee, and description according to the user's request or local test defaults. Submit only after inventorying validation messages.

## Search And Complete

Use Desktop Activities or Activity Search. Extract rows with `policycenter-table-grid-extraction.md`, open the exact target activity, then complete it only if the user requested completion.

## Success Criteria

Record activity number or subject, final status, assignee, and visible success message.
