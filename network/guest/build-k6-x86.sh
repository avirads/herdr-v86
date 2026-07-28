#!/usr/bin/env bash
set -euo pipefail

VERSION="${K6_VERSION:-v2.0.0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
OUTPUT="${OUTPUT:-$SCRIPT_DIR/bin/k6}"
UPX="${UPX:-upx}"

cleanup() {
  if [[ -z "${KEEP_WORK_DIR:-}" ]]; then rm -rf "$WORK_DIR"; fi
}
trap cleanup EXIT

git clone --depth 1 --branch "$VERSION" https://github.com/grafana/k6.git "$WORK_DIR/k6"
git -C "$WORK_DIR/k6" apply "$SCRIPT_DIR/k6-linux-386.patch"
(
  cd "$WORK_DIR/k6"
  CGO_ENABLED=0 GOOS=linux GOARCH=386 \
    go build -trimpath -ldflags="-s -w" -o "$OUTPUT.unpacked" .
)
"$UPX" --best --lzma -o "$OUTPUT" "$OUTPUT.unpacked"
rm -f "$OUTPUT.unpacked"
chmod 0755 "$OUTPUT"
file "$OUTPUT"
sha256sum "$OUTPUT"
