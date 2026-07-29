---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Admin User Search

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to search and inspect PolicyCenter Administration users, groups, roles, regions, organizations, and producer codes without modifying admin data.

## Rules

- Search and inspect only.
- Do not create, edit, deactivate, delete, assign roles, or change permissions.
- Use Administration pages only when the current user has access.

## Common Admin Routes

- Users: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminUserSearchPage`
- Groups: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminGroupSearchPage`
- Roles: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_Roles`
- Regions: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_Regions`
- Organizations: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_OrganizationSearchPage`
- Producer Codes: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminProducerCodeSearch`

## Search


Inventory fields with `policycenter-generic-form-inventory.md`, fill only search criteria, submit with `policycenter-safe-search-form-submit.md`, and extract rows with `policycenter-table-grid-extraction.md`.

## Stop Conditions

Stop before clicking actions named `New`, `Edit`, `Update`, `Delete`, `Remove`, `Deactivate`, `Add`, or `Assign`.
