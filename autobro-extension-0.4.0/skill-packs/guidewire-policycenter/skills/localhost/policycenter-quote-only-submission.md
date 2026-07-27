# Guidewire PolicyCenter Quote Only Submission

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to create or reopen a PolicyCenter submission and quote it through the UI while stopping before bind or issue.

## Rules

- UI only.
- Quote only. Do not bind or issue.
- Use existing account and producer setup skills when possible.
- Record all validation messages resolved.

## Flow

1. Open or create a test account with `policycenter-account-search-and-open.md` or `policycenter-account-creation.md`.
2. Start New Submission with the Policy tab route.
3. Select the requested LOB after running `policycenter-lob-availability-discovery.md`.
4. Inventory each wizard page with `policycenter-generic-form-inventory.md`.
5. Fill required test data.
6. Click `Next` until quote is available.
7. Click `Quote` only when the user requested quote creation.
8. Stop after successful quote.

## Stop Before

Do not click:

- `Bind`
- `Issue`
- `Submit`
- payment-related actions
- cancellation or withdrawal actions unless the user asks for cleanup

## Success Criteria

Success shows a quoted premium, quote status, or a visible message indicating the quote completed. Record the submission number and quoted LOB.
