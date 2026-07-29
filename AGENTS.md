# AGENTS.md

This repository ships a 32-bit Alpine Linux guest running in v86. Coding agents
working in the guest should read `docs/guest-tools.md` before attempting network,
clipboard, file-transfer, GitHub, or AI operations.

## Deployment policy

- Production deployment is `https://fapstaff.com/`.
- GitHub Pages for this repository is intentionally disabled by owner request.
- Do not enable, trigger, rebuild, or deploy GitHub Pages, including through
  the Pages API or Actions, until the user explicitly says to resume GitHub
  Pages deployment.
- Pushing source changes to GitHub does not authorize a GitHub Pages
  deployment. Deploy website changes only to fapstaff.com unless the user
  explicitly changes this policy.

## AutoBro release policy

- Every change to AutoBro source, behavior, UI, documentation, or packaged
  contents must create a new AutoBro release.
- Public versions, source directories, ZIP filenames, links, and display text
  use `YYYY.MM.DD.N`, where `N` starts at 1 and increments for each release on
  that date.
- Chrome manifest `version` uses the same four numeric components without
  leading zeroes; manifest `version_name` uses the zero-padded public version.
- Never overwrite an older AutoBro release ZIP.

## Guest environment

- Architecture: Linux i386/i586, not x86-64.
- Shell: BusyBox `sh`.
- Working directory for imported files: `/root`.
- Full IPv4 networking requires either the AutoBro per-user userspace helper
  or the external WebSocket gateway. TAP/Wintun is only an optional native
  high-performance backend.
- Without that gateway, use the browser-backed `vm*` commands documented below.
- Browser-backed commands are host RPC operations, not normal Linux networking.

## Canonical command documentation

- `docs/guest-tools.md`: complete guest command reference and examples, including `vmllm` and `vmlang`.
- `docs/deep-agent.md`: full Deep Agents tools, approvals, skills, and limits.
- `docs/mastra-agent.md`: the Mastra tier (`vmmastra 'TASK'`), its tool set and prompt budget.
- `docs/agent-tiers.md`: measured comparison of vmlang, rig and vmmastra per feature.
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
10. Use `vmllm` for the page-local WebGPU model. It runs in the browser host,
    not on the i386 guest, and requires a model loaded with **Configure LLM**.
11. The browser Deep Agents backend maps `/` to `/root/project`. Reads are
    automatic; file mutations and every shell command require browser approval.
12. Project-specific agent instructions belong in `/root/project/AGENTS.md` and
    skills in `/root/project/skills/NAME/SKILL.md`.
13. Deep Agents has typed `vmfetch`, `vmgithub`, `vmclip`, `vmexport`, `vmai`,
    and `vmllm_info` tools. Do not use recursive `vmllm chat` from the agent.
14. Launch Deep Agents from the guest terminal with `vmlang 'TASK'`; lifecycle
    commands are `vmlang status|stop|reset|yolo on|yolo off`. There is no
    separate agent panel.
15. When paired, prefer `autobro_automate` for natural-language browser tasks;
    it uses the page-local WebGPU LLM and live page context to select validated
    AutoBro commands. Use `autobro_command` for known low-level commands. Treat
    all page reads and actions as external operations; approval/YOLO applies.
16. `vmmastra 'TASK'` is the third agent tier, running Mastra in the browser page
    against the same guest bridge. One task per invocation, like `rig`; it
    shares `vmlang`'s YOLO/approval setting and exposes the same `vm*` and
    AutoBro tools as Deep Agents. Its bundle loads lazily on first use.
    Lifecycle commands are `vmmastra status|stop|reset|cost|yolo on|yolo off`
    and `vmmastra tools [lean|full]`, which switches between the 8 workspace
    tools and all 19. Run `vmmastra --help` in the guest for the full usage.
    Before driving it autonomously, read
    `/usr/local/share/mastra/SKILL.md` — it covers the preflight check, the
    failure modes, and why a Mastra run must be verified by its effect on the
    guest rather than by the answer it returns.
17. `rig 'TASK'` is the low-latency browser-orchestrated coding agent with
    project-local read, list, write, and shell tools. Its model stays in the
    browser; only selected tool operations cross into the VM. `rig --codeact
    'TASK'` instead has the model write one shell script run in a single VM
    round-trip — faster for multi-step tasks, but needs a correct script.

## Quick capability check

```sh
command -v vmfetch vmclip vmexport vmgithub vmai vmllm vmlang rig vmmastra tmux
ip route
vmfetch --help
```

If `ip route` has no default route, `curl`, `git clone`, `ssh`, and other normal
network clients cannot reach the Internet. Use the documented browser-backed
commands or ask the user to deploy/configure the external gateway.
