# AutoBro Web Bridge extension

Download the packaged Manifest V3 extension:

- [AutoBro Web Bridge 2026.07.29.4](../downloads/autobro-web-bridge-2026.07.29.4.zip)
- SHA-256: `6466B8F969E73AB691FD59019E3318C135DB1295B91151C77370A39425D55CAD`
- [Windows networking helper with source](../downloads/autobro-helper-windows-amd64.zip)
- SHA-256: `E403CFE59EBCB65603FEEA69946C5BC6410B3C8BA8D6F20D811871C403D3DEB7`

## Install in Chrome or Chromium

1. Download and extract the ZIP file. Chrome cannot load the ZIP directly.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted directory that contains `manifest.json`.
6. Open the [VM](https://fapstaff.com/), select
   **Connect AutoBro**, then click **Connect AutoBro** and approve the
   pairing request. No copying an extension ID or pairing token is needed —
   the extension's ID is pinned (via its manifest `key`), so the page detects
   it automatically, and approving hands over a pairing token directly.

   The approval prompt tries a native browser notification first, but OS
   notification delivery has been observed to silently no-op in some
   environments (seen in a Windows/remote-desktop session — Chrome reports
   the notification as created and live, yet nothing ever renders). If no
   notification appears within a few seconds, click the extension's toolbar
   icon: a pairing request also opens the extension's own panel window
   immediately and shows an **Approve / Deny** prompt there, which doesn't
   depend on OS notification delivery at all.

The extension ID and pairing token fields are still available for manual
entry (under "Enter extension ID and pairing token manually instead") as a
fallback if browser notifications are blocked, or for advanced/scripted
setups.

After pairing succeeds, the Settings **Connect** button becomes **Open**.
Selecting it closes Settings and focuses the extension's existing panel window,
or creates the singleton panel window when it is not already open.

### Upgrading from older releases

0.3.0 was loaded unpacked without a pinned ID, so its extension ID varies per
install path. Reload the unpacked extension from the current ZIP (same Load
unpacked steps, pointed at the new directory) to pick up the fixed ID and the
one-click pairing flow; the page will no longer recognize the old ID.

AutoBro uses VM's ready page-local WebGPU LLM for chat and automation
planning. It contains no model picker or extension-local LiteRT runtime. Keep
the paired VM page open and configure the model there before using AutoBro's
LLM-backed actions.

Automation runs in a fresh tab cloned from the selected application tab. For
Guidewire workflows, AutoBro loads the installed login/session skill, reuses an
existing authenticated browser session, and permits automatic `su` / `gw`
login only on `localhost` or `127.0.0.1`. It attempts a UI logout after the
final step, including when an automation step fails.

The extension works in desktop Chromium-based browsers that support unpacked
Manifest V3 extensions. Mobile Chrome does not support installing this
extension.

The Windows networking helper is a separate ZIP and is not bundled in the
extension. Extract it and double-click `Install AutoBro Helper.cmd` to install
the Native Messaging host for the current user. The archive includes the exact
Go source used to build its binary. Installation uses HKCU and
`%LOCALAPPDATA%`, so it needs neither administrator rights nor PowerShell.
