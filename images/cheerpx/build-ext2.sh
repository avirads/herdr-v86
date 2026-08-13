#!/bin/sh
# Build a CheerpX ext2 disk image from a container base image.
#
# No Docker, no debootstrap, no root. Two facts make that work:
#   - a registry pull is just HTTPS + tar (see pull-rootfs.py)
#   - mke2fs -d populates an image from a directory, so nothing is ever mounted
#
# Everything runs inside ONE fakeroot session on purpose. The layer tarballs
# carry root-owned files; fakeroot remembers that ownership, and mke2fs -d must
# read the tree from inside the same session or every file in the image ends up
# owned by the build user instead of root.
#
# Run under Linux/WSL:
#   sh images/cheerpx/build-ext2.sh
#   IMAGE=i386/debian:bookworm-slim SIZE_MB=512 sh images/cheerpx/build-ext2.sh
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)

IMAGE="${IMAGE:-i386/debian:bookworm-slim}"
ARCH="${ARCH:-386}"
# 448 MB, not 512, and the number is chosen against a CDN rather than the guest.
# Cloudflare will not cache an object larger than 512 MB on Free, Pro or
# Business, and this image is the worst possible thing to leave uncacheable:
# CheerpX demand-pages it as hundreds of small Range requests, so every cold
# boot goes to the origin. The contents occupy about 286 MB, so 448 leaves
# ~160 MB of headroom while staying clear of that ceiling. Do not raise this
# past 512 without checking what it costs at the edge.
SIZE_MB="${SIZE_MB:-448}"

# Unpacked into the rootfs by add-packages.py. The base container image is bash
# and coreutils only, which left the CheerpX guest less capable than the v86 one
# — these are what close that gap. Kept to self-contained CLI tools on purpose:
# maintainer scripts never run, so anything needing postinst setup would be
# inert. Set PACKAGES='' to build the bare base.
#
# EVERY ADDITION MUST BE SMOKE-TESTED IN THE GUEST, AND ON A FRESH BOOT.
# Installing a package is not the same as it working: unpacking is trivial, but
# CheerpX runs the binary.
#
# Test each candidate ALONE, with stdin closed, and re-check the guest is still
# responsive afterwards. One hung process poisons every command queued behind it,
# so a batch of probes reports the first hang as though everything after it also
# hung. That mistake cost this tier a working python3: a bad `qjs --help` probe
# dropped QuickJS into its stdin REPL, wedged the guest, and made four healthy
# binaries look broken.
#
# Measured on a fresh guest, stdin closed:
#   working   git, jq, make, patch, grep, less, file, diffutils, procps,
#             python3 (print 1.6 s, import json 4.5 s), qjs, esbuild, vmbro-httpd
#   HANGS     ripgrep — `rg -n pattern file` never returns even with --threads 1,
#             while the guest stays responsive, so it is rg itself. Excluded:
#             shipping it would have an agent stall for the whole timeout.
PACKAGES="${PACKAGES:-git jq make patch less nano procps xz-utils ca-certificates file diffutils python3 netcat-openbsd}"

# The v86 "dev" tier's stack, ported wholesale. It is Node-free by design —
# QuickJS plus two statically linked i386 Go/native binaries — which is exactly
# why it ports to CheerpX when Node and Bun cannot: there is no 64-bit
# dependency anywhere in it.
DEV_STACK="${DEV_STACK:-1}"
SUITE="${SUITE:-bookworm}"
DEB_ARCH="${DEB_ARCH:-i386}"
OUTPUT="${OUTPUT:-$HERE/vmbro-debian-i386.ext2}"
WORK="${WORK:-${TMPDIR:-/tmp}/vmbro-ext2-build}"
LABEL="${LABEL:-vmbro}"

for tool in mke2fs fakeroot python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing required tool: $tool" >&2; exit 1; }
done

ROOTFS="$WORK/rootfs"
rm -rf "$WORK"
mkdir -p "$ROOTFS"

echo "[build] image=$IMAGE arch=$ARCH size=${SIZE_MB}MB"
echo "[build] work=$WORK"

