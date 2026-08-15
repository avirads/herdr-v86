# AGENTS.md

This repository ships a 32-bit Alpine Linux guest running in v86, and is being
extended with a second VM provider, CheerpX. Coding agents working in the guest
should read `docs/guest-tools.md` before attempting network, clipboard,
file-transfer, GitHub, or AI operations.

## Repository layout

The tree is organised around the VM-provider seam:

- `providers/v86/` — v86 guest client, host bridge, and network adapters.
- `providers/cheerpx/` — the CheerpX provider (not implemented yet).
- `providers/provider-registry.js` — plain-data manifest of providers and their
  capabilities. Describes a provider without importing its runtime.
- `shared/` — provider-neutral modules: the LLM provider router, LiteRT client,
  WebRTC remote peer, agent controller, AutoBro client, WebGPU client.
- `images/v86/` — v86 disk images and `vm-images.json`.
- `images/cheerpx/` — CheerpX ext2 images and `cx-images.json` (not built yet).
- `agent/` — the agent tiers. Consumes the guest-client contract, not a
  specific provider.

Rules that follow from this layout:

1. Anything a second provider would also need belongs in `shared/`, not under
   `providers/v86/`.
2. The guest client contract is `list`, `read`, `write`, `delete`, `glob`,
   `grep`, `execute`, `test`, `setWorkspace`. Do not change its shape without
   updating every provider — `agent/` depends on it exclusively.
3. There is one LLM provider router (`shared/llm-provider-router.js`). Do not
   add a second router, provider list, or secret store for a new provider.
4. The root `package.json` deliberately omits `"type": "module"`. Setting it
   would reinterpret every untyped `.js` in the tree as ESM. Use `.mjs` for new
   Node-side scripts.
5. `IMPLEMENTATION-PLAN.md` is the working brief for the CheerpX integration.

## Deployment policy

- Production deployment is `https://fapstaff.com/`.
- GitHub Pages for this repository is intentionally disabled by owner request.
- Do not enable, trigger, rebuild, or deploy GitHub Pages, including through
  the Pages API or Actions, until the user explicitly says to resume GitHub
  Pages deployment.
- Pushing source changes to GitHub does not authorize a GitHub Pages
  deployment. Deploy website changes only to fapstaff.com unless the user
  explicitly changes this policy.
- Before every push or release, run
  `bash network/guest/verify-runtime-inventory.sh` against the built images and
  keep `docs/runtime-inventory.md` synchronized in the same commit. Treat the
  image files—not documentation or build scripts—as the source of truth for
  installed guest packages and executables.

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
- Internet access requires either the AutoBro per-user userspace helper or the
  external WebSocket gateway. TAP/Wintun is only an optional native
  high-performance backend.
- A LAN between the guest and the browser tab does **not** need a gateway: in
  the `local` and `hybrid` network modes the page holds an address on the
  guest's subnet (`10.77.0.1` and `10.77.0.2` respectively) and ordinary
  sockets work to it. `local` mode has no internet regardless.
- Without a gateway, use `vmlan` (sockets, no size cap) or the serial
  browser-backed `vm*` commands documented below.
- Browser-backed commands are host RPC operations, not normal Linux networking.
  This is true of `vmlan` too: it moves over real sockets, but the browser still
  performs each request, so CORS applies and TLS cannot be tunnelled.

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
2. Use `curl` only when `ip route` shows working gateway-backed networking, or
   when the target is the browser's own LAN service (see rule 7).
3. Use `vmexport FILE` to return a guest file to the browser download manager,
   or `vmlan export FILE` when `vmlan status` succeeds — the latter has no
   8 MiB cap and is far faster.
4. Files selected with the browser's **Import file** control appear in `/root`.
5. Use `vmclip read` or `vmclip write`; browser permission or a user gesture may
   still be required.
6. Never claim that `vmfetch`, WebRTC, or browser APIs provide DHCP, DNS, ICMP,
   SSH, arbitrary TCP/UDP, inbound ports, or a general-purpose NIC to the
   *Internet*. The in-page tcpip.js transport does provide DHCP, ICMP, and
   arbitrary TCP/UDP **within** the guest-to-browser LAN; it provides no egress.
7. Run `vmlan status` to detect the browser's LAN services. When present,
   `eval "$(vmlan env)"` points `http_proxy` at the page, so unmodified `curl`,
   `wget`, and `apk` work for plain HTTP. HTTPS is not proxied — a browser
   cannot tunnel TLS — so use `vmlan fetch <https url>` instead.
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

A default route pointing at the browser tab rather than a gateway (`local`
network mode) reaches the tab and nothing beyond it: `vmlan` and `http_proxy`
work, `git clone` and `ssh` to the Internet do not.
