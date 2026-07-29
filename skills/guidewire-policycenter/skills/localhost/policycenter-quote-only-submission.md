---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Quote Only Submission

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

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
