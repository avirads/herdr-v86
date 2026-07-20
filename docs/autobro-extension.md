# AutoBro Web Bridge extension

Download the packaged Manifest V3 extension:

- [AutoBro Web Bridge 0.2.0](../downloads/autobro-web-bridge-0.2.0.zip)
- SHA-256: `3B257B20080C1C940FF941146CAE69DEB6A21071B981EC2433699F955B9E6042`

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

When Herdr is paired, AutoBro uses Herdr's ready page-local WebGPU LLM for chat
and automation planning. The extension hides its separate model-management
section until that Herdr provider disconnects.

The extension works in desktop Chromium-based browsers that support unpacked
Manifest V3 extensions. Mobile Chrome does not support installing this
extension.
