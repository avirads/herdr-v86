---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Navigation Map Builder

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to safely expand top-level PolicyCenter menus and record menu IDs, labels, and visible routes for a target instance.

## Rules

- Discover navigation only.
- Do not click menu items whose label implies a create, update, import, export, bind, issue, cancel, or delete operation unless the user explicitly asks.
- Use `policycenter-discovery-shell.md` first when comparing another instance.

## Extract Current Navigation


## Expand A Top-Level Menu


## Record

For each menu, record:

- top-level tab/menu ID
- visible label
- child menu IDs
- safe search/view routes
- mutating routes to avoid unless requested

Save new workflow-specific skills only after a route has been verified.
