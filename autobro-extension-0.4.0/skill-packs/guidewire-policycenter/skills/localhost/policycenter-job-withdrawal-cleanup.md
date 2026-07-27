# Guidewire PolicyCenter Job Withdrawal Cleanup

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to find automation-created test submissions or jobs and withdraw them through the PolicyCenter UI.

## Rules

- Withdraw only test jobs created by the current automation session or clearly identified by the user.
- Do not withdraw production, unknown, or ambiguous jobs.
- Confirm identifiers before cleanup when multiple jobs match.

## Find Job

Use `policycenter-submission-search-and-open.md` with the exact submission number when available.

If searching by account, use Desktop Submissions or account job lists and extract rows with `policycenter-table-grid-extraction.md`.

## Withdraw

Inventory visible actions containing `Withdraw`, `Cancel`, or `Close`.


Click the exact withdraw action only after verifying the submission number on the page.

Handle confirmation dialogs intentionally:


## Success Criteria

Success shows the job status as withdrawn, closed, canceled, or no longer active. Record the submission number and final status.
