# VM — 32-bit Linux in the browser

A self-contained 32-bit Linux VM running in a browser with local AI, browser
automation, file transfer, and optional full IPv4 networking.

AutoBro browser automation extension: see
[installation and download instructions](docs/autobro-extension.md).

On load, the UI completes VM boot behind a two-step setup wizard: configure the
page-local WebGPU LLM, then pair AutoBro. The guest shell is revealed only after
both providers report ready, or immediately when **Skip setup and open shell**
is selected. The skip choice is remembered in that browser. Cached model and
current-tab pairing state are detected automatically.

Use **Settings** in the header to reset either provider. **Reset LLM** unloads
the model and deletes its browser-cached model files; **Reset AutoBro** closes
the provider connection and forgets the saved extension ID and pairing token.
Either action hides the shell and returns to the corresponding wizard step.
After skipping, use **Settings → Configure providers** to configure the model or
AutoBro independently without repeating the other provider's setup.

- `bzImage-network` + `vm-network-ext4.img` — default network-enabled demo
  kernel and Alpine shell guest with DHCP, CA certificates, full HTTPS curl,
  browser-bridge tools, tmux 3.5a, and Zellij 0.44.3.
- `network/` — authenticated WebSocket-to-TAP gateway, v86 adapter, guest build
  recipes, and automated DHCP/DNS/ping/HTTPS test.

Boot args (disk image route): `root=/dev/sda rw console=ttyS0`
Needs an i686 kernel with 8250 serial + ext4 (or 9p/virtio for the tarball route).

The default `index.html` uses the network-enabled artifacts and accepts a
short-lived gateway session in its URL fragment. See [network/README.md](network/README.md).

The demo also includes a gateway-free browser bridge. Its `vmfetch`, `vmclip`,
`vmexport`, `vmgithub`, `vmai`, and `vmllm` guest commands use browser APIs instead of a
NIC. The toolbar provides file import. See
[the guest-tools command reference](docs/guest-tools.md). Coding agents should
start with [AGENTS.md](AGENTS.md); web-based agents can discover the documentation
index through [llms.txt](llms.txt).

The guest `vmagent` command provides a full Deep Agents coding assistant
backed by the page-local LiteRT-LM WebGPU model. **Configure LLM** imports a
compatible model into browser OPFS; no extension is required. The agent has
framework-native planning, filesystem, shell, project-memory, skills, context
management, and subagent tools. Mutations and every command require explicit
browser approval. Typed browser-bridge tools cover `vmfetch`, `vmgithub`,
`vmclip`, `vmexport`, `vmai`, and LiteRT status/model discovery. See
[the Deep Agents guide](docs/deep-agent.md).
The session-only `vmagent yolo on|off` control can waive individual approvals;
it is on by default and returns to on after reload or `vmagent reset`. Run
`vmagent yolo off` before a task to require confirmation for each operation.
Optional **Connect AutoBro** pairing gives the agent authenticated bridge-v3
browser automation for tabs, navigation, DOM/form interaction, CDP input,
waits, dialogs, JavaScript, uploads, and domain commands. It remains separate
from the built-in page-local LiteRT inference provider. The agent automatically
switches between equivalent AutoBro and `vm*` operations when the primary
provider fails.

### Local voice input

The header's **Voice** control uses the bundled MoonshineJS Tiny English model
to transcribe the device microphone locally in the parent browser. Audio and
transcripts are not sent to the VM, gateway, or a cloud transcription service.
Choose **Settings → Local voice input → After transcription** to either insert
recognized text at the active shell/`vmagent>` prompt or execute each completed
utterance as a command. Execute mode stops listening after one utterance to
avoid duplicate command submission.

The first use downloads about 42 MiB of version-pinned runtime/model assets from
this same site and asks for microphone permission. Later loads can use the
browser cache. Voice input requires HTTPS (localhost is allowed), WebAssembly,
Web Audio, and microphone access. **Reset voice** stops capture, clears known
Moonshine/ONNX browser caches, and reloads the page. MoonshineJS and its English
model are MIT-licensed; the bundled license is in
[`vendor/moonshine/LICENSE`](vendor/moonshine/LICENSE).

### Remote LLM chat over WebRTC

A phone can chat directly with the WebGPU LLM loaded by a desktop VM page:

1. Once the desktop VM shell is available, open **Settings → Remote access** and select **Host this LLM**. Hosting and pairing can start before a model is loaded; configure a model before sending the first chat message.
2. Copy the generated session pairing key.
3. On the phone, open [`remote.html`](remote.html) directly or select **Connect to a desktop LLM instead** during startup, paste the key, and connect.
4. Use the Remote LLM chat form. Requests go directly to the desktop model and do not invoke `vmagent` or DeepAgentsJS.

The mobile-only page does not load v86, a VM disk, xterm, LiteRT-LM, or a model. The static page uses PeerJS Cloud for WebRTC signaling, and generated text is streamed to the phone as LiteRT-LM produces it. Prompts and response chunks travel through the encrypted WebRTC data channel. The desktop page and model must remain open, one phone is accepted per hosted session, and restrictive networks may require a separately configured TURN relay. Treat the pairing key as a session secret.

## Hosting

The disk image is loaded with `async: true`, so the web server **must support
HTTP Range requests** (206). GitHub Pages, nginx, caddy, and `npx http-server`
work; `python -m http.server` does not (returns 200/full-body, v86 aborts the
read, and the guest kernel spirals into ATA timeouts before dropping to PIO).

The demo checks Range delivery before starting. If the check fails, it downloads
the complete 96 MiB disk before startup and adds `libata.force=pio4` to avoid
virtual ATA DMA interrupt failures.
Compatibility mode uses more browser memory and starts more slowly, but is the
recommended fallback for machines showing `READ DMA`, `lost interrupt`, or
`I/O error, dev sda` during boot. If those errors are detected in normal mode,
the page automatically restarts once in compatibility mode. Operators can
still force this internal mode with `?compat=1` for diagnostics.
