# Build & `linux/386` / v86 Guide

## Prerequisites

- Go **1.26+** (the module is stdlib-only — no other dependencies to fetch).
- Optional, for real scans: the orchestrated tools on `PATH` (httpx, katana,
  urlfinder, ffuf, nuclei, interactsh-client) — all Go, all MIT.

Verify:

```bash
go version
```

## Native build

```bash
make build          # -> ./vaptr  (or vaptr.exe on Windows)
./vaptr version
```

## The primary target: static 32-bit ELF for v86

v86 emulates a 386-class CPU, so the framework targets `linux/386` with CGO
disabled to produce a fully static ELF (no libc, no dynamic linker):

```bash
make linux386
# equivalently:
CGO_ENABLED=0 GOOS=linux GOARCH=386 \
  go build -trimpath -ldflags "-s -w" -o dist/vaptr-linux-386 ./cmd/vaptr
```

Expected result:

```
$ file dist/vaptr-linux-386
dist/vaptr-linux-386: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV),
  statically linked, stripped
$ du -h dist/vaptr-linux-386
2.8M
```

Why these flags:

| Flag | Purpose |
|---|---|
| `CGO_ENABLED=0` | no libc dependency → static binary, runs on a minimal rootfs |
| `GOOS=linux GOARCH=386` | 32-bit x86 for v86 |
| `-trimpath` | reproducible builds, no host paths leaked |
| `-ldflags "-s -w"` | strip symbol/DWARF tables → ~40% smaller |

### Cross-compiling from Windows

```powershell
pwsh scripts/build-386.ps1
```

or with Make (Git Bash / WSL):

```bash
make linux386
```

## Building the orchestrated tools for linux/386

All default tools are Go and cross-compile the same way. Example (nuclei):

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
```

Repeat for `httpx`, `katana`, `urlfinder`, `ffuf`, `interactsh-client`. Every
default tool is Go and cross-compiles to a static `linux/386` binary — there is
no Python, Node, or JVM dependency anywhere in the default chain (parameter
discovery uses ffuf query/body fuzzing, not Arjun). The framework also degrades
gracefully: **a missing tool produces an empty artifact and the pipeline
continues** (see any agent's `errors.Is(err, runner.ErrToolMissing)` branch).

## Packaging for v86

1. Build `vaptr-linux-386` and the tool binaries (all static 386 ELFs).
2. Drop them into your v86 guest's rootfs (e.g. an Alpine or Buildroot image) at
   `/opt/vaptr/bin`, and add that to `PATH`.
3. Place a scan config and a writable workspace directory in the guest.
4. Run:

   ```sh
   vaptr scan -config /opt/vaptr/scan.json
   ```

### Suggested minimal guest

- **Buildroot** or **Alpine (32-bit)** rootfs — a few MB.
- No Python, no Node, no JVM required.
- Memory: the orchestrator idles in single-digit MB; peak is governed by the
  tools' concurrency caps (`max_concurrency` in the config). Keep it at 4–8
  inside v86 to stay well under 512 MB.

## Reproducible / verification build

```bash
make vet          # go vet ./...
make test         # unit + integration tests
make demo         # offline end-to-end scan
```

CI-friendly one-liner:

```bash
go vet ./... && go test ./... && CGO_ENABLED=0 GOOS=linux GOARCH=386 go build ./cmd/vaptr
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `tool binary not found on PATH` in logs | The tool isn't installed; the stage produced an empty artifact by design. Install the tool or ignore. |
| Binary won't start in v86 | Confirm it's `ELF 32-bit ... statically linked` (see `file`). A dynamically linked build needs libc in the guest. |
| Larger-than-expected binary | Ensure `-ldflags "-s -w"` and `-trimpath` are applied. |
| `scope: no targets approved` | Every candidate was rejected; check `scope.json` reasons and your `allowed_domains`. |
