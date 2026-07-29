---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter LOB Availability Discovery

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

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
