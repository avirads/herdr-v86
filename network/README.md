# v86 network gateway

This component gives the VM guest a normal IPv4 network by transporting raw
Ethernet frames over an authenticated binary WebSocket to a Linux TAP or a
native Windows Wintun adapter. The host supplies routing, connection tracking,
and NAT; the Windows backend also supplies the Ethernet, ARP, and DHCP shim
needed by Wintun's layer-3 interface.
TLS remains end-to-end between applications in the guest and internet hosts.

It is independent of the AutoBro Chrome extension. The page hosting v86 is
the WebSocket client; the guest uses v86's emulated NE2000 or VirtIO NIC.

## Data path

```text
guest TCP/IP -> v86 NIC -> net0-send -> WSS -> Go gateway -> TAP
             <- net0-receive <- WSS <-              <- Linux NAT
```

On Windows, `TAP` in this diagram is the Herdr Wintun adapter and WinNAT.

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

`deploy/Caddyfile`, `deploy/nginx-gateway.conf`,
`deploy/v86net-network.service`, and `deploy/v86net-gateway.service` provide
hardened TLS and systemd examples. The reverse proxy exposes only the Ethernet
WebSocket and health endpoint; session creation remains loopback-only for a
trusted backend.

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

## Native Windows gateway (Wintun)

Windows 10/11 x64 is supported without WSL. Setup needs Administrator rights
once because Windows restricts adapter, route, WinNAT, and scheduled-task
configuration. The installed gateway then runs as a background SYSTEM task,
so opening Herdr and using the VM does not show UAC prompts. It listens on
loopback by default and accepts only the configured browser origin and token.

Download `downloads/v86net-gateway-windows-amd64.exe`, then run an Administrator
PowerShell from the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\network\scripts\setup-windows.ps1 `
  -GatewayExe .\downloads\v86net-gateway-windows-amd64.exe
```

The installer downloads Wintun 0.14.1 from the official WireGuard site,
requires a valid WireGuard Authenticode signature, creates a random browser
and admin token, registers the `HerdrV86Gateway` startup task, assigns
`10.77.0.1/24`, and creates a narrowly scoped `HerdrV86` WinNAT network.
Connection details are written to
`C:\ProgramData\HerdrV86\connection.json`.

For a page served over plain HTTP on the same PC, use the generated
`ws://127.0.0.1:8086/v1/ethernet` address. A page served over HTTPS (including
GitHub Pages) cannot open an insecure WebSocket. Supply a trusted certificate
and key with `-TlsCertificate` and `-TlsPrivateKey`, or put a local/reachable
TLS reverse proxy in front of the loopback gateway. The hostname in the WSS
URL must match that certificate.

Remove the task and NAT configuration with:

```powershell
.\network\scripts\teardown-windows.ps1
```

Add `-RemoveInstalledFiles` to also delete the installed gateway files. The
Windows backend currently supports one VM on the fixed `10.77.0.0/24` IPv4
network. It implements DHCP, ARP, TCP, UDP, ICMP, DNS, HTTPS, and other normal
outbound IPv4 traffic through Windows NAT. IPv6 and inbound forwarding are not
implemented on this backend.

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

The guest should use DHCP. A static fallback is (Windows uses DNS `1.1.1.1`):

```text
address: 10.77.0.15/24
gateway: 10.77.0.1
DNS:     10.77.0.1
```

## Create a browser session

The admin token is server-side only. A trusted application backend creates an
origin-bound, short-lived browser session:

Install the included convenience command on the gateway once:

```bash
sudo install -m 0755 scripts/v86net-token /usr/local/bin/v86net-token
```

It creates a one-hour session and prints a ready-to-open VM URL without
displaying the server's admin token:

```bash
sudo v86net-token
```

An optional first argument selects the lifetime in seconds (maximum 3600), and
an optional second argument selects the exact browser origin:

```bash
sudo v86net-token 900 https://avirads.github.io
```

The equivalent raw API request is:

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
- `../../vm-network-ext4.img`: Alpine x86 image with automatic DHCP,
  CA certificates, and curl/OpenSSL supporting HTTPS, HTTP/2, WSS, and common
  network protocols. The image also includes tmux 3.5a, Zerostack 1.5.0, and
  the purpose-built Rig 0.40.0 coding agent. Zellij and OpenDev are not embedded
  in the base image.
- `guest/build-zellij-x86.sh` builds the version-pinned Zellij package in an
  isolated Alpine x86 environment. It requires root for the x86 chroot and can
  take around 15–20 minutes with release link-time optimization.
- `guest/build-zerostack-x86.sh` builds the minimal Zerostack 1.5.0 package in
  the same isolated Alpine x86 environment. It retains core tools and loops
  while excluding the heavier optional orchestration features. The matching
  upstream GPL-3.0 source archive is included beside the binary package.
- `guest/build-rig-agent-x86.sh` reproducibly builds the static i386 Rig agent
  from the version-pinned source archive included beside its binary package.
- `guest/build-kernel.sh` and `guest/build-network-image.sh` reproduce the
  kernel and guest image.

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

Implemented by the Linux and Windows host paths: DHCP, DNS, IPv4 TCP, UDP,
ICMP, NAT, HTTPS, SSH, package managers, and outbound connections from
unmodified guest applications.

Not yet implemented: IPv6, multiple VMs per gateway process, WebRTC transport,
bandwidth quotas, and userspace NAT for an unprivileged/cloud gateway. Linux
has explicit inbound forwarding; Windows does not. Physical-LAN bridging is
deliberately excluded.
