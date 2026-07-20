# herdr-v86 — herdr on 32-bit Linux in the browser

Artifacts for running [herdr](https://herdr.dev) inside a v86 browser VM.

- `herdr-vm-ext4.img` — bootable ext4 root filesystem (Alpine 3.22.5 x86 + herdr 0.7.4,
  static i686-musl). Init mounts proc/sysfs/devpts/tmpfs and spawns shells on ttyS0 + tty1.
- `herdr-alpine-x86-rootfs.tar.gz` — same tree, for 9p setups.
- `herdr-i686` — the standalone static binary.
- `bzImage-network` + `herdr-vm-network-ext4.img` — network-enabled demo kernel
  and Alpine guest with DHCP, CA certificates, and full HTTPS curl support.
- `network/` — authenticated WebSocket-to-TAP gateway, v86 adapter, guest build
  recipes, and automated DHCP/DNS/ping/HTTPS test.
- `herdr-i686.patch` — patch against herdr v0.7.4: adds i686 targets to the
  libghostty-vt zig target map, and gates 46 bindgen layout-test blocks that
  hardcode 64-bit sizes (the only genuine 32-bit blocker).
- `build-herdr-i686.sh` — cross-compile procedure.

Boot args (disk image route): `root=/dev/sda rw console=ttyS0`
Needs an i686 kernel with 8250 serial + ext4 (or 9p/virtio for the tarball route).

The default `index.html` uses the network-enabled artifacts and accepts a
short-lived gateway session in its URL fragment. See [network/README.md](network/README.md).

The demo also includes a gateway-free browser bridge. Its `vmfetch`, `vmclip`,
`vmexport`, `vmgithub`, `vmai`, and `vmllm` guest commands use browser APIs instead of a
NIC. The toolbar provides file import and IndexedDB VM snapshots. See
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
it is off by default and resets on reload or `vmagent reset`.
Optional **Connect AutoBro** pairing gives the agent authenticated bridge-v3
browser automation for tabs, navigation, DOM/form interaction, CDP input,
waits, dialogs, JavaScript, uploads, and domain commands. It remains separate
from the built-in page-local LiteRT inference provider. The agent automatically
switches between equivalent AutoBro and `vm*` operations when the primary
provider fails.

## Hosting

The disk image is loaded with `async: true`, so the web server **must support
HTTP Range requests** (206). GitHub Pages, nginx, caddy, and `npx http-server`
work; `python -m http.server` does not (returns 200/full-body, v86 aborts the
read, and the guest kernel spirals into ATA timeouts before dropping to PIO).

The demo checks Range delivery before starting. If the check fails, or the user
selects **Compatibility boot**, it downloads the complete 96 MiB disk before
startup and adds `libata.force=pio4` to avoid virtual ATA DMA interrupt failures.
Compatibility mode uses more browser memory and starts more slowly, but is the
recommended fallback for machines showing `READ DMA`, `lost interrupt`, or
`I/O error, dev sda` during boot. If those errors are detected in normal mode,
the page automatically restarts once in compatibility mode. It is also
available manually as `?compat=1`.

## Known issues (herdr 0.7.4 i686)

- **`herdr --session <name>` fails with `lost connection to server: Connection
  reset by peer (os error 104)`.** The auto-spawned session server aborts on a
  Zig safety panic (`attempt to use null value`) in the i686 build of
  libghostty-vt as soon as a pane terminal is created; the daemon's stderr goes
  to /dev/null so the crash is silent. Full analysis, captured trace, minimal
  repro, and debugging plan: [CRASH-REPORT.md](CRASH-REPORT.md).

  Interim workaround (attach works; creating a workspace still crashes):

  ```sh
  herdr server --session work >/tmp/w.log 2>&1 &
  sleep 10
  herdr --session work
  ```

- **1x1 terminal**: the kernel serial console reports a 0x0 window size, so
  herdr renders into a 1x1 grid (blank screen). `index.html` now sends
  `stty rows 32 cols 100` at the first shell prompt automatically; if you use a
  different console or geometry, run `stty` yourself before attaching.
