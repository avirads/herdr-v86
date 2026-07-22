#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SOURCE_ARCHIVE="${SOURCE_ARCHIVE:-$PROJECT_DIR/network/guest/rig-agent-0.1.0-source.tar.gz}"
OUTPUT="${OUTPUT:-$PROJECT_DIR/network/guest/rig-agent-0.1.0-x86.tar.gz}"
BUILD_DIR="${BUILD_DIR:-$(mktemp -d)}"

[[ -f "$SOURCE_ARCHIVE" ]] || { echo "source archive not found: $SOURCE_ARCHIVE" >&2; exit 1; }
tar -xzf "$SOURCE_ARCHIVE" -C "$BUILD_DIR"
cd "$BUILD_DIR/rig-agent-0.1.0"
cargo zigbuild --locked --release --target i686-unknown-linux-musl
install -D -m 0755 target/i686-unknown-linux-musl/release/rig-vm-probe "$BUILD_DIR/package/usr/local/libexec/rig-agent"
tar -czf "$OUTPUT" -C "$BUILD_DIR/package" .
file "$BUILD_DIR/package/usr/local/libexec/rig-agent"
echo "built $OUTPUT"
