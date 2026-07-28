# web-bridge extension (scaffold)

Load unpacked via `chrome://extensions` → Developer mode → *Load unpacked* →
select this folder. Then serve `../controller` on localhost (e.g.
`npx serve ../controller`) and open it.

Pairing: the token is shown with a **Copy** button in the extension panel and
stored in `chrome.storage.local.webBridgePairingToken`. External callers must
also be allow-listed by `externally_connectable` in the manifest.

## Status (Phase 1 — command parity)

Full bridge-protocol-v3 command parity with the Go-bridge stack: router,
external-messaging transport (pairing token), relay transport (dormant until
configured), OPFS skills port, tab commands (incl. `ensureRealTab`), CDP
core (`cdp`, `js`, `clickAtXY`, `typeText`, full `pressKey` key table,
`scroll`, `captureScreenshot`, dialogs, `uploadFile`, waits), MAIN-world
`gwClick`/`highlightElement`/`localLogin`, WebGPU LLM host proxy, and all
content-script commands (content.js copied verbatim from
`../../extension/content.js`).

Verified end-to-end (2026-07-16): Levels 1–2 of ../TESTING.md. Not yet
built: side panel UI (token/relay config currently via SW console), relay
transport untested (Level 3).
# herdr-v86 browser automation client

The manifest allow-lists `https://avirads.github.io/*` for authenticated
external messaging. In herdr, click **Connect AutoBro**, enter this extension's
ID and the pairing token shown in the panel, then use the Deep Agents UI. Herdr
uses its own page-local LiteRT-LM runtime for inference; this extension supplies
only authenticated bridge-v3 browser automation.

## Optional local VM networking

AutoBro can connect Herdr's v86 guest through the `v86net-gateway` userspace
stack. A helper must be installed once for the current user, but installation
does not require administrator/root rights, TAP/Wintun, firewall changes, or a
background system service.

On Windows, use the separate **Download Windows networking helper** link in
Herdr Settings → AutoBro. Extract the ZIP and double-click
`Install AutoBro Helper.cmd`. It copies the native host to the current user's
local application-data directory and registers it under HKCU. It does not
require administrator rights or PowerShell. The helper binary, installer, and
PowerShell scripts are not included in this extension package.

Linux:

```sh
./native/install-linux.sh ../network/v86net-gateway
```

Restart Chrome or Edge afterward. Pair AutoBro from Herdr normally; the portal
then starts local userspace networking automatically. The helper runs only
while the extension connection is open. Native Messaging is restricted to
AutoBro's pinned extension ID, and the portal connection still requires the
user's AutoBro pairing token.
