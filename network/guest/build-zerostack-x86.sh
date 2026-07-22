#!/usr/bin/env bash
set -euo pipefail

ZEROSTACK_VERSION="${ZEROSTACK_VERSION:-1.5.0}"
SOURCE_SHA256="ba6157f1073c7f77d4a79fe7fb235b904c92e626968fa7f90444d4cefd2499ac"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ROOTFS_ARCHIVE="${ROOTFS_ARCHIVE:-$PROJECT_DIR/herdr-alpine-x86-rootfs.tar.gz}"
OUTPUT="${OUTPUT:-$PROJECT_DIR/network/guest/zerostack-$ZEROSTACK_VERSION-x86.tar.gz}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (the isolated x86 build uses chroot and device nodes)" >&2
  exit 1
fi
if [[ ! -f "$ROOTFS_ARCHIVE" ]]; then
  echo "x86 rootfs archive not found: $ROOTFS_ARCHIVE" >&2
  exit 1
fi

if [[ -n "${WORK_DIR:-}" ]]; then
  CLEAN_WORK_DIR=0
  mkdir -p "$WORK_DIR"
else
  CLEAN_WORK_DIR=1
  WORK_DIR="$(mktemp -d)"
fi
BUILD_ROOT="$WORK_DIR/root"

cleanup() {
  if [[ "$CLEAN_WORK_DIR" -eq 1 && -z "${KEEP_WORK_DIR:-}" ]]; then
    rm -rf -- "$WORK_DIR"
  else
    echo "kept build directory: $WORK_DIR"
  fi
}
trap cleanup EXIT

mkdir -p "$BUILD_ROOT"
tar -xzf "$ROOTFS_ARCHIVE" -C "$BUILD_ROOT"
printf '%s\n' \
  'https://dl-cdn.alpinelinux.org/alpine/edge/main' \
  'https://dl-cdn.alpinelinux.org/alpine/edge/community' \
  > "$BUILD_ROOT/etc/apk/repositories"
cp /etc/resolv.conf "$BUILD_ROOT/etc/resolv.conf"

mkdir -p "$BUILD_ROOT/dev"
mknod -m 0666 "$BUILD_ROOT/dev/null" c 1 3
mknod -m 0666 "$BUILD_ROOT/dev/zero" c 1 5
mknod -m 0666 "$BUILD_ROOT/dev/random" c 1 8
mknod -m 0666 "$BUILD_ROOT/dev/urandom" c 1 9

chroot "$BUILD_ROOT" /sbin/apk add --no-cache \
  alpine-keys build-base cargo rust perl cmake pkgconf curl tar
chroot "$BUILD_ROOT" /usr/bin/curl -fL \
  "https://github.com/gi-dellav/zerostack/archive/refs/tags/v$ZEROSTACK_VERSION.tar.gz" \
  -o "/root/zerostack-$ZEROSTACK_VERSION.tar.gz"
printf '%s  %s\n' "$SOURCE_SHA256" "/root/zerostack-$ZEROSTACK_VERSION.tar.gz" \
  | chroot "$BUILD_ROOT" /usr/bin/sha256sum -c -
chroot "$BUILD_ROOT" /bin/tar -xzf "/root/zerostack-$ZEROSTACK_VERSION.tar.gz" -C /root

# The VM build intentionally excludes MCP, worktrees, subagents, sockets and
# other optional orchestration. Core file/shell tools, sessions and permission
# modes remain available without Cargo features.
chroot "$BUILD_ROOT" /bin/sh -c \
  "cd /root/zerostack-$ZEROSTACK_VERSION && RUSTC=/usr/bin/rustc cargo build --locked --release --no-default-features --features loop"
chroot "$BUILD_ROOT" "/root/zerostack-$ZEROSTACK_VERSION/target/release/zerostack" --version

PACKAGE_ROOT="$WORK_DIR/package"
install -D -m 0755 \
  "$BUILD_ROOT/root/zerostack-$ZEROSTACK_VERSION/target/release/zerostack" \
  "$PACKAGE_ROOT/usr/local/libexec/zerostack"
install -D -m 0644 \
  "$BUILD_ROOT/root/zerostack-$ZEROSTACK_VERSION/LICENSE" \
  "$PACKAGE_ROOT/usr/share/licenses/zerostack/LICENSE"
tar --sort=name --owner=0 --group=0 --numeric-owner \
  -C "$PACKAGE_ROOT" -cf - . | gzip -n -9 > "$OUTPUT"
sha256sum "$OUTPUT"
file "$PACKAGE_ROOT/usr/local/libexec/zerostack"
echo "built Zerostack x86 package: $OUTPUT"
