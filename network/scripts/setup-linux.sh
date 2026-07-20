#!/usr/bin/env bash
set -euo pipefail

TAP_NAME="${TAP_NAME:-v86tap0}"
NETWORK_NAME="${NETWORK_NAME:-default}"
TAP_ADDRESS="${TAP_ADDRESS:-10.77.0.1/24}"
NETWORK_CIDR="${NETWORK_CIDR:-10.77.0.0/24}"
GATEWAY_IP="${GATEWAY_IP:-10.77.0.1}"
DHCP_RANGE="${DHCP_RANGE:-10.77.0.10,10.77.0.200,255.255.255.0,12h}"
UPLINK="${UPLINK:-$(ip route show default | awk 'NR==1 {print $5}')}"
TAP_OWNER="${TAP_OWNER:-${SUDO_USER:-$(id -un)}}"
STATE_DIR="${STATE_DIR:-/run/v86net/$NETWORK_NAME}"
NFT_TABLE="v86_${NETWORK_NAME}"
PORT_FORWARDS="${PORT_FORWARDS:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (for example: sudo $0)" >&2
  exit 1
fi
if [[ -z "$UPLINK" ]]; then
  echo "could not determine uplink; set UPLINK explicitly" >&2
  exit 1
fi
if [[ ! "$NETWORK_NAME" =~ ^[a-zA-Z0-9_]{1,24}$ ]]; then
  echo "NETWORK_NAME must contain only letters, digits, and underscores" >&2
  exit 1
fi
for command in ip nft dnsmasq; do
  command -v "$command" >/dev/null || { echo "missing required command: $command" >&2; exit 1; }
done

mkdir -p "$STATE_DIR"
if ! ip link show "$TAP_NAME" >/dev/null 2>&1; then
  ip tuntap add dev "$TAP_NAME" mode tap user "$TAP_OWNER"
fi
ip address replace "$TAP_ADDRESS" dev "$TAP_NAME"
ip link set "$TAP_NAME" up

if [[ ! -f /run/v86net/ip_forward.previous ]]; then
  cat /proc/sys/net/ipv4/ip_forward > /run/v86net/ip_forward.previous
fi
sysctl -q -w net.ipv4.ip_forward=1

nft delete table ip "$NFT_TABLE" 2>/dev/null || true
nft add table ip "$NFT_TABLE"
nft "add chain ip $NFT_TABLE forward { type filter hook forward priority filter; policy drop; }"
nft "add chain ip $NFT_TABLE postrouting { type nat hook postrouting priority srcnat; policy accept; }"
nft "add chain ip $NFT_TABLE prerouting { type nat hook prerouting priority dstnat; policy accept; }"
nft add rule ip "$NFT_TABLE" forward iifname "$TAP_NAME" oifname "$UPLINK" accept
nft add rule ip "$NFT_TABLE" forward iifname "$UPLINK" oifname "$TAP_NAME" ct state established,related accept
nft add rule ip "$NFT_TABLE" postrouting oifname "$UPLINK" ip saddr "$NETWORK_CIDR" masquerade

# Explicit only: "2222:10.77.0.15:22/tcp,8080:10.77.0.15:80/tcp".
IFS=',' read -ra forwards <<< "$PORT_FORWARDS"
for mapping in "${forwards[@]}"; do
  [[ -z "$mapping" ]] && continue
  if [[ ! "$mapping" =~ ^([0-9]{1,5}):([0-9.]+):([0-9]{1,5})/(tcp|udp)$ ]]; then
    echo "invalid PORT_FORWARDS entry: $mapping" >&2
    exit 1
  fi
  host_port="${BASH_REMATCH[1]}" guest_ip="${BASH_REMATCH[2]}" guest_port="${BASH_REMATCH[3]}" protocol="${BASH_REMATCH[4]}"
  nft add rule ip "$NFT_TABLE" prerouting iifname "$UPLINK" "$protocol" dport "$host_port" dnat to "$guest_ip:$guest_port"
  nft add rule ip "$NFT_TABLE" forward iifname "$UPLINK" oifname "$TAP_NAME" ip daddr "$guest_ip" "$protocol" dport "$guest_port" accept
done

if [[ -f "$STATE_DIR/dnsmasq.pid" ]]; then
  old_pid="$(cat "$STATE_DIR/dnsmasq.pid")"
  kill "$old_pid" 2>/dev/null || true
fi
dnsmasq \
  --interface="$TAP_NAME" \
  --bind-interfaces \
  --except-interface=lo \
  --dhcp-range="$DHCP_RANGE" \
  --dhcp-option="option:router,$GATEWAY_IP" \
  --dhcp-option="option:dns-server,$GATEWAY_IP" \
  --pid-file="$STATE_DIR/dnsmasq.pid" \
  --leasefile-ro

printf 'TAP_NAME=%q\n' "$TAP_NAME" > "$STATE_DIR/config"
printf 'NFT_TABLE=%q\n' "$NFT_TABLE" >> "$STATE_DIR/config"
printf 'v86 network ready: name=%s tap=%s address=%s uplink=%s owner=%s\n' "$NETWORK_NAME" "$TAP_NAME" "$TAP_ADDRESS" "$UPLINK" "$TAP_OWNER"
