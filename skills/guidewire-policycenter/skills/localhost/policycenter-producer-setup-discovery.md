---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Producer Setup Discovery

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to discover producer organizations, producer codes, statuses, and availability through the PolicyCenter UI.

## Rules

- Search and inspect only.
- Do not create, edit, activate, deactivate, or delete producer setup unless the user explicitly asks.
- Prefer producer code search over name-only search.

## Known Local Producer

The local test setup that has worked:

- Organization: `Codex Test Agency 236200`
- Producer code: `BH236200`

## Open Producer Code Search


If the search tab menu is hidden, open `TabBar-SearchTab` first.

## Search


## Extract Results

Use `policycenter-table-grid-extraction.md` to read result rows. Record:

- producer code
- organization
- status
- branch code if visible
- row action IDs

## Verify For Account Creation

On Create Account, after selecting an organization, verify:
