# Guidewire PolicyCenter Admin User Search

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

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
