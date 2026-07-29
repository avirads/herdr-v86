---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Instance ID & Typelist Discovery (Extension + Bridge)

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to capture a PolicyCenter instance's stable element IDs, full typelist
contents, and per-LOB submission-wizard step IDs through the Chrome extension
and Go bridge. The JSON output is the
input for cross-instance diffing (`policycenter-environment-diff.md`) — re-run
it against any deployment instead of hardcoding IDs, which drift across versions
and customizations.

## Why discover instead of hardcode

A static ID/typelist list goes stale the moment you point at a different PC
version or a customized client build. Discovery regenerates ground truth per
instance. Example proven on `10.0.3.1250`: a hardcoded role list captured the
first 20 of 25 roles; live discovery surfaced the 5 missing ones
(Underwriting Supervisor, Underwriter, Underwriter Assistant, User Admin,
Tools View). Always discover; never trust a frozen list.

## Rules

- Read-only phase mutates nothing. The `--mutating` phase creates one draft
  submission per LOB and withdraws each — run it only where test data is
  acceptable, never on production without approval.
- Every draft created is withdrawn; a final orphan sweep cleans any left behind.
- Stay on the PolicyCenter tab — see tab-locking below.

## Prerequisites

- AutoBro panel open and Status reporting bridge protocol v3.
- If using Herdr, pairing is connected and the page-local LLM is ready.
- Log in with `PC_USERNAME` and `PC_PASSWORD` through `fillInput`; never embed
  credentials in this skill.

## Run

```powershell
bridge gotoUrl <PC_URL>
bridge pageInfo
bridge inventoryCurrentPage
bridge extractGrids
bridge relatedActions '["Desktop|Account|Policy|Search|Administration|Next|Withdraw",240]'
```

For each approved anchor screen, capture `inventoryCurrentPage`. Record every
select control and option returned by the inventory. For the mutating phase,
walk each LOB with exact `gwClick` IDs, capture each wizard step, withdraw the
draft, and handle native confirmation with `pendingDialog`/`acceptDialog`.
Write the aggregated JSON to `PC_IDS_OUTPUT`.

Output shape (diffable):

```json
{
  "pcVersion": "[DEV mode - 10.0.3.1250] Guidewire PolicyCenter (Super User)",
  "readOnly": { "<screen>": { "controls": [], "selects": [{ "name", "optionCount", "options" }], "stableIds": [] } },
  "mutating": {
    "lobChooser": { "productCount": 9, "products": [], "chooserSelects": [] },
    "wizards": [{ "lob", "wizard": { "wizardSteps": [] }, "withdraw": { "withdrew": true } }],
    "orphanSweep": []
  }
}
```

## Critical techniques (why naive automation fails)

These three are mandatory; without them the workflow hangs or corrupts state.

### 1. Native dialogs freeze the page — handle via CDP

`window.confirm/alert/prompt` freeze the page JS event loop, so every `js`
(Runtime.evaluate) and content-script command hangs until dismissed (bridge
times out at 30s). Guidewire raises `confirm()` on Withdraw and similar. Fire
the click WITHOUT awaiting, drain the dialog concurrently via CDP-level
`pendingDialog`/`acceptDialog` (which work while the page is frozen), then await:

```ts
async function gwClickHandlingDialog(id, drainMs = 8000) {
  const clickPromise = bridge('gwClick', [id]).catch(() => null); // hangs on confirm()
  const deadline = Date.now() + drainMs;
  while (Date.now() < deadline) {
    await sleep(400);
    const pending = await bridge('pendingDialog').catch(() => null);
    if (pending) { await bridge('acceptDialog', [true]).catch(() => null); break; }
  }
  await clickPromise.catch(() => null);
}
```

### 2. Lock onto the PolicyCenter tab

Bridge commands target whatever tab Chrome considers active. If the user clicks
another tab (e.g. Citrix), commands silently hit the wrong DOM and return empty
inventories. Resolve the PC tab once and pass `tabId` on every command:

```ts
const tabs = await bridge('listTabs', [false]);
const pcTabId = tabs.find(t => /\/pc\/PolicyCenter/i.test(t.url || '')).tabId;
// then: bridge('pageInfo', [], { tabId: pcTabId })
```

### 3. Navigate to canonical subtabs, not bare tabs

A bare `TabBar-{X}Tab` click lands on the last-visited subpage, not a
deterministic landing. Use full subtab IDs, e.g.
`TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminUserSearchPage`,
`TabBar-DesktopTab-Desktop_Underwriter_MySummary`. `gwClick` fires hidden menu
items directly (e.g. `...CloseOptions-WithdrawJob`, `TabBar-LogoutTabBarLink`)
without expanding their parent dropdown.

## LOB wizard walk specifics

- New Submission (account-scoped):
  `AccountFile-AccountFileMenuActions-AccountFileMenuActions_Create-AccountFileMenuActions_NewSubmission`
  (pre-fills the account → lands on the LOB chooser). The generic
  `TabBar-PolicyTab-PolicyTab_NewSubmission` is account-unscoped — avoid it.
- The chooser is `NewSubmission-NewSubmissionScreen-ProductOffersDV-ProductSelectionLV`.
  Each product row N exposes `...ProductSelectionLV-{N}-addSubmission` ("Select")
  that enters the wizard directly. ProducerCode/QuoteType/DefaultBaseState are
  pre-populated; no extra input needed to enter the wizard.
- Some LOBs (Commercial Property, Inland Marine) auto-advance past Offerings to
  Policy Info, where WithdrawJob lives under a different screen-scoped id —
  re-read the `WithdrawJob$` id and retry the withdraw until the page shows
  "Submission Withdrawn".
- Orphan cleanup: open each `[id$="-Transaction_button"]` in the account's
  Open Policy Transactions tile and withdraw, looping until none remain.

## Related Skills

- `policycenter-environment-diff.md` — diff two instance JSON reports.
- `policycenter-instance-feature-discovery-automation.md` — feature/menu surface.
- `policycenter-job-withdrawal-cleanup.md` — manual draft cleanup.
- `policycenter-gw-click-and-wait-patterns.md` — click/settle fundamentals.
