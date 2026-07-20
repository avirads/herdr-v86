# v86 network gateway

This component gives the herdr v86 guest a normal IPv4 network by transporting raw
Ethernet frames over an authenticated binary WebSocket to a Linux TAP
interface. Linux supplies DHCP, DNS, routing, connection tracking, and NAT.
TLS remains end-to-end between applications in the guest and internet hosts.

It is independent of the AutoBro Chrome extension. The page hosting v86 is
the WebSocket client; the guest uses v86's emulated NE2000 or VirtIO NIC.

## Data path

```text
guest TCP/IP -> v86 NIC -> net0-send -> WSS -> Go gateway -> TAP
             <- net0-receive <- WSS <-              <- Linux NAT
```

Each binary WebSocket message contains exactly one Ethernet frame. Text
messages and frames shorter than an Ethernet header are ignored. The gateway
allows one VM per TAP interface and limits messages to 65,535 bytes.

## Secure Linux gateway setup

Requirements: Linux, Go 1.24+, `iproute2`, `nftables`, and `dnsmasq`.

```bash
cd web-bridge/v86-network
sudo ./scripts/setup-linux.sh
export V86NET_ADMIN_TOKEN="$(openssl rand -hex 32)"
go run ./cmd/v86net-gateway -listen 127.0.0.1:8086 -tap v86tap0
```

For a browser on another machine, terminate TLS in Caddy/nginx and proxy a
public `wss://` endpoint to `127.0.0.1:8086`. Do not expose unencrypted `ws://`
over a network. Restrict the browser origin in production:

```bash
go run ./cmd/v86net-gateway \
  -listen 127.0.0.1:8086 \
  -tap v86tap0 \
  -allow-origin https://vm.example.com
```

`deploy/Caddyfile` and `deploy/v86net-gateway.service` provide hardened TLS
and systemd examples. Caddy exposes only the Ethernet WebSocket and health
endpoint; session creation remains loopback-only for a trusted backend.

The setup creates `10.77.0.0/24`, assigns `10.77.0.1` to the gateway, offers
DHCP leases at `10.77.0.10-200`, forwards DNS, and installs a dedicated nftables
table named `v86net`. Remove only those resources with:

```bash
sudo ./scripts/teardown-linux.sh
```

### Multiple isolated VMs

Run one gateway process per named TAP/subnet. Each instance gets a separate
TAP, dnsmasq process, nftables table, session store, counters, and egress
policy:

```bash
sudo NETWORK_NAME=vm2 TAP_NAME=v86tap2 \
  TAP_ADDRESS=10.78.0.1/24 NETWORK_CIDR=10.78.0.0/24 \
  GATEWAY_IP=10.78.0.1 DHCP_RANGE=10.78.0.10,10.78.0.200,255.255.255.0,12h \
  ./scripts/setup-linux.sh

V86NET_ADMIN_TOKEN=... ./v86net-gateway \
  -listen 127.0.0.1:8087 -tap v86tap2 -guest-network 10.78.0.0/24
```

### Explicit inbound forwarding

No guest port is exposed by default. Configure exact mappings during setup:

```bash
sudo PORT_FORWARDS='2222:10.77.0.15:22/tcp,8080:10.77.0.15:80/tcp' \
  ./scripts/setup-linux.sh
```

The scripts intentionally do not run automatically.

## Browser integration

Create v86 without its built-in network relay, then attach the adapter after
constructing the emulator:

```js
import { V86WebSocketNetwork } from './browser/v86-websocket-network.js';

const emulator = new V86({
  wasm_path: '/v86.wasm',
  bios: { url: '/seabios.bin' },
  vga_bios: { url: '/vgabios.bin' },
  cdrom: { url: '/linux.iso' },
  autostart: true,
});

const network = new V86WebSocketNetwork(emulator, {
  url: 'wss://gateway.example.com/v1/ethernet',
  token: sessionToken,
}).start();
```

The adapter uses v86's public `net0-send` listener and `net0-receive` bus
event. It bounds its disconnected-send queue to 1 MiB and reconnects after a
transport failure. Reconnection does not preserve existing guest TCP sessions.

The guest should use DHCP. A static fallback is:

```text
address: 10.77.0.15/24
gateway: 10.77.0.1
DNS:     10.77.0.1
```

## Create a browser session

The admin token is server-side only. A trusted application backend creates an
origin-bound, short-lived browser session:

```bash
curl -X POST http://127.0.0.1:8086/v1/sessions \
  -H "Authorization: Bearer $V86NET_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"origin":"http://127.0.0.1:8090","ttlSeconds":300}'
```

Pass the returned token to the static demo in a URL fragment. Fragments are not
sent to the static server and the demo removes it from browser history:

```text
http://127.0.0.1:8090/#gateway=ws%3A%2F%2F127.0.0.1%3A8086%2Fv1%2Fethernet&token=<token>
```

Authentication is transported in `Sec-WebSocket-Protocol`, not the URL query
string. Sessions expire while connected, can be revoked with
`DELETE /v1/sessions/<id>`, and optionally bind to the exact browser Origin.
Use WSS behind Caddy/nginx outside localhost.

By default, guest access to loopback, RFC1918 networks outside its own subnet,
link-local/cloud-metadata addresses, CGNAT, and multicast destinations is
blocked. `-allow-private-egress` is an explicit trusted-environment override.
The default combined traffic quota is 1 GiB per session. `/health` returns JSON
statistics and `/metrics` exposes Prometheus counters. The browser adapter
batches Ethernet frames for fewer JS/WebSocket transitions while the gateway
continues accepting the original one-frame format.

For UDP/QUIC-sensitive deployments, `browser/v86-datachannel-network.js`
provides an optional WebRTC DataChannel data plane; see `docs/webrtc.md`.

## Guest artifacts

- `../../bzImage-network`: Linux 6.6 i386 kernel with v86-compatible no-APIC
  boot parameters and built-in VirtIO/NE2000 networking.
- `../../herdr-vm-network-ext4.img`: Alpine x86 image with automatic DHCP,
  CA certificates, and curl/OpenSSL supporting HTTPS, HTTP/2, WSS, and common
  network protocols.
- `guest/build-kernel.sh` and `guest/build-network-image.sh` reproduce them.

## Automated verification

On a privileged Linux host with Chrome, Node, Go, TUN/TAP, nftables, and
dnsmasq:

```bash
sudo ./test/run-e2e-linux.sh
```

The test boots the real project image in headless Chrome and requires DHCP,
default route, DNS, ICMP, and `curl -I https://example.com` to pass.

## Verification inside the guest

```bash
ip address
ip route
cat /etc/resolv.conf
ping -c 2 10.77.0.1
ping -c 2 1.1.1.1
nslookup example.com
curl -I https://example.com
```

## Current scope

Implemented by the Linux kernel path: DHCP, DNS, IPv4 TCP, UDP, ICMP, NAT,
HTTPS, SSH, package managers, and outbound connections from unmodified guest
applications.

Not yet implemented: IPv6, inbound port-forward configuration, multiple VMs
per gateway process, WebRTC transport, bandwidth quotas, and userspace NAT for
an unprivileged/cloud gateway. Physical-LAN bridging is deliberately excluded.
