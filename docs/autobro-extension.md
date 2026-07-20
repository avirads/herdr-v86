# AutoBro Web Bridge extension

Download the packaged Manifest V3 extension:

- [AutoBro Web Bridge 0.1.0](../downloads/autobro-web-bridge-0.1.0.zip)
- SHA-256: `F9596D0FE81B585DB685F7E1A341E93823B84A417A989A9D4EA15814D952734E`

## Install in Chrome or Chromium

1. Download and extract the ZIP file. Chrome cannot load the ZIP directly.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted directory that contains `manifest.json`.
6. Pin or open **AutoBro Web Bridge**, then copy the extension ID from
   `chrome://extensions` and the pairing token from the extension panel.
7. Open [Herdr VM](https://avirads.github.io/herdr-v86/), select
   **Connect AutoBro**, and enter the extension ID and pairing token.

The extension works in desktop Chromium-based browsers that support unpacked
Manifest V3 extensions. Mobile Chrome does not support installing this
extension.
