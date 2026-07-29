---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Job Withdrawal Cleanup

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

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
