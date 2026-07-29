---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Environment Diff

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to compare two PolicyCenter instances or sessions by shell counts, menu IDs, LOB availability, fields, and actions.

## Rules

- Diff only; do not mutate data.
- Capture fresh snapshots from both instances with the same user role when possible.
- Explain differences as likely causes, not proof, unless the UI states the cause.

## Snapshot A Session

Use `policycenter-discovery-shell.md` for shell data and `policycenter-generic-form-inventory.md` for page forms.

Save these fields from each instance:

- URL host and path
- browser title
- center page title
- shell counts
- visible top tabs
- visible top-level menus
- visible and hidden menu item IDs
- LOB choices if on New Submission
- current page controls and actions

## Compare IDs


## Interpret

- Missing top tabs usually means permission, product, or module differences.
- Missing menu items under the same tab usually means role, feature flag, or custom configuration differences.
- Same label with different ID usually means version or customization drift.
- More LOB choices means new workflow skills may be needed.
- Fewer fields on the same page can mean product model, jurisdiction, or edition differences.

## Output

Report:

- high-risk differences that may break existing automation
- reusable skills that still appear valid
- skills that should be regenerated from the target instance
