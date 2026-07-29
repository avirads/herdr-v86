---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Click And Wait Patterns

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

Use this for reliable Guidewire UI clicks, menu actions, dialogs, popups, and post-action waits through AutoBro Web Bridge.

## Rules

- Prefer `gwEvents.abstractOnEvent` for Guidewire widgets.
- Use coordinate clicks only when DOM event routing fails.
- After each action, wait for network idle and then inspect page state.
- Do not click mutating actions such as `Update`, `Save`, `Bind`, `Issue`, `Withdraw`, or `Cancel` unless the user requested that operation or a workflow skill covers it.

## Attach First

`waitNetworkIdle` only sees requests that start after the CDP debugger is
attached with `Network.enable`. If the first attach happens mid-sequence
(inside `waitNetworkIdle` itself), the click's XHR is already in flight and
invisible, so the wait returns "idle" immediately and `pageInfo` reads the
previous page. Attach once before any click sequence:

```powershell
bridge attach
```

Attach state is lost when the debugger detaches (extension reload, the user
dismissing the debugging banner, `detach`). If `waitNetworkIdle` returns
suspiciously fast with a very large `quietFor`, re-attach and prefer
`waitForElement` on expected content as the gate.

## Guidewire Click

Use the exact visible action ID:

```powershell
bridge gwClick 'Some-Guidewire-Widget-ID'
```

## Click And Wait

```powershell
bridge gwClick 'Some-Guidewire-Widget-ID'
bridge waitNetworkIdle 20 500
```

If a JavaScript dialog appears:

```powershell
bridge pendingDialog
bridge acceptDialog true
bridge waitNetworkIdle 15 500
```

## Find Visible Actions

```powershell
bridge visibleActions '["Search|Reset|Update|Save|Next|Quote|Bind|Issue",240]'
```

## Verification

After any click:

```powershell
bridge pageInfo
```
