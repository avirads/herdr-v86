---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Safe Search Form Submit

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to fill and submit non-mutating PolicyCenter search or filter forms.

## Rules

- Submit only search, reset, filter, and lookup forms.
- Do not click `Update`, `Save`, `Add`, `Remove`, `Bind`, `Issue`, `Cancel`, `Withdraw`, or admin edit actions.
- If validation asks for more criteria, add the smallest stable criterion and retry.

## Find Search Button


## Submit


## Read Results

Use `policycenter-table-grid-extraction.md` after search. Also read visible messages:
