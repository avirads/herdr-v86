# VMVM image tiers

VMVM ships cumulative Alpine i386 guest images. Select an image under
**Settings → VMVM Image**; changing the selection restarts the VM. AI Tools is
the default and preserves the capabilities of the former single image.

| Tier | Guest contents |
|---|---|
| Barebones | Alpine, BusyBox, serial shell, boot support, and `/root/project` |
| Essentials | Barebones plus CA certificates, `curl`, `jq`, QuickJS, networking, and the UART browser transport |
| AI Tools | Essentials plus `tmux`, Herdr, Git, ripgrep, shfmt, ctags, make, patch, Zerostack, Rig, the `vm*` browser commands, vmlang, and vmmastra |
| Dev | AI Tools plus native ia32 esbuild, the Chi-based `vmbro-httpd`, `vmbro-dev`, and the browsercode-style Dev IDE (Monaco editor, file tree, console, live preview) with 7 framework templates in `/opt/vmbro/templates` |
| Performance testing | AI Tools plus Grafana k6 and `k6obs`, which streams k6 results to OpenObserve during and after a run |
| VAPT — native scanner | Performance testing plus the self-contained Vaptr scanner |
| Star | Every guest feature: AI Tools, Dev IDE and templates, Performance testing, and VAPT |

Each image is built from the same clean rootfs. Specialized Dev, Performance,
and VAPT images branch after AI Tools; Star invokes every installer and combines
all of their features. Build all images as root on Linux or WSL:

```sh
sudo bash network/guest/build-tier-images.sh all
```

The image URLs, exact byte sizes, versions, and SHA-256 checksums live in
`vm-images.json`. Update the version and checksum whenever an image changes.
The browser keeps a separate cache-version marker for each tier.

Guest filesystems are independent. Export a project before changing tiers and
import it after restart when files must move between images.

The Dev tier exposes a public IDE at `/ide/` (reverse-proxied to the running VM's
port 3000) and serves the scaffolded app's live preview at `/preview/` (port
3100). It starts its bundled project with:

```sh
vmbro-dev
```

First boot is fast because the starter is precompiled at image build time:
`dist/server.js` and `.vmbro/astro-render.js` are produced by chrooted esbuild
(and QuickJS for the Astro render) before the image is finalized, and
`.vmbro/build-stamp` lets the supervisor skip the rebuild entirely. The
supervisor binds port 3000 immediately and scaffolds/builds in the background,
so the IDE shell comes up as soon as the guest reaches its shell prompt. Guest
edits to the Hono API can be rebuilt with native esbuild. Mastra, LiteRT-LM,
WebGPU, and model weights remain browser-host facilities and are not duplicated
inside the ext4 image.

## Browser and host facilities

AutoBro, voice recognition, and WebGPU inference are browser facilities rather
than guest packages. Local and Wintun networking helpers are host programs, and
remote gateway networking is server-side. They remain available to compatible
tiers without copying their binaries into every ext4 image.

The Go version reported by `k6 version` identifies the compiler used to build
the static k6 binary; the Go toolchain is not installed in the guest. ShellCheck
also remains external because Alpine does not provide it for this fixed-size
i386 image. Guest scripts can always be checked with `sh -n` and shfmt.
