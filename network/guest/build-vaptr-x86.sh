#!/usr/bin/env bash
# Build vaptr, the native VAPT scanner the vapt tier ships.
#
# The source is vendored at network/guest/vaptr/ and this builds from it. No
# network, no clone, no upstream that has to still exist.
#
# The first version of this script cloned avirads/vmvapt at a pinned commit,
# which read as "the source is available" while actually making this repository
# depend on another one staying alive. Deleting vmvapt would have left the vapt
# tier exactly where it started: a 6.7 MB binary nobody could rebuild.
#
# vmvapt is pure Go, stdlib-only, no CGO and no module dependencies, so
# vendoring it costs 427 KB and buys a self-contained build.
#
#   ./network/guest/build-vaptr-x86.sh
#
# Output: network/guest/bin/vaptr
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="${VAPTR_SOURCE:-$SCRIPT_DIR/vaptr}"
VERSION="${VAPTR_VERSION:-0.1.0}"
OUTPUT="${OUTPUT:-$SCRIPT_DIR/bin/vaptr}"

[[ -f "$SOURCE_DIR/go.mod" ]] || {
  echo "vaptr source not found at $SOURCE_DIR" >&2
  echo "It is vendored in this repository; see network/guest/vaptr-source.json" >&2
  exit 1
}

mkdir -p "$(dirname "$OUTPUT")"
(
  cd "$SOURCE_DIR"
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

# Two things not to expect from the output.
#
# It will not match by sha256. Go stamps a build ID derived from the build
# action graph, which includes toolchain paths, so two hosts produce different
# bytes from identical source. Size (6684834) and toolchain are the stable
# identity.
#
# And it reports `mod ... (devel)` under `go version -m`, not a pseudo-version,
# because building from a plain directory gives Go no commit to stamp. The
# binary currently committed at bin/vaptr predates vendoring and still carries
# v0.0.0-20260729160916-ddef5e9a6a66 -- the commit named in vaptr-source.json.
# Once bin/vaptr is rebuilt from here, that self-describing link is gone and
# vaptr-source.json becomes the only record of provenance. That is the price of
# not depending on an upstream repository, and it is worth paying.
#
# To refresh the vendored source, re-export it from upstream rather than
# editing in place, so the commit recorded in vaptr-source.json stays true:
#   git -C /path/to/vmvapt archive --format=tar <commit> \
#     | tar -x -C network/guest/vaptr
