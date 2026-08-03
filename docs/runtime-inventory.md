# VMVM runtime inventory

This inventory is generated from the built ext4 images, not from build scripts,
package wish lists, or older documentation. The authoritative inputs are
`/etc/apk/world` and `/usr/local/bin` inside each image. It was last verified
against the images prepared as Dev/Star `2026.08.03.7`.

| Tier | APK world beyond the Alpine base | VMVM-managed executables in `/usr/local/bin` |
|---|---|---|
| Barebones | — | — |
| Essentials | `ca-certificates`, `curl`, `jq`, `quickjs` | `vmagent-poll`, `vmagent-rpc` |
| AI Tools | Essentials plus `ctags`, `git`, `libgcc`, `make`, `patch`, `ripgrep`, `shfmt`, `tmux` | Essentials plus `herdr`, `rig`, `zerostack`, `vmbench`, `vmclip`, `vmexport`, `vmfetch`, `vmgithub`, `vmai`, `vmjs`, `vmlang`, `vmllm`, `vmmastra`, `vmproject` |
| Dev | AI Tools | AI Tools plus `esbuild`, `vmbro-dev`, `vmbro-httpd` |
| Performance testing | AI Tools | AI Tools plus `k6`, `k6obs` |
| VAPT | AI Tools | AI Tools plus `k6`, `vaptr` |
| Star | AI Tools | AI Tools plus `esbuild`, `k6`, `k6obs`, `vaptr`, `vmbro-dev`, `vmbro-httpd` |

All images also contain the Alpine base world packages: `alpine-baselayout`,
`alpine-keys`, `alpine-release`, `apk-tools`, `busybox`, and `libc-utils`.

Zellij and ShellCheck are not installed in any shipped image. The guest uses
tmux for terminal multiplexing and `sh -n` plus shfmt for shell validation.
AutoBro, voice recognition, WebGPU inference, AI model weights, and networking
helpers are browser, host, or server facilities rather than guest packages.

## Release verification

Run the inventory checker against the built images before every push or
release:

```sh
bash network/guest/verify-runtime-inventory.sh
```

If the checker reports a difference, update this document from the reported
runtime contents in the same commit as the images. Documentation is never an
acceptable substitute for inspecting the images.
