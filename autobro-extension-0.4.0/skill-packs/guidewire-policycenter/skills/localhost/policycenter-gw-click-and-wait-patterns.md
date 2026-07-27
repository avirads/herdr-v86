# Guidewire PolicyCenter Click And Wait Patterns

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for reliable Guidewire UI clicks, menu actions, dialogs, popups, and post-action waits through the Go extension bridge.

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
& $env:BH_CLIENT attach
```

Attach state is lost when the debugger detaches (extension reload, the user
dismissing the debugging banner, `detach`). If `waitNetworkIdle` returns
suspiciously fast with a very large `quietFor`, re-attach and prefer
`waitForElement` on expected content as the gate.

## Guidewire Click

Use the exact visible action ID:

```powershell
& $env:BH_CLIENT gwClick 'Some-Guidewire-Widget-ID'
```

## Click And Wait

```powershell
& $env:BH_CLIENT gwClick 'Some-Guidewire-Widget-ID'
& $env:BH_CLIENT waitNetworkIdle 20 500
```

If a JavaScript dialog appears:

```powershell
& $env:BH_CLIENT pendingDialog
& $env:BH_CLIENT acceptDialog true
& $env:BH_CLIENT waitNetworkIdle 15 500
```

## Find Visible Actions

```powershell
& $env:BH_CLIENT visibleActions '["Search|Reset|Update|Save|Next|Quote|Bind|Issue",240]'
```

## Verification

After any click:

```powershell
& $env:BH_CLIENT pageInfo
```
