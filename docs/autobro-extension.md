# AutoBro Web Bridge extension

Download the packaged Manifest V3 extension:

- [AutoBro Web Bridge 0.3.0](../downloads/autobro-web-bridge-0.3.0.zip)
- SHA-256: `ACB5C1444A875439FAC9AC7B386B79EEB22211DBDDDDEC6AEDCA841337E09AB0`

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

AutoBro uses Herdr's ready page-local WebGPU LLM for chat and automation
planning. It contains no model picker or extension-local LiteRT runtime. Keep
the paired Herdr page open and configure the model there before using AutoBro's
LLM-backed actions.

The extension works in desktop Chromium-based browsers that support unpacked
Manifest V3 extensions. Mobile Chrome does not support installing this
extension.
