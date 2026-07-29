# Guidewire PolicyCenter Skill Pack

Version **1.0.0** for AutoBro Web Bridge **0.4.0 or newer**.

This optional pack adds Guidewire PolicyCenter workflow knowledge while keeping
the core AutoBro extension domain-neutral. It contains 37 Markdown skills.

## Install

1. Download `guidewire-policycenter-1.0.0.zip`.
2. Open the AutoBro extension panel.
3. Under **Skill packs**, select **Load Skills** and choose the ZIP.
4. Confirm that the panel reports 37 installed skills.
5. Keep the intended PolicyCenter tab active and use **Automation prompt**.

The skill manager can list, load, unload, show, and run a selected skill. An
unloaded skill remains stored and viewable but is excluded from automation
context. It does not edit or delete individual skills. Re-importing a newer ZIP
updates and loads files with matching paths as one versioned pack operation.

## Current operation

- Skills persist in the extension's OPFS store; they are not bundled into the
  extension.
- Loading any `policycenter-*.md` file enables `gwClick` and `gwOpenMenu`.
- The automation planner uses relevant installed skills plus the live page
  inventory.
- Read/navigation operations can run normally. Save, create, quote, bind,
  issue, delete, cancel, withdraw, import, and export require explicit intent.
- `gwClick` and `gwOpenMenu` require exact action IDs discovered from the live
  page. Do not invent IDs, selectors, credentials, or business values.
- After navigation or a Guidewire action, wait for network idle and verify the
  resulting page state.

Low-level diagnostics can be sent from **Command console** using protocol-v3
JSON, for example:

```json
{"command":"inventoryCurrentPage"}
```

```json
{"command":"gwClick","args":["TabBar-DesktopTab-Desktop_Underwriter_MySummary"]}
```

See `manifest.json` for machine-readable version and compatibility metadata.
