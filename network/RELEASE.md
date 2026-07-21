# VM full IPv4 gateway

This is the host-side gateway for VM's v86 VM. It carries Ethernet frames
between the browser and a native host interface, giving unmodified guest tools
such as `curl`, package managers, DNS clients, and `ping` normal outbound IPv4
connectivity.

## Windows x64

Extract the Windows ZIP. In an Administrator PowerShell, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-windows.ps1 -GatewayExe .\v86net-gateway-windows-amd64.exe
```

Administrator access is required once to create Wintun, configure WinNAT and
IP forwarding, and register the startup task. Normal VM use afterward does
not require elevation. The included `wintun.dll` is the official signed amd64
runtime; the installer verifies its Authenticode signature before installing.

Connection information is written to
`C:\ProgramData\HerdrV86\connection.json`. Run `teardown-windows.ps1` as
Administrator to remove the task and NAT configuration.

## Linux x64

Extract the Linux archive, then run:

```bash
sudo bash ./setup-linux.sh
export V86NET_ADMIN_TOKEN="$(openssl rand -hex 32)"
./v86net-gateway-linux-amd64 -listen 127.0.0.1:8086 -tap v86tap0
```

Root is required once for TAP, nftables/NAT, forwarding, and dnsmasq. The
gateway process can subsequently run as the TAP owner. Use
`sudo bash ./teardown-linux.sh` to remove the host network configuration.

## Browser security

Plain `ws://127.0.0.1` works only with a locally HTTP-served VM page. An
HTTPS page, including GitHub Pages, requires a trusted `wss://` certificate or
a TLS reverse proxy. Keep the gateway loopback-bound unless you deliberately
configure TLS, authentication, firewalling, and an allowed browser origin.
