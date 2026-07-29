---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Discovery Shell

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this for discovering the PolicyCenter app shell through AutoBro Web Bridge before writing workflow automation.

## Rules

- Discover only. Do not create, update, bind, issue, cancel, withdraw, or delete data while using this skill.
- Keep the active Chrome tab on the PolicyCenter workflow so the user can watch.
- Treat counts as a baseline signal, not a contract. Menu counts vary by user, permissions, LOBs, locale, Guidewire version, and customer customizations.
- Prefer DOM IDs, widget classes, visible labels, and Guidewire event handlers over pixel coordinates.
- If a login page appears, use known local defaults only for local development: `su` / `gw`. Stop for any non-local password, MFA, consent, or ambiguous account choice.

## Browser Setup


If the current tab is a setup or verification tab, select it in the browser or use `bridge switchTab <tabId>` before continuing.

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
