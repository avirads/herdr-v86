---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Submission Search And Open

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to search for submissions and reopen a draft or completed submission through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not withdraw, quote, bind, or issue unless another skill explicitly covers it.
- Prefer submission number when available.

## Quick Open By Submission Number


If the input is hidden, open the Policy tab first:


## Desktop Submission Search


Inventory fields with `policycenter-generic-form-inventory.md`, submit safe searches with `policycenter-safe-search-form-submit.md`, and inspect rows with `policycenter-table-grid-extraction.md`.

Success shows the requested submission number or a job wizard page.
