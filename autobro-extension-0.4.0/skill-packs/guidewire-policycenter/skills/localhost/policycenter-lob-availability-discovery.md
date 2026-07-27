# Guidewire PolicyCenter LOB Availability Discovery

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to discover which lines of business are available for a PolicyCenter account, state, effective date, and producer code.

## Rules

- Discover availability only unless the user asks to create a submission.
- Stop before quoting, binding, or issuing.
- Prefer an existing test account.

## Start From Account

Open a known account summary page, then open New Submission through the UI.


If the account picker appears, use `policycenter-account-search-and-open.md` or the account number quick search.

## Extract LOB Choices


## Record

For each available LOB, record:

- label and product code if visible
- button, radio, checkbox, or select ID/name
- account state and producer code context
- first required page reached after selecting it
- whether quote/bind/issue was intentionally skipped

Use `policycenter-all-lob-submissions.md` only when the user explicitly asks for broader LOB workflows.
