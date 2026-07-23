#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SOURCE_IMAGE="${SOURCE_IMAGE:-$PROJECT_DIR/herdr-vm-ext4.img}"
OUTPUT_IMAGE="${OUTPUT_IMAGE:-$PROJECT_DIR/vm-network-ext4.img}"
DISK_BYTES="${DISK_BYTES:-100663296}"
MOUNT_DIR="${MOUNT_DIR:-/mnt/herdr-v86-network}"
RIG_PACKAGE="${RIG_PACKAGE:-$PROJECT_DIR/network/guest/rig-agent-0.1.0-x86.tar.gz}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if [[ ! -f "$SOURCE_IMAGE" ]]; then
  echo "source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi
if [[ ! -f "$RIG_PACKAGE" ]]; then
  echo "Rig agent x86 package not found: $RIG_PACKAGE" >&2
  exit 1
fi

cleanup() {
  mountpoint -q "$MOUNT_DIR/dev" && umount "$MOUNT_DIR/dev" || true
  mountpoint -q "$MOUNT_DIR/sys" && umount "$MOUNT_DIR/sys" || true
  mountpoint -q "$MOUNT_DIR/proc" && umount "$MOUNT_DIR/proc" || true
  if mountpoint -q "$MOUNT_DIR"; then
    umount "$MOUNT_DIR" 2>/dev/null || umount -l "$MOUNT_DIR" || true
  fi
}
trap cleanup EXIT

cp --reflink=auto "$SOURCE_IMAGE" "$OUTPUT_IMAGE"
truncate -s "$DISK_BYTES" "$OUTPUT_IMAGE"
e2fsck -fy "$OUTPUT_IMAGE"
resize2fs "$OUTPUT_IMAGE"
mkdir -p "$MOUNT_DIR"
mount -o loop,rw "$OUTPUT_IMAGE" "$MOUNT_DIR"
mount -t proc proc "$MOUNT_DIR/proc"
mount -t sysfs sys "$MOUNT_DIR/sys"
mount --bind /dev "$MOUNT_DIR/dev"

# The minimal base image intentionally has no resolv.conf.
cp /etc/resolv.conf "$MOUNT_DIR/etc/resolv.conf"
chroot "$MOUNT_DIR" /sbin/apk add --no-cache curl ca-certificates tmux libgcc
tar -xzf "$RIG_PACKAGE" -C "$MOUNT_DIR"
chmod 0755 "$MOUNT_DIR/usr/local/libexec/rig-agent"
install -m 0755 "$PROJECT_DIR/network/guest/rc.startup" "$MOUNT_DIR/sbin/rc.startup"
install -m 0755 "$PROJECT_DIR/network/guest/autologin" "$MOUNT_DIR/sbin/autologin"
install -m 0755 "$PROJECT_DIR/network/guest/autologin-rpc" "$MOUNT_DIR/sbin/autologin-rpc"
install -m 0644 "$PROJECT_DIR/network/guest/inittab" "$MOUNT_DIR/etc/inittab"
install -m 0755 "$PROJECT_DIR/network/guest/vmfetch" "$MOUNT_DIR/usr/local/bin/vmfetch"
install -m 0755 "$PROJECT_DIR/network/guest/vmclip" "$MOUNT_DIR/usr/local/bin/vmclip"
install -m 0755 "$PROJECT_DIR/network/guest/vmexport" "$MOUNT_DIR/usr/local/bin/vmexport"
install -m 0755 "$PROJECT_DIR/network/guest/vmgithub" "$MOUNT_DIR/usr/local/bin/vmgithub"
install -m 0755 "$PROJECT_DIR/network/guest/vmai" "$MOUNT_DIR/usr/local/bin/vmai"
install -m 0755 "$PROJECT_DIR/network/guest/vmllm" "$MOUNT_DIR/usr/local/bin/vmllm"
install -m 0755 "$PROJECT_DIR/network/guest/vmagent" "$MOUNT_DIR/usr/local/bin/vmagent"
install -m 0755 "$PROJECT_DIR/network/guest/vmagent-poll" "$MOUNT_DIR/usr/local/bin/vmagent-poll"
install -m 0755 "$PROJECT_DIR/network/guest/vmagent-rpc" "$MOUNT_DIR/usr/local/bin/vmagent-rpc"
install -D -m 0755 "$PROJECT_DIR/network/guest/rig-vm" "$MOUNT_DIR/usr/local/bin/rig"
install -D -m 0755 "$PROJECT_DIR/network/guest/vm-openai-proxy" "$MOUNT_DIR/usr/local/libexec/vm-openai-proxy"
install -D -m 0755 "$PROJECT_DIR/network/guest/vm-openai-request" "$MOUNT_DIR/usr/local/libexec/vm-openai-request"
# The source image predates the shell-only guest. Do not carry its legacy app
# into the network image.
rm -f \
  "$MOUNT_DIR/usr/local/bin/herdr" \
  "$MOUNT_DIR/usr/local/bin/opendev" \
  "$MOUNT_DIR/usr/local/libexec/opendev" \
  "$MOUNT_DIR/usr/local/bin/zap" \
  "$MOUNT_DIR/usr/local/libexec/zap" \
  "$MOUNT_DIR/usr/local/bin/pi" \
  "$MOUNT_DIR/usr/local/libexec/pi" \
  "$MOUNT_DIR/usr/local/bin/zerostack" \
  "$MOUNT_DIR/usr/local/libexec/zerostack" \
  "$MOUNT_DIR/sbin/herdr-boot"

chroot "$MOUNT_DIR" /usr/bin/curl --version
chroot "$MOUNT_DIR" /usr/bin/tmux -V
chroot "$MOUNT_DIR" /bin/sh -c '! command -v zerostack && command -v rig && test -x /usr/local/libexec/rig-agent'
echo "built HTTPS-capable guest image: $OUTPUT_IMAGE"
