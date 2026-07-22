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

# gcc 14+ defaults to -std=gnu23, where `bool`, `true`, and `false` are
# reserved keywords. Linux 6.6's early boot code (realmode, setup, and the
# decompressor) still defines them as macros/enums and builds -Werror, so it
# fails to compile on a modern toolchain. Pin those units to gnu11. Harmless
# on older gcc. Applied idempotently so re-runs on a warm tree don't stack.
if ! grep -q 'std=gnu11' "$SOURCE/arch/x86/Makefile"; then
  sed -i 's/^REALMODE_CFLAGS\t:= /REALMODE_CFLAGS\t:= -std=gnu11 /' \
    "$SOURCE/arch/x86/Makefile"
fi
if ! grep -q 'std=gnu11' "$SOURCE/arch/x86/boot/compressed/Makefile"; then
  sed -i 's/^KBUILD_CFLAGS := -m\$(BITS) -O2/KBUILD_CFLAGS := -std=gnu11 -m$(BITS) -O2/' \
    "$SOURCE/arch/x86/boot/compressed/Makefile"
fi

cp "$PROJECT_DIR/network/guest/kernel-6.6.config" "$SOURCE/.config"
make -C "$SOURCE" ARCH=x86 olddefconfig
make -C "$SOURCE" -j"$(nproc)" ARCH=x86 bzImage
cp "$SOURCE/arch/x86/boot/bzImage" "$PROJECT_DIR/bzImage-network"
echo "built v86 network kernel: $PROJECT_DIR/bzImage-network"
