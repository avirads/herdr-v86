---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Generic Form Inventory

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to inspect visible fields, labels, select options, actions, messages, and required-looking controls before filling any PolicyCenter form.

## Rules

- Inventory first, fill second.
- Do not submit mutating actions during inventory.
- Treat HTML `required` as unreliable; Guidewire commonly exposes required fields through labels, styles, and validation messages.

## Inventory Current Page


## Fill Pattern

Use the Go client `fillInput` command for text inputs and `setSelect` for selects.


## Record For New Skills

When creating a workflow skill, save:

- page title and route context
- field `name` and `id`
- label text
- select values used
- submit action ID
- validation messages encountered
- success verification text
