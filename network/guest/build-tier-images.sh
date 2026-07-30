#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ROOTFS_ARCHIVE="${ROOTFS_ARCHIVE:-$PROJECT_DIR/herdr-alpine-x86-rootfs.tar.gz}"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR}"
MOUNT_DIR="${MOUNT_DIR:-/mnt/herdr-v86-tier}"
RIG_PACKAGE="${RIG_PACKAGE:-$PROJECT_DIR/network/guest/rig-agent-0.1.0-x86.tar.gz}"
ZEROSTACK_PACKAGE="${ZEROSTACK_PACKAGE:-$PROJECT_DIR/network/guest/zerostack-1.5.0-x86.tar.gz}"
HERDR_BINARY="${HERDR_BINARY:-$PROJECT_DIR/herdr-i686}"
K6_BINARY="${K6_BINARY:-$PROJECT_DIR/network/guest/bin/k6}"
VAPTR_BINARY="${VAPTR_BINARY:-$PROJECT_DIR/network/guest/bin/vaptr}"
VAPTR_CONFIG="${VAPTR_CONFIG:-$PROJECT_DIR/network/guest/vaptr-native.json}"
DOMAIN_SKILLS_PACKAGE="${DOMAIN_SKILLS_PACKAGE:-$PROJECT_DIR/skills/guidewire-policycenter-1.0.0.zip}"
ESBUILD_BINARY="${ESBUILD_BINARY:-$PROJECT_DIR/network/guest/bin/esbuild}"
VMBRO_HTTPD_BINARY="${VMBRO_HTTPD_BINARY:-$PROJECT_DIR/network/guest/bin/vmbro-httpd}"
DEV_TEMPLATE="${DEV_TEMPLATE:-$PROJECT_DIR/network/guest/dev-template}"

TIERS=(barebones essentials ai-tools dev performance vapt)

tier_number() {
  case "$1" in
    barebones) echo 1 ;;
    essentials) echo 2 ;;
    ai-tools) echo 3 ;;
    dev) echo 4 ;;
    performance) echo 4 ;;
    vapt) echo 5 ;;
    *) echo "unknown tier: $1" >&2; exit 2 ;;
  esac
}

tier_bytes() {
  case "$1" in
    barebones) echo 67108864 ;;
    essentials) echo 83886080 ;;
    ai-tools) echo 92274688 ;;
    dev) echo 99614720 ;;
    performance) echo 96468992 ;;
    vapt) echo 103809024 ;;
  esac
}

require_file() {
  [[ -f "$1" ]] || { echo "required file not found: $1" >&2; exit 1; }
}

cleanup() {
  mountpoint -q "$MOUNT_DIR/dev" && umount "$MOUNT_DIR/dev" || true
  mountpoint -q "$MOUNT_DIR/sys" && umount "$MOUNT_DIR/sys" || true
  mountpoint -q "$MOUNT_DIR/proc" && umount "$MOUNT_DIR/proc" || true
  if mountpoint -q "$MOUNT_DIR"; then
    umount "$MOUNT_DIR" 2>/dev/null || umount -l "$MOUNT_DIR" || true
  fi
}
trap cleanup EXIT

bootstrap_image() {
  local image="$1" bytes="$2"
  cleanup
  rm -f "$image"
  truncate -s "$bytes" "$image"
  mkfs.ext4 -F -q -L vmvm "$image"
  mkdir -p "$MOUNT_DIR"
  mount -o loop,rw "$image" "$MOUNT_DIR"
  tar -xzf "$ROOTFS_ARCHIVE" -C "$MOUNT_DIR"
  mkdir -p "$MOUNT_DIR/proc" "$MOUNT_DIR/sys" "$MOUNT_DIR/dev"
  mount -t proc proc "$MOUNT_DIR/proc"
  mount -t sysfs sys "$MOUNT_DIR/sys"
  mount --bind /dev "$MOUNT_DIR/dev"
  cp /etc/resolv.conf "$MOUNT_DIR/etc/resolv.conf"

  install -m 0755 "$PROJECT_DIR/network/guest/rc.startup" "$MOUNT_DIR/sbin/rc.startup"
  install -m 0755 "$PROJECT_DIR/network/guest/autologin" "$MOUNT_DIR/sbin/autologin"
  install -m 0755 "$PROJECT_DIR/network/guest/autologin-rpc" "$MOUNT_DIR/sbin/autologin-rpc"
  install -m 0644 "$PROJECT_DIR/network/guest/inittab" "$MOUNT_DIR/etc/inittab"
  install -m 0644 "$PROJECT_DIR/network/guest/hostname" "$MOUNT_DIR/etc/hostname"
  mkdir -p "$MOUNT_DIR/root/project"

  # The archive predates the tiered shell images. Barebones intentionally has
  # no coding agent or legacy application.
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
}

