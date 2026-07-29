---
skill_pack: guidewire-policycenter
skill_pack_version: 1.0.0
runtime: autobro-web-bridge
runtime_min_version: 0.4.0
---

# Guidewire PolicyCenter Login Session Health

> Runtime: AutoBro Web Bridge 0.4.0 or newer with Guidewire PolicyCenter skill pack 1.0.0. Import the ZIP from **Skill packs → Load Skills**, keep the PolicyCenter tab selected, and use the panel Automation prompt. Examples written as `bridge COMMAND ARGS...` describe bridge operations; they are not local shell commands. Use Command console JSON only for low-level diagnostics.

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
