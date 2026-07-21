# Portable Windows x64 release

The portable release contains the VM application, a pinned Chrome for Testing,
the unpacked AutoBro extension, Moonshine voice assets, the LiteRT-LM runtime,
the Gemma 4 E2B WebGPU model, the 32-bit `herdr` command, and both userspace and
native Windows gateways. The guest boots to its normal shell; run `herdr`
explicitly when wanted.

Run `run-vm.bat` after extracting the ZIP. Startup presents these modes:

1. Local userspace gateway (normal user, no installation)
2. Remote full gateway (default)
3. Native Wintun gateway (one-time Administrator setup)
5. Offline

Remote mode defaults to `wss://gateway.fapstaff.com/v1/ethernet` and prompts for
an origin-bound short-lived session token on every launch. The token is passed
in a URL fragment, removed from browser history immediately by the page, and is
never written to `vm-portable.json`.

Userspace mode supplies DHCP, DNS, TCP, UDP, HTTPS, SSH, Git and package-manager
traffic through ordinary Windows sockets. It runs without Wintun or elevation.
External ICMP and raw IP protocols are not forwarded; gateway ping works.

For native mode, run `setup-network.bat` once and approve UAC. This installs the
signed bundled Wintun component, WinNAT configuration, and a SYSTEM startup task.
Normal launches after setup do not elevate.

## Reproducible build

Place `gemma-4-E2B-it-web.litertlm` at `D:\zero` and run:

```powershell
cd portable
.\build-windows.ps1
```

The build refuses a model whose SHA-256 differs from
`3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`.
Use `-ModelPath` to select the same verified file at another location.