install_essentials() {
  chroot "$MOUNT_DIR" /sbin/apk add --no-cache ca-certificates curl jq quickjs
  install -D -m 0755 "$PROJECT_DIR/network/guest/vmagent-poll" "$MOUNT_DIR/usr/local/bin/vmagent-poll"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vmagent-rpc" "$MOUNT_DIR/usr/local/bin/vmagent-rpc"
}

install_ai_tools() {
  require_file "$RIG_PACKAGE"
  require_file "$ZEROSTACK_PACKAGE"
  require_file "$HERDR_BINARY"
  require_file "$DOMAIN_SKILLS_PACKAGE"
  chroot "$MOUNT_DIR" /sbin/apk add --no-cache tmux libgcc git ripgrep shfmt ctags make patch
  tar -xzf "$RIG_PACKAGE" -C "$MOUNT_DIR"
  tar -xzf "$ZEROSTACK_PACKAGE" -C "$MOUNT_DIR"
  chmod 0755 "$MOUNT_DIR/usr/local/libexec/rig-agent"
  install -m 0755 "$HERDR_BINARY" "$MOUNT_DIR/usr/local/bin/herdr"
  for command in vmfetch vmclip vmexport vmproject vmgithub vmai vmllm vmlang; do
    install -m 0755 "$PROJECT_DIR/network/guest/$command" "$MOUNT_DIR/usr/local/bin/$command"
  done
  install -D -m 0755 "$PROJECT_DIR/network/guest/rig-vm" "$MOUNT_DIR/usr/local/bin/rig"
  install -D -m 0755 "$PROJECT_DIR/network/guest/zerostack-vm" "$MOUNT_DIR/usr/local/bin/zerostack"
  install -D -m 0755 "$PROJECT_DIR/network/guest/mastra-vm" "$MOUNT_DIR/usr/local/bin/vmmastra"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vmjs" "$MOUNT_DIR/usr/local/bin/vmjs"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vmbench" "$MOUNT_DIR/usr/local/bin/vmbench"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vm-openai-proxy" "$MOUNT_DIR/usr/local/libexec/vm-openai-proxy"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vm-openai-request" "$MOUNT_DIR/usr/local/libexec/vm-openai-request"
  install -D -m 0644 "$PROJECT_DIR/network/guest/skills/mastra/SKILL.md" "$MOUNT_DIR/usr/local/share/mastra/SKILL.md"
  install -D -m 0644 "$PROJECT_DIR/network/guest/agent-capabilities.md" "$MOUNT_DIR/usr/local/share/vm-agent-capabilities.md"
  install -D -m 0644 "$PROJECT_DIR/network/guest/agent-capabilities.md" "$MOUNT_DIR/root/.local/share/zerostack/AGENTS.md"
  install -D -m 0644 "$DOMAIN_SKILLS_PACKAGE" "$MOUNT_DIR/usr/local/share/vm-skills/guidewire-policycenter-1.0.0.zip"
}

install_performance() {
  require_file "$K6_BINARY"
  install -D -m 0755 "$K6_BINARY" "$MOUNT_DIR/usr/local/bin/k6"
}

install_dev() {
  require_file "$ESBUILD_BINARY"
  require_file "$VMBRO_HTTPD_BINARY"
  [[ -d "$DEV_TEMPLATE" ]] || { echo "required directory not found: $DEV_TEMPLATE" >&2; exit 1; }
  install -D -m 0755 "$ESBUILD_BINARY" "$MOUNT_DIR/usr/local/bin/esbuild"
  install -D -m 0755 "$VMBRO_HTTPD_BINARY" "$MOUNT_DIR/usr/local/bin/vmbro-httpd"
  install -D -m 0755 "$PROJECT_DIR/network/guest/vmbro-dev" "$MOUNT_DIR/usr/local/bin/vmbro-dev"
  install -d "$MOUNT_DIR/opt/vmbro/templates/mastra-hono-astro"
  cp -a "$DEV_TEMPLATE/." "$MOUNT_DIR/opt/vmbro/templates/mastra-hono-astro/"
  rm -rf "$MOUNT_DIR/root/project"
  install -d "$MOUNT_DIR/root/project"
  cp -a "$DEV_TEMPLATE/." "$MOUNT_DIR/root/project/"
}

