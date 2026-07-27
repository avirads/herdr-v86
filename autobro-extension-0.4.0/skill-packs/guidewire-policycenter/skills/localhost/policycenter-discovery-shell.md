# Guidewire PolicyCenter Discovery Shell

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for discovering the PolicyCenter app shell through the Go extension bridge before writing workflow automation.

## Rules

- Discover only. Do not create, update, bind, issue, cancel, withdraw, or delete data while using this skill.
- Keep the active Chrome tab on the PolicyCenter workflow so the user can watch.
- Treat counts as a baseline signal, not a contract. Menu counts vary by user, permissions, LOBs, locale, Guidewire version, and customer customizations.
- Prefer DOM IDs, widget classes, visible labels, and Guidewire event handlers over pixel coordinates.
- If a login page appears, use known local defaults only for local development: `su` / `gw`. Stop for any non-local password, MFA, consent, or ambiguous account choice.

## Browser Setup


If the current tab is a setup or verification tab, activate it with `switch_tab(...)` before continuing.

## Current Local Baseline

Observed on local PolicyCenter `10.0.3.1250`, user `Super User`, account summary page:

```json
{
  "menuItemWidgets": 124,
  "visibleMenuItemWidgets": 13,
  "topTabs": 7,
  "visibleTopTabs": 7,
  "wizardMenuLinks": 0,
  "visibleWizardMenuLinks": 0,
  "topLevelMenus": 13,
  "visibleTopLevelMenus": 11
}
```

Use this baseline only to notice drift. Always run a fresh discovery snapshot on the target instance.

## Discover App Shell

Run this first on a stable page such as Desktop summary, Account summary, or Search.


## Compare To Baseline

Use the comparison to decide whether an existing local skill is likely reusable.


Interpretation:

- Small count deltas with matching IDs usually mean existing skills can be adapted.
- Missing top tabs or top-level menus usually indicate permission, product, or configuration differences.
- Different IDs for the same labels usually indicate version or customization drift; rediscover the workflow before automating it.
- Extra LOB menus mean expand the LOB inventory before creating submission skills.

## Discover Forms On Current Page

After shell discovery, inventory the current page before interacting.


## Discovery Output To Record

When creating or updating a workflow skill from a discovered instance, record:

- PolicyCenter URL, title, page title, and visible user context.
- Shell counts and deltas from the local baseline.
- Visible top tabs and top-level menu IDs.
- LOB menu IDs and labels.
- Page form controls with `id`, `name`, label text, and select options.
- Action IDs for `Search`, `Next`, `Update`, `Quote`, `Bind`, and `Issue`.
- Validation messages and the page that raised them.
- Success verification text.

## Next Skills

- For safe page inventory and search/filter form submission, use `policycenter-app-navigation-forms.md`.
- For account creation, use `policycenter-account-creation.md`.
- For submission and policy issuance, use `policycenter-submission-issue.md`.
- For all-line LOB coverage, use `policycenter-all-lob-submissions.md`.
