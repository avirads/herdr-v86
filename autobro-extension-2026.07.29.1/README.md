# web-bridge extension (scaffold)

## Versioning

Every AutoBro source or behavior update creates a new calendar release. Public
versions and archive names use `YYYY.MM.DD.N`, where `N` starts at 1 each day
and increments for every release that day. Chrome's numeric `version` field
cannot contain leading zeroes, so `version_name` preserves the zero-padded
public version.

Load unpacked via `chrome://extensions` → Developer mode → *Load unpacked* →
select this folder. Then serve `../controller` on localhost (e.g.
`npx serve ../controller`) and open it.

Pairing is automatic after the user approves the extension prompt. The token is
stored internally in `chrome.storage.local.webBridgePairingToken` and is not
shown in the panel. External callers must also be allow-listed by
`externally_connectable` in the manifest.

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

The manifest allow-lists `https://fapstaff.com/*` for authenticated external
messaging. In Herdr on fapstaff.com, click **Connect AutoBro** and approve the
pairing request in the extension panel. Pairing is automatic; no extension ID
or token entry is normally required. Herdr uses its own page-local LiteRT-LM
runtime for inference; this extension supplies only authenticated bridge-v3
browser automation.

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

Linux helper setup is documented separately in the repository's
`network/README.md`; no native installers or binaries are shipped inside the
Chrome extension.

Restart Chrome or Edge afterward. Pair AutoBro from Herdr normally; the portal
then starts local userspace networking automatically. The helper runs only
while the extension connection is open. Native Messaging is restricted to
AutoBro's pinned extension ID, and the portal connection still requires the
user's AutoBro pairing token.

## External skill packs

Use **Skill packs → Load Skills** in the extension panel to import a ZIP. A
pack must contain one `index.json` file and a `skills/` directory. The index is
a JSON array of paths relative to `skills/`. The ZIP may contain those files at
its root or inside one top-level directory.

The Guidewire PolicyCenter pack is distributed separately as the versioned
`skills/guidewire-policycenter-1.0.0.zip`; `skills/guidewire-policycenter.zip`
is the stable alias for the current release. It is not bundled with the
extension.
The same panel lists installed skills and can load, unload, show, or run the
selected skill. Unloading is non-destructive: the skill remains stored and
viewable but is excluded from automation context. The panel does not edit or
delete individual skills.
