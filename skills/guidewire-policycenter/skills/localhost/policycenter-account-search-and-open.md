---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Account Search And Open

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to search for accounts and open the correct account through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not edit account details unless another skill explicitly covers the workflow.
- Prefer account number when available.

## Quick Open By Account Number


If the input is hidden, open the Account tab first:


## Account Search Page


Fill the smallest available criteria:

- account number
- last name
- first name
- city
- postal code

Then use `policycenter-safe-search-form-submit.md`.

## Select Result

Use `policycenter-table-grid-extraction.md`, then select the row whose account number or name matches the target.

Success shows `Account Summary:` in `#gw-center-title-toolbar`.
