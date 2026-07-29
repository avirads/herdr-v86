---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Document Forms Discovery

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to discover PolicyCenter document and form screens, generated forms, statuses, and safe download or view actions.

## Rules

- Discover and view only unless the user asks to generate or regenerate documents.
- Do not delete, regenerate, upload, or update documents without explicit user instruction.
- Downloads are allowed only when the user asks for files or inspection requires it.

## From Policy Or Job Page

Inventory visible actions:


Open only view/list pages first, then extract grids with `policycenter-table-grid-extraction.md`.

## Record

Record:

- route/action ID
- document or form name
- status
- generated date if visible
- view/download action IDs
- whether the action is safe read-only or mutating