fakeroot -- sh -eu -c '
  ROOTFS="$1"; HERE="$2"; IMAGE="$3"; ARCH="$4"; OUTPUT="$5"; SIZE_MB="$6"; LABEL="$7"
  PACKAGES="$8"; SUITE="$9"; DEB_ARCH="${10}"; DEV_STACK="${11}"

  python3 "$HERE/pull-rootfs.py" --image "$IMAGE" --arch "$ARCH" --out "$ROOTFS"

  # Same fakeroot session as the pull and the mke2fs below, so unpacked files
  # keep their root ownership.
  if [ -n "$PACKAGES" ]; then
    # shellcheck disable=SC2086
    python3 "$HERE/add-packages.py" --rootfs "$ROOTFS" --suite "$SUITE" --arch "$DEB_ARCH" $PACKAGES
  fi

  # Mount points MUST exist in the image. CheerpX refuses a {type:"dir"} mount
  # whose parent directory is absent, and the failure is silent-ish: Linux.create
  # never settles and the only clue is an uncaught rejection in the console.
  # Spike S-1/S-2 lost a boot to exactly this.
  mkdir -p "$ROOTFS/vmbro/in" "$ROOTFS/vmbro/out"
  mkdir -p "$ROOTFS/root/project"

  # Guest half of the host bridge. Every vm* tool reaches the browser through it.
  if [ -d "$HERE/guest" ]; then
    mkdir -p "$ROOTFS/usr/local/bin"
    for tool in "$HERE"/guest/*; do
      [ -f "$tool" ] || continue
      install -m 0755 "$tool" "$ROOTFS/usr/local/bin/$(basename "$tool")"
    done
  fi

  # Dev stack, shared verbatim with the v86 dev tier. Both binaries are i386
  # and statically linked, so they need nothing from the guest beyond a kernel.
  if [ "$DEV_STACK" = "1" ]; then
    GUEST_SRC="$HERE/../../network/guest"
    mkdir -p "$ROOTFS/usr/local/bin"
    for native in esbuild vmbro-httpd; do
      if [ -f "$GUEST_SRC/bin/$native" ]; then
        install -m 0755 "$GUEST_SRC/bin/$native" "$ROOTFS/usr/local/bin/$native"
      else
        echo "[build] WARNING: $GUEST_SRC/bin/$native missing; dev tier will be incomplete" >&2
      fi
    done
    [ -f "$GUEST_SRC/vmbro-dev" ] && install -m 0755 "$GUEST_SRC/vmbro-dev" "$ROOTFS/usr/local/bin/vmbro-dev"

    # zot, the in-guest coding agent, plus the OpenAI-compatible bridge it talks
    # to. Both are shipped so the image matches the v86 dev tier, but vmzot will
    # refuse to start here and say why: zot dials http://127.0.0.1:11435 and this
    # guest has no TCP stack, not even loopback, so nothing can listen on it.
    # Shipping it inert beats a missing command that looks like a packaging bug,
    # and it becomes live the day CheerpX gets a network interface.
    if [ -f "$GUEST_SRC/bin/zot" ]; then
      mkdir -p "$ROOTFS/usr/local/libexec"
      install -m 0755 "$GUEST_SRC/bin/zot" "$ROOTFS/usr/local/libexec/zot"
      install -m 0755 "$GUEST_SRC/vmzot" "$ROOTFS/usr/local/bin/vmzot"
      install -m 0755 "$GUEST_SRC/vm-openai-proxy" "$ROOTFS/usr/local/libexec/vm-openai-proxy"
      install -m 0755 "$GUEST_SRC/vm-openai-request" "$ROOTFS/usr/local/libexec/vm-openai-request"
    fi

    # QuickJS. Debian ships no i386 quickjs package in any suite, but the v86
    # dev image already carries a working one, so take it from there rather than
    # cross-compiling. It is musl-linked and this rootfs is glibc — that is fine,
    # because on musl the "loader" IS libc: one self-contained file at a path
    # glibc never touches. Copy it plus the SONAME symlink qjs actually asks for
    # (libc.musl-x86.so.1) and the two libcs coexist without interfering.
    V86_IMAGE="$HERE/../v86/vm-dev-i386-ext4.img"
    if [ -f "$V86_IMAGE" ]; then
      if sh "$HERE/extract-from-v86.sh" "$V86_IMAGE" /usr/bin/qjs "$ROOTFS/usr/local/bin/qjs" >/dev/null 2>&1; then
        mkdir -p "$ROOTFS/lib"
        sh "$HERE/extract-from-v86.sh" "$V86_IMAGE" /lib/ld-musl-i386.so.1 "$ROOTFS/lib/ld-musl-i386.so.1" >/dev/null 2>&1 || true
        ln -sf ld-musl-i386.so.1 "$ROOTFS/lib/libc.musl-x86.so.1"
        echo "[build] qjs + musl loader taken from the v86 dev image"
      else
        echo "[build] WARNING: could not extract qjs from $V86_IMAGE" >&2
      fi
    else
      echo "[build] WARNING: $V86_IMAGE missing; qjs will be absent" >&2
    fi

    # The starter project, so the tier boots with something to build and serve.
    if [ -d "$GUEST_SRC/dev-template" ]; then
      mkdir -p "$ROOTFS/root/project"
      (cd "$GUEST_SRC/dev-template" && tar -cf - .) | (cd "$ROOTFS/root/project" && tar -xf -)

      # Bundle the server now, not in the guest later. Measured on CheerpX: this
      # same build costs ~94 s on a cold guest -- 53 s of it just paging the
      # 10 MB esbuild binary in over HTTP Range -- against a 120 s command
      # ceiling. Shipping the output means the first render needs no build at
      # all, and Build & render becomes something you press after editing rather
      # than something you must press before anything works.
      #
      # The vendored esbuild is i386 and runs on an x86_64 build host through
      # ia32 emulation; set HOST_ESBUILD to a native binary where it does not.
      ESBUILD_HOST="${HOST_ESBUILD:-$GUEST_SRC/bin/esbuild}"
      if "$ESBUILD_HOST" --version >/dev/null 2>&1; then
        ( cd "$ROOTFS/root/project" \
          && "$ESBUILD_HOST" src/server.ts --bundle --format=esm \
               --platform=neutral --target=es2020 --outfile=dist/server.js )
        echo "  prebuilt dist/server.js ($(wc -c < "$ROOTFS/root/project/dist/server.js") bytes)"
      else
        # Not fatal here: the guest can still build on demand, it is simply slow.
        echo "  WARNING: cannot run $ESBUILD_HOST on this host, shipping without" >&2
        echo "  a prebuilt bundle. The first Build & render will take ~90 s." >&2
      fi
    fi
  fi

  # /dev and /proc are provided by CheerpX mounts ("devs"/"proc"), so the image
  # needs the directories but not populated device nodes.
  mkdir -p "$ROOTFS/dev" "$ROOTFS/proc" "$ROOTFS/sys" "$ROOTFS/tmp"
  chmod 1777 "$ROOTFS/tmp"

  printf "vmbro\n" > "$ROOTFS/etc/hostname"

  echo "[build] building ext2 (${SIZE_MB}MB, 4096-byte blocks)"
  rm -f "$OUTPUT"
  # -b 4096 and -I 128 are both REQUIRED, not tuning choices, and mke2fs picks
  # the wrong value for each on its own:
  #   * it uses 1024-byte blocks for small filesystems, and CheerpX refuses with
  #     "Block size 1024 not supported. fatal error."
  #   * it uses 256-byte inodes once the filesystem grows past a few hundred MB,
  #     and CheerpX then refuses with a bare "Invalid disk image" — no mention of
  #     inodes at all. A 384 MB image happened to get 128-byte inodes and worked;
  #     the same tree at 1024 MB did not.
  # Both failures surface only at boot, as Linux.create never settling.
  # -d populates from a directory; -F because the target is a regular file.
  mke2fs -q -F -b 4096 -I 128 -t ext2 -L "$LABEL" -d "$ROOTFS" "$OUTPUT" "${SIZE_MB}m"
' -- "$ROOTFS" "$HERE" "$IMAGE" "$ARCH" "$OUTPUT" "$SIZE_MB" "$LABEL" "$PACKAGES" "$SUITE" "$DEB_ARCH" "$DEV_STACK"

echo "[build] verifying"
e2fsck -fn "$OUTPUT" >/dev/null 2>&1 || echo "[build] WARNING: e2fsck reported issues"

# Guard the requirement above: a 1024-block image builds and fscks cleanly, then
# fails only at CheerpX boot with a misleading "Invalid disk image".
BLOCK_SIZE=$(dumpe2fs -h "$OUTPUT" 2>/dev/null | awk -F: '/^Block size/ { gsub(/ /,"",$2); print $2 }')
if [ "$BLOCK_SIZE" != "4096" ]; then
  echo "[build]   FAIL block size is ${BLOCK_SIZE:-unknown}, CheerpX requires 4096" >&2
  exit 1
fi
echo "[build]   ok  block size 4096"

INODE_SIZE=$(dumpe2fs -h "$OUTPUT" 2>/dev/null | awk -F: '/^Inode size/ { gsub(/ /,"",$2); print $2 }')
if [ "$INODE_SIZE" != "128" ]; then
  echo "[build]   FAIL inode size is ${INODE_SIZE:-unknown}, CheerpX requires 128" >&2
  exit 1
fi
echo "[build]   ok  inode size 128"
REQUIRED="/vmbro/in /vmbro/out /bin/sh /root/project /usr/local/bin/vmbro-rpc"
[ "$DEV_STACK" = "1" ] && REQUIRED="$REQUIRED /usr/local/bin/esbuild /usr/local/bin/vmbro-httpd /usr/local/bin/qjs /root/project/src/server.ts"
for required in $REQUIRED; do
  if debugfs -R "stat $required" "$OUTPUT" >/dev/null 2>&1; then
    echo "[build]   ok  $required"
  else
    echo "[build]   MISSING $required" >&2
    exit 1
  fi
done

echo "[build] done: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "[build] sha256: $(sha256sum "$OUTPUT" | cut -d' ' -f1)"
