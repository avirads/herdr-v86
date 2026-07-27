# Guidewire PolicyCenter LOB Submission Smoke Test

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to start each available PolicyCenter LOB submission through the UI, discover required pages, and stop before quote, bind, or issue unless explicitly requested.

## Rules

- This is a discovery smoke test, not a policy issuance workflow.
- Stop before quote/bind/issue unless the user explicitly asks to proceed.
- Withdraw or clean up draft jobs only when the user asks or `policycenter-job-withdrawal-cleanup.md` is invoked.

## Flow

1. Open a stable test account.
2. Run `policycenter-lob-availability-discovery.md`.
3. For each LOB:
   - start the submission
   - record selected LOB control ID/name
   - inventory the first wizard page
   - fill only enough required data to reach the next page if the user asked for deeper discovery
   - record blockers and validation messages
   - stop before quoting
4. Record any draft submission numbers created.

## Output

For each LOB, record:

- available/unavailable
- first page title
- required-looking fields
- next action ID
- validation messages
- draft submission number if created
- cleanup status if withdrawn later
