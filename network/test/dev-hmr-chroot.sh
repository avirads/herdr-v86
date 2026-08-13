#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
source_image="${1:-$project_dir/vm-dev-i386-ext4.img}"
work_dir="$(mktemp -d)"
image="$work_dir/dev.img"
mount_dir="$work_dir/root"
pid=""

cleanup() {
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  mountpoint -q "$mount_dir/proc" && umount "$mount_dir/proc" || true
  mountpoint -q "$mount_dir/dev" && umount -l "$mount_dir/dev" || true
  mountpoint -q "$mount_dir" && umount -l "$mount_dir" || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

cp "$source_image" "$image"
mkdir -p "$mount_dir"
mount -o loop,rw "$image" "$mount_dir"
mount -t proc proc "$mount_dir/proc"
mount -t devtmpfs dev "$mount_dir/dev"

chroot "$mount_dir" /bin/sh -c 'cd /root/project && PORT=3000 vmbro-dev >/tmp/vmbro-hmr-test.log 2>&1' &
pid=$!
for _ in $(seq 1 60); do
  [[ -f "$mount_dir/tmp/vmbro-hmr-test.log" ]] &&
    grep -q 'vmbro-httpd (Dev IDE) listening' "$mount_dir/tmp/vmbro-hmr-test.log" && break
  sleep 1
done
grep -q 'vmbro-httpd (Dev IDE) listening' "$mount_dir/tmp/vmbro-hmr-test.log"
sleep 2

sed -i 's/Mastra Weather Agent/HMR VERIFIED/g' "$mount_dir/root/project/src/pages/index.astro"
for _ in $(seq 1 60); do
  grep -q 'HMR VERIFIED' "$mount_dir/root/project/dist/index.html" && break
  sleep 1
done

grep -q 'HMR VERIFIED' "$mount_dir/root/project/dist/index.html"
echo "Dev Astro HMR chroot test passed"
