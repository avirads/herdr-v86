---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Policy Search And Open

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to search for policies and open a target policy through the PolicyCenter UI.

## Rules

- Search and open only.
- Do not start transactions, cancel, rewrite, renew, bind, or issue unless another skill explicitly covers it.
- Prefer policy number when available.

## Quick Open By Policy Number


If the input is hidden, open the Policy tab first:


## Policy Search Page


Useful fields usually include:

- policy number
- account number
- first name
- last name

Submit with `policycenter-safe-search-form-submit.md` and inspect rows with `policycenter-table-grid-extraction.md`.

Success shows a policy summary or policy file page with the requested policy number.
