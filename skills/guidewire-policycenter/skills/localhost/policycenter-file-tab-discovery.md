---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Account & Policy File-Tab Discovery (Extension + Bridge)

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this to capture the inventory of every Account File (and, when a bound
policy exists, every Policy File) left-nav tab — controls, tables, actions, and
messages per tab. This maps the post-search record surface that the
shell/menu discovery skills don't reach.

## Rules

- Read-only. Opens an existing account and clicks its file tabs; no create,
  edit, or transaction actions.
- Needs a test account number (`ACCOUNT_NUMBER`, default `4732919370`).

## Run

```powershell
bridge gotoUrl <PC_URL>
bridge gwClick 'TabBar-AccountTab'
bridge fillInput 'input[name="TabBar-AccountTab-AccountTab_AccountNumberSearchItem"]' <ACCOUNT_NUMBER>
bridge gwClick 'TabBar-AccountTab-AccountTab_AccountNumberSearchItem_Button'
bridge waitNetworkIdle 20 500
bridge relatedActions '["AccountFile-MenuLinks",100]'
```

For each returned `AccountFile-MenuLinks-*` ID, call `gwClick`, wait for
network idle, and capture `inventoryCurrentPage`. Repeat for
`PolicyFile-MenuLinks-*` after opening a bound policy. Aggregate the returned
JSON in the agent output path; no separate discovery runtime is required.

## How it works

1. Open the account (quick account-number search).
2. Enumerate `AccountFile-MenuLinks-*` menu items (the left-nav file tabs) and
   click each, capturing per-tab inventory.
3. Look for a bound policy in Policy Transactions (a Policy # data cell, not the
   column header). If found, open it and walk `PolicyFile-MenuLinks-*` tabs the
   same way.

## Account File tabs (observed on 10.0.3.1250)

Summary, Contacts, Locations, Participants, Policy Transactions, Submission
Manager, Underwriting Files, Related Accounts, Documents, Notes, Claims,
Billing, History (13 tabs). Tab IDs follow
`AccountFile-MenuLinks-AccountFile_AccountFile_<Name>` (e.g. `_Summary`,
`_Contacts`, `_Locations`, `_Roles`=Participants, `_WorkOrders`=Policy
Transactions, `_History`), plus `AccountFile-MenuLinks-AccountFile_SubmissionManager`
and `_UnderwritingFiles`.

## Policy File limit

PolicyFile tabs are only capturable when the account has a **bound policy**. An
account whose transactions are all draft/withdrawn submissions has no policy to
open. Record `"no bound policy on this account"` and skip it. To
capture PolicyFile tabs you must first bind/issue a policy (full submission +
payment flow), which is out of scope for read-only baselining.

## Output shape

```json
{
  "accountFile": [{ "tabId", "tabText", "pageTitle", "controls": [], "tables": [], "actions": [], "messages": [] }],
  "policyFile": { "opened": null, "note": "no bound policy..." }
}
```

## Related Skills

- `policycenter-account-search-and-open.md` — opening accounts.
- `policycenter-instance-id-typelist-discovery.md` — shell/menu/typelist surface.
- `policycenter-instance-diff-harness.md` — cross-instance diff.
- `policycenter-table-grid-extraction.md` — deeper grid extraction within a tab.
