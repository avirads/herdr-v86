#!/bin/sh
# Pull a file out of a v86 ext4 image without mounting it.
#
# Some guest tools exist only as Alpine builds inside the v86 tier images —
# QuickJS is the one that matters, since Debian ships no i386 quickjs package
# and the dev stack is built around it. debugfs reads the image read-only and
# needs no root, which keeps this consistent with the rest of the build.
#
# Usage: extract-from-v86.sh IMAGE GUEST_PATH OUTPUT
set -eu

IMAGE=$1
GUEST_PATH=$2
OUTPUT=$3

command -v debugfs >/dev/null 2>&1 || { echo "debugfs not found (install e2fsprogs)" >&2; exit 1; }
[ -f "$IMAGE" ] || { echo "image not found: $IMAGE" >&2; exit 1; }

debugfs -R "stat $GUEST_PATH" "$IMAGE" >/dev/null 2>&1 || {
  echo "not present in image: $GUEST_PATH" >&2
  exit 2
}

rm -f "$OUTPUT"
debugfs -R "dump $GUEST_PATH $OUTPUT" "$IMAGE" >/dev/null 2>&1
[ -s "$OUTPUT" ] || { echo "extraction produced nothing: $GUEST_PATH" >&2; exit 1; }
chmod 0755 "$OUTPUT"

echo "extracted $GUEST_PATH -> $OUTPUT ($(wc -c < "$OUTPUT") bytes)"
echo "  $(file -b "$OUTPUT" 2>/dev/null || echo 'file(1) unavailable')"
