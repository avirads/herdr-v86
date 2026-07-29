---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# PolicyCenter AutoBro Web Bridge Operation

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill
> pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the
> PolicyCenter tab selected, and use the panel Automation prompt. Examples
> written as `bridge COMMAND ARGS...` describe bridge operations; they are not
> local shell commands. Use Command console JSON only for low-level diagnostics.

Use this as the runtime reference for every PolicyCenter workflow. AutoBro is a
generic browser bridge; the installed skills provide PolicyCenter-specific
workflow knowledge.

## Setup and health

1. Load the unpacked or packaged AutoBro extension in Chrome or Edge.
2. Open its panel and confirm Status reports bridge protocol v3.
3. Import the versioned Guidewire ZIP using **Load Skills**.
4. Confirm the installed-skill list contains the PolicyCenter files.
5. Open the target HTTP/HTTPS PolicyCenter page and select that tab.
6. If using Herdr, pair it with the extension token and load the page-local LLM.

No Go bridge, client executable, admin executable, native helper, or local
shell installation is required for browser automation. The optional native
helper is only for VM userspace networking.

## Interaction modes

- **Automation prompt**: preferred. Describe the goal in plain language,
  develop the plan, inspect it, then execute.
- **Command console**: diagnostics and known low-level commands using
  protocol-v3 JSON.
- **Herdr agents**: when paired, use `autobro_automate` for natural-language
  tasks and `autobro_command` for a known command.

## Core operation sequence

1. Inspect with `currentTab`, `pageInfo`, and `inventoryCurrentPage`.
2. Discover exact actions with `visibleActions` or `relatedActions`.
3. Use `gwClick` for an exact Guidewire widget ID.
4. Use `gwOpenMenu` for the arrow/menu attached to an exact parent action ID.
5. Use `fillInput` and `setSelect` only with controls present in the inventory.
6. After navigation or a Guidewire action, use `waitNetworkIdle`.
7. Verify with `pageInfo`, `inventoryCurrentPage`, `extractMessages`, or
   `extractGrids`.

Compact notation used throughout this pack:

```text
bridge currentTab
bridge inventoryCurrentPage
bridge visibleActions ["Search|Reset|Desktop|Account|Policy|Administration",240]
bridge gwClick "TabBar-DesktopTab-Desktop_Underwriter_MySummary"
bridge waitNetworkIdle 15 500
bridge inventoryCurrentPage
```

Equivalent low-level JSON for one operation:

```json
{"command":"gwClick","args":["TabBar-DesktopTab-Desktop_Underwriter_MySummary"]}
```

## Login and secrets

Never store credentials in a skill. Ask the user or use values they supplied
for the current session. Stop for MFA, consent, CAPTCHA, ambiguous account
selection, or any unexpected non-local login.

Use `localLogin` only for a deliberately configured local development login.
Otherwise inventory the visible login controls, fill only supplied credentials,
submit, wait, and verify `loginStatus`.

## Safety

Treat these operations as mutating and require explicit user intent:

```text
Update Save Add Remove New Create Edit Quote Bind Issue Cancel Close Withdraw
Delete Deactivate Import Export
```

Do not invent action IDs, selectors, credentials, account or policy numbers,
product choices, dates, limits, coverages, or other business values. Prefer the
smallest reliable plan and keep the user on the intended PolicyCenter tab.

## Safe navigation IDs

These are known examples, not guarantees. Confirm visibility on the live page:

- Desktop summary: `TabBar-DesktopTab-Desktop_Underwriter_MySummary`
- Account search: `TabBar-SearchTab-Search_AccountSearch`
- Producer search: `TabBar-SearchTab-Search_ProducerCodeSearch`
- Policy search: `TabBar-SearchTab-Search_PolicySearch`
- My submissions: `TabBar-DesktopTab-Desktop_DesktopSubmissions`
- Admin user search:
  `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminUserSearchPage`
