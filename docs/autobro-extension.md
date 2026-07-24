# AutoBro Web Bridge extension

Download the packaged Manifest V3 extension:

- [AutoBro Web Bridge 0.4.0](../downloads/autobro-web-bridge-0.4.0.zip)
- SHA-256: `FF26C4FE73423AF3E163C152B13E628C4596A76F32124B8B7FB8A8CCD12AA938`

## Install in Chrome or Chromium

1. Download and extract the ZIP file. Chrome cannot load the ZIP directly.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted directory that contains `manifest.json`.
6. Open the [VM](https://avirads.github.io/herdr-v86/), select
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

### Upgrading from 0.3.0

0.3.0 was loaded unpacked without a pinned ID, so its extension ID varies per
install path. Reload the unpacked extension from the 0.4.0 ZIP (same Load
unpacked steps, pointed at the new directory) to pick up the fixed ID and the
one-click pairing flow; the page will no longer recognize the old ID.

AutoBro uses VM's ready page-local WebGPU LLM for chat and automation
planning. It contains no model picker or extension-local LiteRT runtime. Keep
the paired VM page open and configure the model there before using AutoBro's
LLM-backed actions.

The extension works in desktop Chromium-based browsers that support unpacked
Manifest V3 extensions. Mobile Chrome does not support installing this
extension.
