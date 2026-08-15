# VMVM runtime inventory

This inventory is generated from the built ext4 images, not from build scripts,
package wish lists, or older documentation. The authoritative inputs are
`/etc/apk/world` and `/usr/local/bin` inside each image, read with `debugfs`.

Verified on 2026-08-15 by running `network/guest/verify-runtime-inventory.sh`
against images whose SHA-256 was checked against `images/v86/vm-images.json`
first. Six of the seven matched the manifest exactly and are therefore the
shipped artifacts. The exception is Star, noted below.

| Tier | Version verified | APK world beyond the Alpine base | VMVM-managed executables in `/usr/local/bin` |
|---|---|---|---|
| Barebones | `2026.08.11.4` | — | — |
| Essentials | `2026.08.11.6` | `ca-certificates`, `curl`, `jq`, `openssh-client-default`, `quickjs` | `vmagent-poll`, `vmagent-rpc` |
| AI Tools | `2026.08.15.1` | Essentials plus `ctags`, `git`, `libgcc`, `make`, `patch`, `ripgrep`, `shfmt`, `tmux` | Essentials plus `herdr`, `rig`, `zerostack`, `vmai`, `vmbench`, `vmclip`, `vmexport`, `vmfetch`, `vmgithub`, `vmjs`, `vmlang`, `vmllm`, `vmmastra`, `vmproject` |
| Dev | `2026.08.11.6` | AI Tools | AI Tools plus `esbuild`, `vmbro-dev`, `vmbro-httpd`, `vmzot` |
| Performance testing | `2026.08.11.6` | AI Tools | AI Tools plus `k6`, `k6obs` |
| VAPT | `2026.08.11.6` | AI Tools | AI Tools plus `k6`, `k6obs`, `vaptr` |
| Star | `2026.08.03.9` (**not** the manifest's `2026.08.10.9`) | AI Tools, minus `openssh-client-default` | AI Tools plus `esbuild`, `k6`, `k6obs`, `vaptr`, `vmbro-dev`, `vmbro-httpd` |

All images also contain the Alpine base world packages: `alpine-baselayout`,
`alpine-keys`, `alpine-release`, `apk-tools`, `busybox`, and `libc-utils`.

## The tiers are cumulative by construction, not in the artifacts

`build_tier` applies each preceding installer, so a tier built today contains
everything the tiers below it contain. The shipped set does not satisfy that,
because the tiers were built on different days and only some were rebuilt
afterwards:

- `vmshelley` was in AI Tools (`2026.08.13.3`) and in nothing above it, because
  Dev, Performance and VAPT are all `2026.08.11.6` and predated it. AI Tools has
  since been rebuilt as `2026.08.15.1` without it, so that particular
  inconsistency is gone. The rebuild changed exactly one thing: `vmshelley` left
  `/usr/local/bin` and the apk world is byte-identical.
- `vmzot` is in Dev and not in Star, because Star is the oldest image here.
- `openssh-client-default` is in every tier from Essentials up except Star, for
  the same reason.

None of this is a defect in the build; it is what a manifest that pins seven
independently-dated artifacts looks like. It does mean "AI Tools plus …" in
`docs/vm-images.md` describes what a rebuild would produce rather than what is
currently downloadable.

## Star is pinned to bytes nobody has

`images/v86/vm-images.json` pins Star at `2026.08.10.9`, SHA-256
`6f376bbf…`. The only copy of a Star image in this repository is
`rescued-from-production/images/vm-star-i386-ext4.img.gz`, which decompresses
to `d8a5f4f6…` — a different build, `2026.08.03.9`, matching
`rescued-from-production/vm-images.json` instead.

Both are 134217728 bytes, so a size check cannot tell them apart; only the
digest can. The manifest's Star therefore exists only on the serving host, and
the row above was verified against the rescued build. Anyone rebuilding or
re-deploying Star should treat the manifest digest as the thing to satisfy, not
the rescued image.
