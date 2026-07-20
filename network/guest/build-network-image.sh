#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SOURCE_IMAGE="${SOURCE_IMAGE:-$PROJECT_DIR/herdr-vm-ext4.img}"
OUTPUT_IMAGE="${OUTPUT_IMAGE:-$PROJECT_DIR/herdr-vm-network-ext4.img}"
MOUNT_DIR="${MOUNT_DIR:-/mnt/herdr-v86-network}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if [[ ! -f "$SOURCE_IMAGE" ]]; then
  echo "source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

cleanup() {
  mountpoint -q "$MOUNT_DIR/dev" && umount "$MOUNT_DIR/dev" || true
  mountpoint -q "$MOUNT_DIR/sys" && umount "$MOUNT_DIR/sys" || true
  mountpoint -q "$MOUNT_DIR/proc" && umount "$MOUNT_DIR/proc" || true
  mountpoint -q "$MOUNT_DIR" && umount "$MOUNT_DIR" || true
}
trap cleanup EXIT

cp --reflink=auto "$SOURCE_IMAGE" "$OUTPUT_IMAGE"
mkdir -p "$MOUNT_DIR"
mount -o loop,rw "$OUTPUT_IMAGE" "$MOUNT_DIR"
mount -t proc proc "$MOUNT_DIR/proc"
mount -t sysfs sys "$MOUNT_DIR/sys"
mount --bind /dev "$MOUNT_DIR/dev"

# The minimal base image intentionally has no resolv.conf.
cp /etc/resolv.conf "$MOUNT_DIR/etc/resolv.conf"
chroot "$MOUNT_DIR" /sbin/apk add --no-cache curl ca-certificates
install -m 0755 "$PROJECT_DIR/network/guest/rc.startup" "$MOUNT_DIR/sbin/rc.startup"

chroot "$MOUNT_DIR" /usr/bin/curl --version
echo "built HTTPS-capable guest image: $OUTPUT_IMAGE"
