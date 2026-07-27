# Guidewire PolicyCenter Login Session Health

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to verify that autobro is attached to a usable local PolicyCenter session and to recover to a stable landing page before UI automation.

## Rules

- Use the UI only.
- Keep the active Chrome tab on PolicyCenter so the user can watch.
- Use `su` / `gw` only for local development at `localhost` or `127.0.0.1`.
- Stop for non-local credentials, MFA, consent screens, or ambiguous account choices.

## Check Session


## Local Login

If the local login page appears:


If Enter does not submit, inventory visible actions and click the visible login button.

## Stable Landing Page

Prefer Desktop summary as the neutral landing page.


## Success Criteria

- `page_info()["url"]` contains `PolicyCenter.do`.
- The page title contains `Guidewire PolicyCenter`.
- No visible login form remains.
- A center title or tab bar is visible.
