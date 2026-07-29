---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Table Grid Extraction

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to extract Guidewire list views, table rows, headers, pagination controls, and row action IDs from PolicyCenter pages.

## Rules

- Extract rows before selecting one.
- Prefer row action IDs such as `_Select`, `_View`, `_Edit`, or row menu IDs over coordinate clicks.
- Do not perform row actions that mutate data unless a workflow skill explicitly calls for it.

## Extract Visible Grids


## Select A Row

After extracting rows, choose the row by matching visible text and fire its `_Select` action.


Set `target_text` to a unique value from the row before running.