install_vapt() {
  # Native-only image: vaptr does fingerprint/crawl/content/params/scan entirely
  # in-process (stdlib Go), so NO external scan tools are baked in. This keeps
  # the vapt tier small (~vaptr only) and lets it run inside the 512MB v86 guest,
  # unlike the heavy PD binaries (httpx/katana/nuclei) which thrash the emulator.
  require_file "$VAPTR_BINARY"
  require_file "$VAPTR_CONFIG"
  install -D -m 0755 "$VAPTR_BINARY" "$MOUNT_DIR/usr/local/bin/vaptr"
  install -D -m 0644 "$VAPTR_CONFIG" "$MOUNT_DIR/opt/vaptr/configs/native.json"
  install -d "$MOUNT_DIR/root/vaptr-workspace"
}

write_tier_metadata() {
  local tier="$1" number="$2"
  install -d "$MOUNT_DIR/etc/vmvm"
  printf '%s\n' "$tier" > "$MOUNT_DIR/etc/vmvm/tier"
  printf '%s\n' "$number" > "$MOUNT_DIR/etc/vmvm/tier-level"
}

verify_tier() {
  local tier="$1" number="$2"
  chroot "$MOUNT_DIR" /bin/sh -ec '
    command -v busybox
    test -x /sbin/rc.startup
    test -d /root/project
  '
  if (( number >= 2 )); then
    chroot "$MOUNT_DIR" /bin/sh -ec 'command -v curl jq qjs vmagent-rpc'
  else
    chroot "$MOUNT_DIR" /bin/sh -ec '! command -v curl; ! command -v vmagent-rpc'
  fi
  if (( number >= 3 )); then
    chroot "$MOUNT_DIR" /bin/sh -ec '
      command -v tmux herdr git rg shfmt ctags make patch
      command -v zerostack rig vmfetch vmclip vmexport vmproject vmgithub
      command -v vmai vmllm vmlang vmmastra vmjs vmbench
      test -x /usr/local/libexec/rig-agent
      test -f /usr/local/share/vm-skills/guidewire-policycenter-1.0.0.zip
    '
  else
    chroot "$MOUNT_DIR" /bin/sh -ec '! command -v herdr; ! command -v rig; ! command -v git'
  fi
  if [[ "$tier" == dev ]]; then
    chroot "$MOUNT_DIR" /bin/sh -ec '
      command -v esbuild vmbro-httpd vmbro-dev
      test -f /root/project/src/pages/index.astro
      test -f /root/project/src/server.ts
      test -f /root/project/dist/index.html
      test -f /opt/vmbro/templates/mastra-hono-astro/README.md
      esbuild --version
    '
  else
    chroot "$MOUNT_DIR" /bin/sh -ec '! command -v vmbro-dev'
  fi
  if [[ "$tier" == performance || "$tier" == vapt ]]; then
    chroot "$MOUNT_DIR" /usr/local/bin/k6 version
  else
    chroot "$MOUNT_DIR" /bin/sh -ec '! command -v k6'
  fi
  if [[ "$tier" == vapt ]]; then
    chroot "$MOUNT_DIR" /bin/sh -ec '
      command -v vaptr >/dev/null
      for tool in httpx katana urlfinder ffuf interactsh-client hakrawler gospider nuclei; do
        ! command -v "$tool" >/dev/null
      done
      vaptr version
      vaptr caps
      test -f /opt/vaptr/configs/native.json
      test -d /root/vaptr-workspace
    '
  else
    chroot "$MOUNT_DIR" /bin/sh -ec '! command -v vaptr; ! command -v httpx; ! command -v nuclei'
  fi
  [[ "$(cat "$MOUNT_DIR/etc/vmvm/tier")" == "$tier" ]]
}

build_tier() {
  local tier="$1" number image bytes
  number="$(tier_number "$tier")"
  bytes="$(tier_bytes "$tier")"
  image="$OUTPUT_DIR/vm-${tier}-i386-ext4.img"
  echo "Building $tier tier ($(numfmt --to=iec "$bytes")) -> $image"
  bootstrap_image "$image" "$bytes"
  (( number >= 2 )) && install_essentials
  (( number >= 3 )) && install_ai_tools
  [[ "$tier" == dev ]] && install_dev
  [[ "$tier" == performance || "$tier" == vapt ]] && install_performance
  [[ "$tier" == vapt ]] && install_vapt
  write_tier_metadata "$tier" "$number"
  verify_tier "$tier" "$number"
  cleanup
  e2fsck -fy "$image"
  echo "Built $image"
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
require_file "$ROOTFS_ARCHIVE"

requested="${1:-all}"
if [[ "$requested" == all ]]; then
  for tier in "${TIERS[@]}"; do build_tier "$tier"; done
else
  build_tier "$requested"
fi
