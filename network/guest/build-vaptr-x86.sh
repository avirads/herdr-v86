#!/usr/bin/env bash
# Build vaptr, the native VAPT scanner the vapt tier ships.
#
# network/guest/bin/vaptr was committed as a 6.7 MB binary with no source in
# this repository, so the one tier that exists to run security scans could not
# be rebuilt, audited or patched from a clone. The source is avirads/vmvapt.
#
# Simpler than build-k6-x86.sh: vmvapt is pure Go, stdlib-only, no CGO and no
# module dependencies at all, so there is no patch to apply and no UPX step.
# One build command produces the shipped artifact.
#
#   ./network/guest/build-vaptr-x86.sh
#
# Output: network/guest/bin/vaptr
set -euo pipefail

COMMIT="${VAPTR_COMMIT:-ddef5e9a6a660a4a86cdc6d96ebbae7b0bc085cb}"
REPO="${VAPTR_REPO:-https://github.com/avirads/vmvapt.git}"
VERSION="${VAPTR_VERSION:-0.1.0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
OUTPUT="${OUTPUT:-$SCRIPT_DIR/bin/vaptr}"

cleanup() {
  if [[ -z "${KEEP_WORK_DIR:-}" ]]; then rm -rf "$WORK_DIR"; fi
}
trap cleanup EXIT

# Pinned by commit, not branch. The shipped binary records its own module
# version -- `go version -m network/guest/bin/vaptr` reads back
# v0.0.0-20260729160916-ddef5e9a6a66 -- so the pin here is checkable against
# the artifact rather than taken on trust.
git clone --quiet "$REPO" "$WORK_DIR/vmvapt"
git -C "$WORK_DIR/vmvapt" checkout --quiet "$COMMIT"

mkdir -p "$(dirname "$OUTPUT")"
(
  cd "$WORK_DIR/vmvapt"
  CGO_ENABLED=0 GOOS=linux GOARCH=386 \
    go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$OUTPUT" ./cmd/vaptr
)
chmod 0755 "$OUTPUT"

file "$OUTPUT" | grep -q "ELF 32-bit.*80386" || {
  echo "built binary is not i386: $(file "$OUTPUT")" >&2
  exit 1
}
file "$OUTPUT"
sha256sum "$OUTPUT"

# The sha256 will not match vaptr-source.json byte for byte across machines.
# Go stamps a build ID derived from the build action graph, which includes
# toolchain paths, so two hosts produce different bytes from identical source.
# Everything that describes behaviour does match: same size, same go1.26.2,
# same module commit, same flags -- verified with `go version -m` on both.
