#!/usr/bin/env bash
set -euo pipefail

NETWORK_NAME="${NETWORK_NAME:-default}"
STATE_DIR="${STATE_DIR:-/run/v86net/$NETWORK_NAME}"
TAP_NAME="${TAP_NAME:-v86tap0}"
NFT_TABLE="v86_${NETWORK_NAME}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (for example: sudo $0)" >&2
  exit 1
fi
if [[ -f "$STATE_DIR/dnsmasq.pid" ]]; then
  pid="$(cat "$STATE_DIR/dnsmasq.pid")"
  kill "$pid" 2>/dev/null || true
  rm -f "$STATE_DIR/dnsmasq.pid"
fi
nft delete table ip "$NFT_TABLE" 2>/dev/null || true
if ip link show "$TAP_NAME" >/dev/null 2>&1; then
  ip link delete "$TAP_NAME"
fi
rm -f "$STATE_DIR/config"
rmdir "$STATE_DIR" 2>/dev/null || true
if [[ -z "$(find /run/v86net -mindepth 1 -maxdepth 1 -type d -print -quit 2>/dev/null)" ]]; then
  if [[ -f /run/v86net/ip_forward.previous ]]; then
    previous="$(cat /run/v86net/ip_forward.previous)"
    if [[ "$previous" == "0" || "$previous" == "1" ]]; then
      sysctl -q -w "net.ipv4.ip_forward=$previous"
    fi
    rm -f /run/v86net/ip_forward.previous
  fi
  rmdir /run/v86net 2>/dev/null || true
fi
echo "v86 network removed: $TAP_NAME"
