# VMVM image tiers

VMVM ships four cumulative Alpine i386 guest images. Select an image under
**Settings → VMVM Image**; changing the selection restarts the VM. AI Tools is
the default and preserves the capabilities of the former single image.

| Tier | Guest contents |
|---|---|
| Barebones | Alpine, BusyBox, serial shell, boot support, and `/root/project` |
| Essentials | Barebones plus CA certificates, `curl`, `jq`, QuickJS, networking, and the UART browser transport |
| AI Tools | Essentials plus `tmux`, Herdr, Git, ripgrep, shfmt, ctags, make, patch, Zerostack, Rig, the `vm*` browser commands, vmlang, and vmmastra |
| Performance testing | AI Tools plus Grafana k6 |

Each subsequent tier is built from the same clean rootfs and invokes every
installer and validation step from the preceding tier. Build all images as root
on Linux or WSL:

```sh
sudo bash network/guest/build-tier-images.sh all
```

The image URLs, exact byte sizes, versions, and SHA-256 checksums live in
`vm-images.json`. Update the version and checksum whenever an image changes.
The browser keeps a separate cache-version marker for each tier.

Guest filesystems are independent. Export a project before changing tiers and
import it after restart when files must move between images.

## Browser and host facilities

AutoBro, voice recognition, and WebGPU inference are browser facilities rather
than guest packages. Local and Wintun networking helpers are host programs, and
remote gateway networking is server-side. They remain available to compatible
tiers without copying their binaries into every ext4 image.

The Go version reported by `k6 version` identifies the compiler used to build
the static k6 binary; the Go toolchain is not installed in the guest. ShellCheck
also remains external because Alpine does not provide it for this fixed-size
i386 image. Guest scripts can always be checked with `sh -n` and shfmt.
