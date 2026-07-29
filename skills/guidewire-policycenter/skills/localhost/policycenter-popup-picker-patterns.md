---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Popup Picker Patterns

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this for PolicyCenter popups that select organizations, contacts, accounts, policies, producer codes, or other related records.

## Rules

- Open the picker through the UI.
- Search with the smallest stable criterion available.
- Extract result rows before selecting.
- Verify the original field changed after selecting a result.

## Open Picker

Use the workflow-specific picker ID when known:


If the popup appears in the same tab, inventory the page. If Chrome opens a new target, activate it:


## Search In Popup


## Select First Result


## Verify Selection

Back on the original form, read the field or display value that the picker should populate.
