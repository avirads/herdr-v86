# Guidewire PolicyCenter Instance Feature Discovery Automation

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to rerun read-only PolicyCenter UI feature discovery on another PolicyCenter instance when the user provides a URL, username, and password.

## Scope

This skill discovers the UI feature surface. It does not create accounts, create submissions, quote, bind, issue, update, cancel, withdraw, import, export, delete, or change admin data.

## Inputs

Use caller-provided values:


Prefer passing credentials through environment variables or the current secure prompt context. Do not save passwords in skill files, reports, logs, or screenshots.

## Automation Plan

1. Open the supplied PolicyCenter URL in the active browser and activate that tab.
2. Detect whether the user is already logged in.
3. If a login form appears, fill the supplied username and password and submit through the UI.
4. Verify the session by checking the title, URL, top tab bar, and center page title.
5. Capture the app shell:
   - top tabs
   - top-level menus
   - all `MenuItemWidget` IDs and labels
   - visible actions
   - shell counts
6. Classify features by route prefix:
   - Desktop
   - Account
   - Policy
   - Contact
   - Search
   - Team
   - Administration
   - Account file / job file / policy file local actions
   - Settings, regional format, and utility menus
7. Classify actions as read/search, create, update, transaction, document, admin, import/export, or destructive.
8. Inventory the current page's forms, grids, messages, and actions.
9. Optionally expand visible top-level menus to refresh menu visibility, but do not click child workflow items.
10. Return a JSON discovery report that can be compared against the local baseline or used to create workflow-specific skills.

## Browser Helpers

```powershell
& $env:BH_CLIENT goto $env:PC_URL
& $env:BH_CLIENT loginStatus
& $env:BH_CLIENT inventoryCurrentPage
& $env:BH_CLIENT extractGrids
& $env:BH_CLIENT extractMessages
& $env:BH_CLIENT visibleActions '["Desktop|Account|Policy|Search|Administration",240]'
```

## Open And Login


Stop if MFA, consent, password reset, or an ambiguous account chooser appears.

## Run Feature Discovery


## Optional Menu Refresh

If the shell report looks incomplete, expand top-level menus one at a time and rerun discovery. Expand only the top-level menu, not its child actions.


## Output Interpretation

Use the report to create an automation plan:

- `read-or-search`: safe candidates for broad automation.
- `document`: safe only for view/download workflows unless upload/generate is requested.
- `create-or-update`: requires a workflow-specific mutating skill.
- `transaction`: requires explicit business intent and a controlled workflow skill.
- `admin-import-export`: inspect only unless the user explicitly asks.
- `destructive-or-close`: never automate without exact target identifiers and explicit confirmation.

## Current Local Baseline

On the local PolicyCenter account summary page, discovery found:

- 7 visible primary tabs: Desktop, Account, Policy, Contact, Search, Team, Administration.
- 13 top-level menus, 11 visible.
- 124 total menu items, 13 visible on the current account page.
- Feature groups present: Desktop, Account, Policy, Contact, Search, Administration, AccountFile, settings/regional items.
- Account file features include account summary, contacts, locations, participants, policy transactions, submission manager, underwriting files, related accounts, documents, notes, claims, billing, history, create actions, document actions, email, new submission, activities, and request actions.

## Related Skills

- Use `policycenter-discovery-shell.md` for baseline shell discovery.
- Use `policycenter-navigation-map-builder.md` for menu mapping.
- Use `policycenter-generic-form-inventory.md` for current-page controls.
- Use `policycenter-table-grid-extraction.md` for list views.
- Use `policycenter-environment-diff.md` to compare two instance reports.
