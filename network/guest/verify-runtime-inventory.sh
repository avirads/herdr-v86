#!/usr/bin/env bash
set -euo pipefail

project_dir="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
tiers=(barebones essentials ai-tools dev performance vapt star)

command -v debugfs >/dev/null || {
  echo "debugfs is required (install e2fsprogs)" >&2
  exit 2
}

for tier in "${tiers[@]}"; do
  image="$project_dir/vm-$tier-i386-ext4.img"
  [[ -f "$image" ]] || { echo "missing image: $image" >&2; exit 1; }
  echo "=== $tier ==="
  echo "APK world:"
  debugfs -R "cat /etc/apk/world" "$image" 2>/dev/null | LC_ALL=C sort
  echo "/usr/local/bin:"
  debugfs -R "ls -p /usr/local/bin" "$image" 2>/dev/null |
    awk -F/ 'NF > 6 && $6 != "." && $6 != ".." { print $6 }' |
    LC_ALL=C sort
  echo "SHA-256: $(sha256sum "$image" | awk '{print $1}')"
  echo
done

for image in "$project_dir"/vm-*-i386-ext4.img; do
  if debugfs -R "stat /usr/bin/zellij" "$image" 2>/dev/null | grep -q '^Inode:' ||
     debugfs -R "stat /usr/local/bin/zellij" "$image" 2>/dev/null | grep -q '^Inode:'; then
    echo "unexpected Zellij executable in $image" >&2
    exit 1
  fi
done

echo "Runtime inventory inspection complete. Compare this output with docs/runtime-inventory.md."
