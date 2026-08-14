#!/usr/bin/env bash
set -euo pipefail

ZELLIJ_VERSION="0.44.3"
SOURCE_SHA256="33ae61fc802b59462fed49b424893596d3aa819646bdce53d5602f714c1264fe"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ROOTFS_ARCHIVE="${ROOTFS_ARCHIVE:-$PROJECT_DIR/herdr-alpine-x86-rootfs.tar.gz}"
OUTPUT="${OUTPUT:-$PROJECT_DIR/network/guest/zellij-$ZELLIJ_VERSION-x86.tar.gz}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (the isolated x86 build uses chroot and device nodes)" >&2
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

if [[ -e "$BUILD_ROOT" ]]; then
  echo "build root already exists; choose an empty WORK_DIR: $BUILD_ROOT" >&2
  exit 1
fi

if [[ ! -f "$ROOTFS_ARCHIVE" ]]; then
  echo "x86 rootfs archive not found: $ROOTFS_ARCHIVE" >&2
  exit 1
fi

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

# Cargo redirects compiler probes to /dev/null. The minimal rootfs archive has
# no device nodes, so create only those required by the isolated build.
mkdir -p "$BUILD_ROOT/dev"
mknod -m 0666 "$BUILD_ROOT/dev/null" c 1 3
mknod -m 0666 "$BUILD_ROOT/dev/zero" c 1 5
mknod -m 0666 "$BUILD_ROOT/dev/random" c 1 8
mknod -m 0666 "$BUILD_ROOT/dev/urandom" c 1 9

chroot "$BUILD_ROOT" /sbin/apk add --no-cache \
  alpine-keys build-base cargo rust openssl-dev perl cmake pkgconf curl tar
chroot "$BUILD_ROOT" /usr/bin/curl -fL \
  "https://github.com/zellij-org/zellij/archive/refs/tags/v$ZELLIJ_VERSION.tar.gz" \
  -o "/root/zellij-$ZELLIJ_VERSION.tar.gz"
printf '%s  %s\n' "$SOURCE_SHA256" "/root/zellij-$ZELLIJ_VERSION.tar.gz" \
  | chroot "$BUILD_ROOT" /usr/bin/sha256sum -c -
chroot "$BUILD_ROOT" /bin/tar -xzf "/root/zellij-$ZELLIJ_VERSION.tar.gz" -C /root
chroot "$BUILD_ROOT" /bin/sh -c \
  "cd /root/zellij-$ZELLIJ_VERSION && RUSTC=/usr/bin/rustc OPENSSL_NO_VENDOR=1 cargo build --locked --release --package zellij"

PACKAGE_ROOT="$WORK_DIR/package"
install -D -m 0755 \
  "$BUILD_ROOT/root/zellij-$ZELLIJ_VERSION/target/release/zellij" \
  "$PACKAGE_ROOT/usr/local/bin/zellij"
install -D -m 0644 \
  "$BUILD_ROOT/root/zellij-$ZELLIJ_VERSION/LICENSE.md" \
  "$PACKAGE_ROOT/usr/share/licenses/zellij/LICENSE.md"
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime=@1747130000 \
  -C "$PACKAGE_ROOT" -cf - . | gzip -n -9 > "$OUTPUT"
sha256sum "$OUTPUT"
file "$PACKAGE_ROOT/usr/local/bin/zellij"
echo "built Zellij x86 package: $OUTPUT"
