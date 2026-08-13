#!/usr/bin/env bash
# Build Shelley for the i386 guest.
#
# Shelley is pure Go and cross-compiles to linux/386 with CGO disabled, so
# unlike build-zellij-x86.sh this needs no chroot and no i386 rootfs -- only a
# Go toolchain and, for the embedded web UI, Node with pnpm.
#
#   ./network/guest/build-shelley-x86.sh
#
# Output: network/guest/bin/shelley
set -euo pipefail

SHELLEY_REPO="${SHELLEY_REPO:-https://github.com/boldsoftware/shelley.git}"
SHELLEY_REF="${SHELLEY_REF:-main}"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
OUTPUT="${OUTPUT:-$PROJECT_DIR/network/guest/bin/shelley}"

if [[ -n "${SHELLEY_SRC:-}" ]]; then
  CLEAN_SRC=0
  SRC="$SHELLEY_SRC"
else
  CLEAN_SRC=1
  SRC="$(mktemp -d)/shelley"
  git clone --depth 1 --branch "$SHELLEY_REF" "$SHELLEY_REPO" "$SRC"
fi
cleanup() {
  if [[ "$CLEAN_SRC" -eq 1 && -z "${KEEP_SRC:-}" ]]; then
    rm -rf -- "$(dirname "$SRC")"
  else
    echo "kept source tree: $SRC"
  fi
}
trap cleanup EXIT

cd "$SRC"

# Two generated inputs are //go:embed targets, and the Go build fails on both
# before it compiles a line if they are missing:
#   ui/embedfs.go     pattern dist/*
#   templates/...     pattern *.tar.gz
for dir in templates/*/; do
  name="$(basename "$dir")"
  tar -czf "templates/$name.tar.gz" -C "templates/$name" --exclude='.DS_Store' .
done

( cd ui && corepack pnpm install --frozen-lockfile --silent && corepack pnpm run --silent build )

# Source maps are half the built UI (6.8 of 13.4 MiB) and are dead weight in a
# guest nobody debugs the SPA from. Dropping them takes the binary from 35.5 to
# 28.7 MiB, which is a fifth of the ai-tools tier's remaining headroom.
rm -f ui/dist/*.map ui/dist/*.map.gz

# CGO must stay off. It is what makes this a pure-Go cross-compile: sqlite comes
# from modernc.org/sqlite rather than a cgo driver, so no i386 C toolchain is
# involved. Nothing in cmd/shelley's build graph needs cgo -- verified by this
# build succeeding with CGO_ENABLED=0.
mkdir -p "$(dirname "$OUTPUT")"
CGO_ENABLED=0 GOOS=linux GOARCH=386 go build -ldflags "-s -w" -o "$OUTPUT" ./cmd/shelley

file "$OUTPUT" | grep -q "ELF 32-bit.*80386" || {
  echo "built binary is not i386: $(file "$OUTPUT")" >&2
  exit 1
}
ls -l "$OUTPUT"
