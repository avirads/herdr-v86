#!/usr/bin/env bash
set -euo pipefail

KERNEL_VERSION="${KERNEL_VERSION:-6.6}"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
WORK_DIR="${WORK_DIR:-/tmp/herdr-v86-kernel}"
ARCHIVE="$WORK_DIR/linux-$KERNEL_VERSION.tar.xz"
SOURCE="$WORK_DIR/linux-$KERNEL_VERSION"

mkdir -p "$WORK_DIR"
if [[ ! -f "$ARCHIVE" ]]; then
  curl -fL "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-$KERNEL_VERSION.tar.xz" -o "$ARCHIVE"
fi
if [[ ! -d "$SOURCE" ]]; then
  tar -C "$WORK_DIR" -xf "$ARCHIVE"
fi
cp "$PROJECT_DIR/network/guest/kernel-6.6.config" "$SOURCE/.config"
make -C "$SOURCE" ARCH=x86 olddefconfig
make -C "$SOURCE" -j"$(nproc)" ARCH=x86 bzImage
cp "$SOURCE/arch/x86/boot/bzImage" "$PROJECT_DIR/bzImage-network"
echo "built v86 network kernel: $PROJECT_DIR/bzImage-network"
