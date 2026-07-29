---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Activity Creation And Completion

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

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
