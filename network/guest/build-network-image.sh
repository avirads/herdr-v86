#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SOURCE_IMAGE="${SOURCE_IMAGE:-$PROJECT_DIR/herdr-vm-ext4.img}"
OUTPUT_IMAGE="${OUTPUT_IMAGE:-$PROJECT_DIR/vm-network-ext4.img}"
DISK_BYTES="${DISK_BYTES:-100663296}"
MOUNT_DIR="${MOUNT_DIR:-/mnt/herdr-v86-network}"
RIG_PACKAGE="${RIG_PACKAGE:-$PROJECT_DIR/network/guest/rig-agent-0.1.0-x86.tar.gz}"
ZEROSTACK_PACKAGE="${ZEROSTACK_PACKAGE:-$PROJECT_DIR/network/guest/zerostack-1.5.0-x86.tar.gz}"
HERDR_BINARY="${HERDR_BINARY:-}"

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
if [[ ! -f "$ZEROSTACK_PACKAGE" ]]; then
  echo "Zerostack x86 package not found: $ZEROSTACK_PACKAGE" >&2
  exit 1
fi
if [[ -z "$HERDR_BINARY" || ! -f "$HERDR_BINARY" ]]; then
  echo "set HERDR_BINARY to the statically linked i686 Herdr executable" >&2
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
chroot "$MOUNT_DIR" /sbin/apk add --no-cache curl ca-certificates tmux libgcc quickjs jq
tar -xzf "$RIG_PACKAGE" -C "$MOUNT_DIR"
tar -xzf "$ZEROSTACK_PACKAGE" -C "$MOUNT_DIR"
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
install -m 0755 "$PROJECT_DIR/network/guest/vmlang" "$MOUNT_DIR/usr/local/bin/vmlang"
install -m 0755 "$PROJECT_DIR/network/guest/vmagent-poll" "$MOUNT_DIR/usr/local/bin/vmagent-poll"
install -m 0755 "$PROJECT_DIR/network/guest/vmagent-rpc" "$MOUNT_DIR/usr/local/bin/vmagent-rpc"
install -D -m 0755 "$PROJECT_DIR/network/guest/rig-vm" "$MOUNT_DIR/usr/local/bin/rig"
install -D -m 0755 "$PROJECT_DIR/network/guest/zerostack-vm" "$MOUNT_DIR/usr/local/bin/zerostack"
install -D -m 0755 "$PROJECT_DIR/network/guest/mastra-vm" "$MOUNT_DIR/usr/local/bin/vmmastra"
install -D -m 0755 "$PROJECT_DIR/network/guest/vmjs" "$MOUNT_DIR/usr/local/bin/vmjs"
install -D -m 0755 "$PROJECT_DIR/network/guest/vmbench" "$MOUNT_DIR/usr/local/bin/vmbench"
# Agent-facing operating manual for the Mastra tier. A system path rather than
# /root/project/skills/, so the user's workspace is left untouched; the file
# itself explains the one-line copy that makes Deep Agents auto-discover it.
install -D -m 0644 "$PROJECT_DIR/network/guest/skills/mastra/SKILL.md" "$MOUNT_DIR/usr/local/share/mastra/SKILL.md"
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
  "$MOUNT_DIR/usr/local/bin/vmagent" \
  "$MOUNT_DIR/usr/local/bin/mastra" \
  "$MOUNT_DIR/sbin/herdr-boot"
install -m 0755 "$HERDR_BINARY" "$MOUNT_DIR/usr/local/bin/herdr"

chroot "$MOUNT_DIR" /usr/bin/curl --version
chroot "$MOUNT_DIR" /usr/bin/tmux -V
chroot "$MOUNT_DIR" /usr/bin/qjs -q
chroot "$MOUNT_DIR" /usr/bin/jq --version
chroot "$MOUNT_DIR" /usr/local/libexec/zerostack --version
chroot "$MOUNT_DIR" /bin/sh -c 'command -v zerostack && ! command -v vmagent && ! command -v mastra && command -v herdr && command -v vmlang && command -v vmmastra && command -v rig && command -v qjs && command -v jq && test -x /usr/local/libexec/rig-agent'
echo "built HTTPS-capable guest image: $OUTPUT_IMAGE"
