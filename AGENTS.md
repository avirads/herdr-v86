# AGENTS.md

This repository ships a 32-bit Alpine Linux guest running in v86. Coding agents
working in the guest should read `docs/guest-tools.md` before attempting network,
clipboard, file-transfer, GitHub, or AI operations.

## Guest environment

- Architecture: Linux i386/i586, not x86-64.
- Shell: BusyBox `sh`.
- Working directory for imported files: `/root`.
- Full IPv4 networking requires the external WebSocket-to-TAP gateway.
- Without that gateway, use the browser-backed `vm*` commands documented below.
- Browser-backed commands are host RPC operations, not normal Linux networking.

## Canonical command documentation

- `docs/guest-tools.md`: complete guest command reference and examples, including `vmllm`.
- `docs/deep-agent.md`: full Deep Agents tools, approvals, skills, and limits.
- `network/docs/host-bridge.md`: browser-bridge protocol, limits, and security.
- `network/README.md`: full IPv4 gateway deployment and testing.
- Run `<command> --help` inside the guest for concise local usage.

## Rules for agents

1. Use `vmfetch` instead of `curl` when the guest has no IP address or default
   route. Do not assume `vmfetch` bypasses CORS.
2. Use `curl` only when `ip route` shows working gateway-backed networking.
3. Use `vmexport FILE` to return a guest file to the browser download manager.
4. Files selected with the browser's **Import file** control appear in `/root`.
5. Use `vmclip read` or `vmclip write`; browser permission or a user gesture may
   still be required.
6. Never claim that `vmfetch`, WebRTC, or browser APIs provide DHCP, DNS, ICMP,
   SSH, arbitrary TCP/UDP, inbound ports, or a general-purpose NIC.
7. Never print, persist, or commit API tokens. Prefer narrow-scope, short-lived
   credentials and unset them after use.
8. Treat browser errors mentioning CORS, mixed content, forbidden headers, or
   permissions as browser policy failures—not guest DNS or TCP failures.
9. Respect limits: `vmfetch` responses are at most 16 MiB; browser imports and
   `vmexport` files are at most 8 MiB.
10. VM snapshots contain RAM and therefore may contain secrets. Do not save a
    snapshot while credentials remain in guest memory.
11. Use `vmllm` for the page-local WebGPU model. It runs in the browser host,
    not on the i386 guest, and requires a model loaded with **Configure LLM**.
12. The browser Deep Agents backend maps `/` to `/root/project`. Reads are
    automatic; file mutations and every shell command require browser approval.
13. Project-specific agent instructions belong in `/root/project/AGENTS.md` and
    skills in `/root/project/skills/NAME/SKILL.md`.

## Quick capability check

```sh
command -v vmfetch vmclip vmexport vmgithub vmai vmllm
ip route
vmfetch --help
```

If `ip route` has no default route, `curl`, `git clone`, `ssh`, and other normal
network clients cannot reach the Internet. Use the documented browser-backed
commands or ask the user to deploy/configure the external gateway.
