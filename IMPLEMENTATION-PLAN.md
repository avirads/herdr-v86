# vmbro — CheerpX Provider Integration Plan

Adding CheerpX as a second VM provider alongside v86, hosted in the `avirads/vmbro`
repository. Written to be handed directly to a coding agent as a working brief.

---

## 1. Goal

`avirads/herdr-v86` runs a 32-bit Alpine Linux guest in the browser under **v86**,
with a browser-hosted LLM stack (local LiteRT-LM WebGPU + cloud providers), three
coding-agent tiers, a browser bridge for network/clipboard/file operations, and a
"dev" image tier that boots a full-stack app into an IDE iframe.

`avirads/vmbro` becomes the home of the whole solution and gains a second VM
provider, **CheerpX** (Leaning Technologies' x86-to-WebAssembly JIT), delivering a
BrowserPod/BrowserCode-style experience: real Debian userland, a proper IDE, and
instant live previews — while reusing herdr's existing LLM provider abstraction
rather than introducing a new one.

**Explicitly out of scope:** BrowserCode's coding-agent templates and functions
(Claude Code / Gemini CLI integration). vmbro uses its own agent tiers and its own
LLM provider router. BrowserPod/BrowserCode are UX references only — no code,
templates, or agent scaffolding from them.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Repo strategy | Migrate herdr-v86 into vmbro and **restructure**; provider-neutral naming; `providers/v86/` + `providers/cheerpx/`. herdr-v86 frozen as history. |
| 2 | CheerpX guest image | **Custom Debian ext2** built from a Dockerfile, with herdr's `vm*` guest tools ported onto it. |
| 3 | UX target | Mirror the **existing v86 "dev" image experience** (boot → READY marker → IDE), not a from-scratch BrowserCode clone. |
| 4 | Networking | **Browser-bridge only** (vmfetch-style) in phase 1. No Tailscale. |
| 5 | Cross-origin isolation | **Isolate CheerpX on its own route** (`/cx/`) with its own COOP/COEP headers. `index.html` untouched. |
| 6 | Agent tiers | **Deferred to phase 2.** Phase 1 ships terminal + IDE + LLM chat. |
| 7 | Live preview | **Service-worker portal URLs** proxying into the guest. |
| 8 | CheerpX runtime | **npm package + local build step**, pinned version. ⚠️ see §10 licensing. |

### 2.1 Tie-break rule for divergences

Where this plan presents alternatives, or where a spike's outcome forces a choice,
**take the most performant option that preserves compatibility with the existing
guest-client contract (§3.1) and the v86 provider's behaviour.** Compatibility is
the constraint; performance is the objective function within it. Concretely:

- Never break the nine-method contract or the `execute()` wire shape to gain speed —
  that would strand `agent/`, which is the whole reason phase 4 is cheap.
- Never regress the v86 page to simplify the CheerpX page.
- Given two contract-preserving designs, choose the one with fewer round-trips and
  no artificial pacing.
- Prefer a fast path with a correct fallback over a uniformly slow path. Implement
  the fast path first, gate it on a runtime capability probe, and fall back
  automatically — do not ship the slow path as the default "to be safe".

Each fork below names its **primary** and its **fallback**, and the probe that
selects between them at runtime.

---

## 3. Architecture findings (the integration is smaller than it looks)

Two load-bearing discoveries from reading the herdr-v86 source. Both mean CheerpX
support is mostly *additive*, not a rewrite.

### 3.1 The VM-provider seam already exists

`providers/v86/guest-client.js` is a **93-line class** exposing exactly
nine methods:

```js
list(path = '.')            // -> "type\tpath\tsize" lines
read(path)                  // -> string
write(path, content)        // -> void
delete(path)                // -> void
glob(pattern, path = '.')   // -> same shape as list()
grep(pattern, path = '.')   // -> "path:line:text" lines
execute(command)            // -> "__V86AGENT_EXIT__<n>\n<output>"
test(recipe)
setWorkspace(path)
```

Every downstream consumer depends on **only this interface**:

- `agent/src/guest-backend.js` — `V86DeepAgentsBackend` (vmlang / Deep Agents)
- `agent/src/v86-workspace.js` — `V86Filesystem` / `V86Sandbox` (Mastra)
- `shared/vmagent-controller.js` — `VmAgentController` (via `getGuest`)
- `rig` and its `--codeact` mode

`v86-workspace.js` even documents the contract in its header comment. So a
`CheerpXGuestClient` implementing those nine methods drops into the entire agent
stack unchanged. **This is why agent tiers can be safely deferred to phase 2: build
the client to contract in phase 1 and phase 2 becomes wiring, not porting.**

### 3.2 The LLM layer is already provider-agnostic

`shared/llm-provider-router.js` (`LlmProviderRouter`) already abstracts:

- `local` → injected via `getLocalClient()` (LiteRT-LM WebGPU, page-local)
- `openai` / `compatible` / `anthropic` / `gemini` → `CloudLlmClient`, normalising
  all three wire formats to an OpenAI-shaped `{choices:[{message}]}` response
- per-agent defaults (`vmvm.llm.agentDefaults`), per-session provider binding with
  rebinding protection, and secret storage split across `localStorage` /
  `sessionStorage`

**No changes are required to satisfy the "reuse the baked-in LLM functionality"
constraint.** The router is consumed through `V86HostBridge`'s `llmResolver`, which
is itself provider-neutral. The only work is renaming the v86-specific *host bridge*
that calls it, and giving the CheerpX page its own bridge instance pointed at the
same router.

### 3.3 CheerpX needs no serial protocol

This is the main design simplification. v86's guest client tunnels an RPC over a
115200-baud UART, which forces base64 framing, 1-byte-at-a-time pacing with a 1 ms
sleep per byte, 64-byte reply chunking, and an ACK/retry layer. CheerpX needs none
of it:

| Need | v86 | CheerpX |
|---|---|---|
| Run a command | serial RPC + `__V86AGENT_EXIT__` marker parsing | `cx.run("/bin/bash", ["-c", cmd])` → resolves `{ status }` |
| Exit code | parsed from marker | **returned directly** as `status` |
| Host → guest file | serial write RPC | `dataDevice.writeFile(path, content)` |
| Guest → host file | serial read RPC, base64, chunked | `idbDevice.readFileAsBlob(path)` |
| Throughput ceiling | ~11.5 KiB/s | memory-speed |

`cx.run()` signature (pinned at `@leaningtech/cheerpx` 1.3.7; the docs' CDN
examples are on the older 1.2.x `cx.js`):

```ts
async run(
  fileName: string,
  args: string[],
  options?: { env?: string[]; cwd?: string; uid?: number; gid?: number }
): Promise<{ status: number }>
```

So `execute()` becomes: redirect stdout/stderr to files on a JS-readable device,
`await cx.run(...)`, read the two files back, return. No markers, no ACKs, no
pacing. The `V86Sandbox` stderr-splitting and `prefetchMaxBytes` round-trip
optimisations (which exist purely to fight the UART) can be dropped for CheerpX.

> **Compatibility note:** `execute()` must still *return* the
> `"__V86AGENT_EXIT__<n>\n<output>"` string shape in phase 1, because
> `splitExitMarker()` in `v86-workspace.js` and `guest-backend.js` parse it. Keep
> the wire shape, synthesise the marker from `status`. Normalising the contract to
> `{ exitCode, stdout, stderr }` across both providers is a phase-3 cleanup.

### 3.4 ~~Known unknown~~ RESOLVED — `cx.run()` concurrency

> **Answered by S-1 (§5.1b): concurrent `run()` works and is truly parallel.**
> Build design A. Design B (mutex + console sentinels) is retired — do not
> implement it. The rest of this section is kept for the reasoning.

The CheerpX docs do **not** state whether concurrent `run()` calls are supported.
The interactive terminal is itself a long-lived `cx.run("/bin/bash", ["--login"])`.
Resolved by spike S-1, but the *design is already decided* per §2.1 — build A, probe
at boot, fall back to B automatically:

- **A — primary (performant).** Concurrent `run()` works → each command is its own
  short-lived process. No shared-console contention, no sentinel parsing, no mutex,
  true parallelism between agent work and the user's terminal. Exit code comes back
  as `status` directly.
- **B — automatic fallback (compatible).** Single-process only → drive commands
  through the interactive shell using sentinel markers over `setCustomConsole`,
  serialised behind a mutex. Mirrors today's v86 approach, known to work, but
  couples agent activity to the visible terminal and serialises everything.

**Both paths return the identical `execute()` wire shape**, so nothing downstream
can observe which is active. Implement the probe as a one-shot at runtime init:
attempt a trivial concurrent `cx.run("/bin/true", [])` while the login shell is
live; on rejection, latch to B for the session and surface it in diagnostics
(`#diagnostics-status`) so the degradation is visible rather than silent.

---

## 4. Target repository structure

```
vmbro/
├─ index.html                     # v86 provider page (unchanged behaviour)
├─ cx/
│  └─ index.html                  # CheerpX provider page — cross-origin isolated
├─ providers/
│  ├─ provider-registry.js        # NEW: manifest of providers + capabilities
│  ├─ v86/
│  │  ├─ guest-client.js          # was providers/v86/guest-client.js
│  │  ├─ host-bridge.js           # was providers/v86/host-bridge.js
│  │  ├─ autobro-network.js
│  │  └─ websocket-network.js
│  └─ cheerpx/
│     ├─ runtime.js               # NEW: CheerpX boot, devices, mounts
│     ├─ guest-client.js          # NEW: the nine-method contract
│     ├─ host-bridge.js           # NEW: vm* RPC handlers, reuses llmResolver
│     ├─ terminal.js              # NEW: setCustomConsole <-> xterm
│     ├─ portal-sw.js             # NEW: service-worker preview proxy
│     └─ workspace.js             # phase 2: Mastra FS/Sandbox for CheerpX
├─ shared/
│  ├─ llm-provider-router.js      # moved, UNCHANGED logic
│  ├─ litert-lm-client.js         # moved
│  ├─ remote-llm-peer.js          # moved
│  └─ vmagent-controller.js       # moved
├─ agent/                         # unchanged; consumes the guest contract
├─ images/
│  ├─ v86/                        # existing .img tiers + images/v86/vm-images.json
│  └─ cheerpx/
│     ├─ Dockerfile.debian-vmbro  # NEW: guest image source
│     ├─ build-ext2.sh            # NEW
│     └─ cx-images.json           # NEW: manifest mirroring images/v86/vm-images.json
├─ network/                       # gateway, guest tools, tests (largely as-is)
├─ docs/
└─ package.json                   # NEW at root: @leaningtech/cheerpx + build
```

**Naming rule:** modules that serve both providers lose the `v86` prefix and move
to `shared/`. Modules that are genuinely v86-specific keep their behaviour and move
under `providers/v86/`. Do not rename anything inside `agent/` — `V86Filesystem`,
`V86Sandbox`, and `V86DeepAgentsBackend` are consumers of the contract, and renaming
them is churn with no benefit until §3.3's contract cleanup lands.

---

## 5. Spikes (do these first — they gate design)

Each spike selects between an already-designed **primary** (fast) and **fallback**
(compatible) per §2.1. The spike does not decide the architecture — it decides which
branch latches at runtime. Build both; probe once at init.

| ID | Question | Primary (build this) | Fallback (auto-latch) | Method |
|---|---|---|---|---|
| ~~**S-1**~~ **RESOLVED** | Concurrent `cx.run()` while interactive bash is live? | ✅ **Per-command isolated process — and it is truly parallel** | ~~mutex + sentinels~~ not needed | `network/test/cx-guest-spike-e2e.html` |
| ~~**S-2**~~ **RESOLVED** | Can `readFileAsBlob()` read guest-written files? | ✅ **Direct `idbOut.readFileAsBlob()`, device-relative path** | ~~`base64 -w0`~~ not needed | same harness |
| ~~**S-3**~~ **RESOLVED** | Socket-level portal without a TCP stack? | ❌ **impossible** — no network stack, every bind fails | ✅ **static mirror in Cache Storage** — shipped | §5.1c |
| ~~**S-4**~~ **RESOLVED** | Does COEP `require-corp` break LiteRT fetch/OPFS? | ✅ **`require-corp` — confirmed, use it** | ~~`credentialless`~~ not needed | `network/test/cx-isolation-{e2e.html,runner.mjs}` |

**S-3 is expected to fail, and the plan assumes it does.** With browser-bridge-only
networking (decision 4) there is no TCP stack in the guest, so a service worker
cannot `fetch()` a guest port. Therefore the **static-export mirror is the phase-1
default**, not a contingency: the guest build writes to a directory, the host mirrors
it via the guest client, and the service worker serves those bytes from an in-memory
`Map`. That is both the compatible option *and* — since it serves from memory with no
per-request guest round-trip — the faster one for the read-heavy preview workload. A
socket portal is a phase-3 goal that realistically requires Tailscale or the gateway.

### 5.1 S-4 result (resolved)

Run with `node network/test/cx-isolation-runner.mjs 8088 require-corp`, which serves
the tree twice from one origin — plain at `/`, COOP+COEP at `/cx/` — so only the
headers differ.

Under `require-corp`, **all 11 checks pass, zero failures**:

| | plain `/` | isolated `/cx/` |
|---|---|---|
| `crossOriginIsolated` | `false` | **`true`** |
| `SharedArrayBuffer` | `undefined` | **`function`** |
| LiteRT client + runtime module import | pass | pass |
| LiteRT WASM asset fetch | pass (291,938 bytes) | pass |
| OPFS root / model dir / write+read | pass | pass |
| CheerpX CDN module import | pass | **pass** |

Conclusions:

1. **Use `require-corp`. `credentialless` is not needed** — nothing in the LiteRT
   stack broke. That is expected in hindsight: the entire LiteRT chain
   (`llm/vendor/…`, the WASM directory, OPFS) is **same-origin**, and COEP only
   constrains cross-origin subresources.
2. Isolation is not merely harmless, it is **required**: `SharedArrayBuffer` is
   absent on the plain route, and CheerpX needs it. This is what forces the
   separate `/cx/` route rather than making it a preference.
3. OPFS is fully writable under isolation, so imported models survive.

### 5.1b S-1 and S-2 results (resolved)

Harness: `network/test/cx-guest-spike-e2e.html`, served isolated by
`cx-isolation-runner.mjs`. Boots WebVM's public Debian ext2 over
`CloudDevice(wss://disks.webvm.io/…)` — sufficient to answer both questions
without waiting on the custom image. **All 12 checks pass.**

**S-1 — build design A. Concurrent `run()` works, and it is genuinely parallel.**

| Measurement | Result |
|---|---|
| `run()` while `bash --login` is live | status 0 in **15 ms**, shell unaffected |
| Exit code fidelity | `exit 42` → `status: 42`, verbatim |
| 1× `sleep 2` | 2023 ms |
| 3× `sleep 2` **in parallel** | **2064 ms** (ratio **1.02**) |

Three concurrent two-second sleeps finish in the time of one. That is true
parallelism, not merely tolerated concurrency. Consequences:

- **No mutex, no sentinel parsing, no shared-console contention.** Design B is
  retired; do not implement it.
- Agent work and the user's terminal genuinely run at the same time.
- The batching advice inherited from v86 is about *process spawn cost*, not
  serialisation. It still helps, but far less than on the UART.

Measure this rather than trusting a single reading: an early run showed 2×`sleep 1`
in 2159 ms, which looks exactly like serialisation. It was a cold-cache artifact —
the same run had `Linux.create` at 807 ms and first shell output at 22.7 s, versus
89 ms and 5.6 s once warm.

**S-2 — build the primary. Both directions work with no encoding layer.**

- Host → guest: `dataDevice.writeFile(path, string)`, read back by the guest. Note
  the signature is **`data: string`** — there is no binary write, so binary
  host→guest transfer still needs an encoding step.
- Guest → host: `idbDevice.readFileAsBlob(path)` returned 520 bytes byte-intact.
  **The path is device-relative, not guest-absolute**: `/probe.out`, not
  `/mnt/vmbro-out/probe.out`. The harness probes both and reports which worked.
- The `execute()` primitive is validated end to end: redirect stdout/stderr into
  the IDB mount, `await cx.run(...)`, read the blobs back. `uname -m` → `i386`,
  exit code correct.

**Two operational findings that change the image and the runtime code:**

1. **Mount points require an existing parent directory in the base image.**
   `{type:'dir', path:'/vmbro/in'}` fails on stock Debian with
   `Could not mount FS type: dir … Parent directory does not exist`. The
   Dockerfile (§8) **must** `mkdir -p /vmbro/in /vmbro/out`. The spike works
   around this by mounting under the existing `/mnt`.
2. **`Linux.create` does not reject on a bad mount — it never settles**, and the
   failure surfaces only as an uncaught rejection in the console. Production code
   must race it against a timeout, or a misconfigured mount presents as an
   indefinite boot hang with no error.

### 5.1c S-3 resolved — no sockets without a network interface

`Linux.prototype.registerPortListener(port, callback)` exists and is undocumented
in the npm type stubs, which looked like the hook behind BrowserPod's portals and
therefore a route to dynamic serving. It is not usable here, and the reason is
more fundamental than the API.

With no `networkInterface` configured, the guest has **no network stack at all**:

```
/proc/net/tcp     No such file or directory
/proc/net/dev     No such file or directory
/sys/class/net    No such file or directory
```

Every `bind()` fails, on every port, with a misleading `address already in use` —
3000, 3002 and 3003 all report it on a freshly booted guest with nothing running.
`vmbro-httpd -port N` therefore cannot start, so there is never a listening
socket for `registerPortListener` to observe.

Consequences:

1. **Socket-based preview is impossible in this configuration**, not merely
   awkward. The CGI + Cache Storage design in §9 is the only option, not a
   workaround for one.
2. Anything wanting real listeners must first configure `networkInterface`
   (Tailscale/Headscale) — decision 4's deferred option. `registerPortListener`
   should be re-spiked *after* that, not before.
3. v86's network adapters remain unusable regardless: they bind to
   `emulator.add_listener('net0-send')` / `bus.send('net0-receive')`, raw
   Ethernet frames on the emulated NIC, and CheerpX exposes no frame-level hook.

### 5.2 Correction to decision 8 — the npm package does not localise CheerpX

Discovered while resolving S-4, and it changes what decision 8 actually buys.
`@leaningtech/cheerpx` is **41 KB** and its entire `index.js` is a shim:

```js
const dynImport = new Function("x", "return import(x)");
const CheerpX = await dynImport(`https://cxrtnc.leaningtech.com/${version}/cx.esm.js`);
```

The runtime is fetched from Leaning's CDN **at page load**, every load. Three
consequences:

- **There is no offline CheerpX.** `portable/build-windows.ps1` produces an
  offline Windows ZIP; a CheerpX provider cannot work inside it without Leaning's
  permission to self-host the runtime. Do not promise offline parity between the
  two providers.
- **A bundler cannot inline it.** `new Function("x", "return import(x)")` exists
  specifically to defeat static analysis, so esbuild/vite will not follow it. The
  "local build step" pins the *shim* version; it does not vendor the runtime.
- **Availability of cxrtnc.leaningtech.com is a hard runtime dependency** of the
  CheerpX page. The v86 page has no such dependency.

The CDN sends `access-control-allow-origin: *` and
`cross-origin-resource-policy: cross-origin`, which is why the cross-origin module
import survives `require-corp`. (Note: CORP is *not* readable from script — the
CDN's `Access-Control-Expose-Headers` lists only `content-length` and
`content-range` — so verify it with curl, not `response.headers.get`.)

Licensing reads slightly *better* than assumed: loading Leaning's CDN is not
redistribution. Self-hosting the runtime, which offline mode would require, is.

#### 5.2a Superseded — the runtime is now vendored

The three consequences above held only while the CDN was the delivery path. It
no longer is: `vendor/cheerpx/fetch.sh` pins the closure reachable from
`cx.esm.js` — `cx_esm.js`, `cxcore.js` + `cxcore.wasm`, `cxbridge.js`,
`cheerpOS.js`, `workerclock.js`, 2.5 MB — and `loadCheerpX` imports it from our
own origin with no CDN fallback.

"A bundler cannot inline it" is still true, and for a second reason found while
vendoring: `cx_esm.js` locates its siblings by throwing an `Error` and scanning
the stack trace for `/cx_esm.js`. It must stay a separate file under that exact
name in the same directory as the rest. Vendoring sidesteps the shim's
`new Function` trick rather than defeating it.

What this does *not* change is the licensing note directly above — it now cuts
the other way. This **is** redistribution, so it needs Leaning's permission in a
way that loading their CDN did not.

---

## 6. Phase 0 — Repo migration

1. Create the initial `vmbro` commit from the current `herdr-v86` `main`. Preserve
   `.gitattributes` (LFS/binary rules) — the repo carries ~300 MB of images and
   kernels.
2. Apply the §4 moves. Update every dynamic `import()` in `index.html` (there are
   14; they are all string literals, so a mechanical find/replace works).
3. Verify `index.html` still boots the v86 AI-Tools tier with zero behaviour change.
   This is the regression gate for the whole migration — nothing else proceeds until
   it passes.
4. Add root `package.json` with `@leaningtech/cheerpx` pinned and a build script.
   Keep it separate from `agent/package.json`; do not merge the two dependency sets.
5. Carry over `AGENTS.md`, adding a vmbro section. **Preserve the deployment policy
   verbatim** — GitHub Pages stays disabled, production is fapstaff.com only.

---

## 7. Phase 1 — CheerpX provider core

### 7.1 Cross-origin isolated route

Create `cx/index.html`, served with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Scope these headers to `/cx/` only (nginx `location /cx/`). `index.html` keeps its
current headers so the PeerJS remote-chat, Moonshine voice, AutoBro pairing, and
cross-origin model downloads are unaffected. **S-4 confirms `require-corp` works
(§5.1); do not use `credentialless`.**

Add a provider chooser: a control on `index.html` linking to `/cx/`, and a matching
"switch to v86" control on `/cx/`. Persist the last choice in
`localStorage["vmbro.provider"]`. Because the two pages are separately isolated,
this is navigation, not an in-page switch — accept that.

### 7.2 `providers/cheerpx/runtime.js`

```js
const block   = await CheerpX.HttpBytesDevice.create(imageUrl);
const overlay = await CheerpX.OverlayDevice.create(
  block, await CheerpX.IDBDevice.create(`vmbro-cx-${tier}`)
);
const dataIn  = await CheerpX.DataDevice.create();      // host -> guest
const idbOut  = await CheerpX.IDBDevice.create("vmbro-cx-out"); // guest -> host

const cx = await CheerpX.Linux.create({
  mounts: [
    { type: "ext2",   path: "/",         dev: overlay },
    { type: "dir",    path: "/vmbro/in", dev: dataIn  },
    { type: "dir",    path: "/vmbro/out",dev: idbOut  },
    { type: "devs",   path: "/dev"  },
    { type: "devpts", path: "/dev/pts" },
    { type: "proc",   path: "/proc" },
  ],
});
```

Reuse the existing boot-overlay UI (`#boot-overlay`, `#boot-ring`, `#boot-percent`,
`setBootProgress`) so the CheerpX page looks and feels like the v86 page. Add an
`images/cheerpx/cx-images.json` manifest mirroring `images/v86/vm-images.json`'s schema
(`schemaVersion`, `defaultTier`, `tiers{name,description,url,size,version,sha256}`)
so the Settings image picker generalises across providers.

The Range-request requirement carries over: `HttpBytesDevice` streams the ext2 image
over HTTP, so the host **must** serve 206 responses. Reuse the existing
`rangePreflight()` check.

### 7.3 `providers/cheerpx/terminal.js`

Wire `cx.setCustomConsole(writeCb)` to the existing xterm instance; the returned
`send(byte)` function receives xterm `onData`. Reuse `fitTerminal`,
`scheduleTerminalFit`, `copyTerminalSelection`, `pasteTerminalClipboard` unchanged.

Start the session with:

```js
cx.run("/bin/bash", ["--login"], {
  env: ["HOME=/root", "USER=root", "TERM=xterm-256color", "LANG=C.UTF-8"],
  cwd: "/root",
  uid: 0, gid: 0,
});
```

### 7.4 `providers/cheerpx/guest-client.js`

Implement the nine-method contract from §3.1. Reference implementation of the
critical method (design A):

```js
async execute(command) {
  const id  = `${Date.now()}-${this._seq++}`;
  const out = `/vmbro/out/${id}.out`;
  const err = `/vmbro/out/${id}.err`;
  const wrapped = `{ ${command}; } >${out} 2>${err}`;

  const { status } = await this.cx.run("/bin/bash", ["-c", wrapped], {
    cwd: this.workspace, env: this.env, uid: 0, gid: 0,
  });

  const stdout = await this._readOut(`${id}.out`);
  const stderr = await this._readOut(`${id}.err`);
  await this._cleanup(id);

  // Preserve the v86 wire shape for splitExitMarker() compatibility.
  return `__V86AGENT_EXIT__${status}\n${stdout}` +
         (stderr ? `\n__V86_STDERR__\n${stderr}` : "");
}
```

`_readOut` uses `idbOut.readFileAsBlob()` — **confirmed working by S-2 (§5.1b)**,
binary-safe with no encoding overhead and no console contention. Pass a
**device-relative** path (`/${id}.out`), not the guest-absolute mount path. The
`base64 -w0` fallback is retired.

Two performance rules for this method, both compatibility-preserving:

- **Batch, don't chatter.** Compose multi-step work into one `bash -c` invocation
  rather than issuing several `execute()` calls. This is the same lesson the v86
  `getInstructions()` already teaches agents, and it still holds — a CheerpX process
  spawn is cheap but not free.
- **Read stderr only when non-empty.** Probe both output files' sizes in the same
  wrapped command (`wc -c`) and skip the second `readFileAsBlob()` when stderr is
  empty, which is the common case. Halves the guest→host reads on the hot path.

Port `toGuestPath()` / `shellQuote()` from `agent/src/v86-workspace.js` — including
the relative-path leniency and the `..` rejection. Those behaviours were derived
from real model failure modes and must not be re-derived.

**Correction — keep the `FIELD_SEPARATOR` dual-form parser.** An earlier draft of
this plan said the hack exists only because BusyBox `stat` fails to interpret `\t`,
and that Debian's coreutils would emit real tabs. That is wrong, and the e2e run
caught it. `stat -c` does **not** interpret backslash escapes — only `--printf`
does — so GNU coreutils emits the two characters backslash-t exactly like BusyBox:

```
$ stat -c "%F\t%n" probe.txt | cat -A
regular empty file\tprobe.txt$          <- literal backslash-t
$ stat --printf "%F\t%n\n" probe.txt | cat -A
regular empty file^Iprobe.txt$          <- real tab
```

So the CheerpX client keeps `stat -c '%F\t%n\t%s'` verbatim and stays
byte-identical to the v86 guest. The dual-form parser is load-bearing on **both**
providers; do not remove it, and do not "fix" the client to emit real tabs.

### 7.5 `providers/cheerpx/host-bridge.js`

Reimplement `V86HostBridge`'s *handlers* without the serial transport. Keep:

- `FETCH` (with the HTTPS-only guard and the forbidden-header blocklist —
  `host|connection|content-length|cookie|origin|referer`)
- `CLIPBOARD_READ` / `CLIPBOARD_WRITE`
- `EXPORT`
- `LLM_STATUS` / `LLM_MODELS` / `LLM_CHAT` / `LLM_COMPLETION` / `LLM_OPENAI`

**Construct it with the same `llmResolver` the v86 page uses**, pointing at the
shared `LlmProviderRouter`:

```js
const router = new LlmProviderRouter({ getLocalClient: () => litertClient });
const bridge = new CheerpXHostBridge(cx, {
  llmResolver: (agent, route) => router.resolve(agent, route),
});
```

This is the whole of the "reuse the baked-in LLM provider functionality" requirement.
Do not add a second router, a second secret store, or a CheerpX-specific provider
list. Local LiteRT, OpenAI, Anthropic, Gemini, and compatible endpoints all work on
the CheerpX page for free, including per-session provider binding.

Drop entirely: `reliableReply`, `ackWaiters`, the 64-byte and 256-byte chunking, and
the 1 ms-per-byte pacing in `send()`. All are UART artifacts.

**Transport for guest→host RPC — primary:** a small guest daemon that writes request
JSON into `/vmbro/out` and reads responses from `/vmbro/in`. This is the performant,
contract-preserving choice: it is binary-safe, has no line-length ceiling, does not
contend with the interactive console, and moves payloads at memory speed rather than
through a character stream. Use a filesystem watch or short-interval poll with
exponential backoff while idle — not a tight loop, which would burn guest CPU that
CheerpX's JIT wants for real work.

**Fallback:** sentinel lines on the console channel (v86-style), latched only if S-1
lands on design B, since that already implies a shared console.

Both transports carry the same operation set and the same payload encoding, so
`vm*` tools and the host handlers are written once against the abstraction.

### 7.6 LLM chat UI

The CheerpX page reuses the existing Settings dialog wholesale: `#cloud-provider-*`
controls, `#cached-model-select`, `#llm-status`, `#model-progress*`, `#reset-llm`.
Extract that block from `index.html` into a shared partial rather than duplicating
it — it is ~200 lines of markup plus `refreshCloudProviderSettings()` and
`refreshCachedModelSelect()`.

---

## 8. Phase 2 — Guest image (Debian ext2 + `vm*` tools)

Build via Dockerfile → ext2, following WebVM's workflow (Apache-2.0).

`images/cheerpx/Dockerfile.debian-vmbro`:

- Base: `i386/debian:stable-slim` (CheerpX runs 32-bit x86).
- Core: `bash coreutils findutils grep sed tar gzip ca-certificates git jq ripgrep make patch`.
- Runtimes: Node.js and Python — **the main reason to choose CheerpX over v86.**
- Ported `vm*` tools in `/usr/local/bin`: `vmfetch`, `vmclip`, `vmexport`,
  `vmgithub`, `vmai`, `vmllm`, `vmproject`.
- `/root/project` as the workspace root, matching the Deep Agents mapping.
- `AGENTS.md` + `skills/` staged where the agent tiers expect them.
- **`RUN mkdir -p /vmbro/in /vmbro/out`** — mandatory, not cosmetic. S-1/S-2
  (§5.1b) established that a `{type:'dir'}` mount fails outright if its parent
  directory does not already exist in the image, and the failure presents as a
  boot that never completes. Verify these exist before publishing an image.

### 8.1 The build is implemented and proven — no Docker required

`images/cheerpx/build-ext2.sh` + `images/cheerpx/pull-rootfs.py` build the image
with **no container runtime, no root, and no debootstrap**. Two facts make that
work:

- a registry pull is just HTTPS + tar, so `pull-rootfs.py` goes
  token → manifest → layer blobs → extract (handling OCI whiteouts);
- `mke2fs -d` populates an image from a directory, so nothing is ever mounted.

Both steps run inside **one `fakeroot` session**. That is not incidental: the
layer tarballs carry root-owned files, fakeroot remembers that ownership, and
`mke2fs -d` must read the tree from inside the same session or every file in the
image ends up owned by the build user.

Verified end to end on 2026-08-08: `i386/debian:bookworm-slim` → 384 MB ext2 →
served over HTTP → booted in CheerpX → all 13 spike checks pass, with
`Linux.create` at **108 ms** and first shell output at **903 ms** (versus 5.6 s
for WebVM's remote `CloudDevice` disk — a local `HttpBytesDevice` is far faster).

**Three hard requirements, each discovered by a boot failure. All are enforced by
the script's verify step; do not remove those checks.**

1. **Block size must be 4096.** `mke2fs` picks 1024-byte blocks for a filesystem
   this small, and the image then builds and `fsck`s cleanly but CheerpX rejects
   it at boot with `Block size 1024 not supported. fatal error.` followed by the
   misleading `Could not mount FS type: ext2, mount path: /. Invalid disk image.`
   Hence `mke2fs -b 4096`, plus a `dumpe2fs` assertion.
1b. **Inode size must be 128.** `mke2fs` switches to 256-byte inodes once the
   filesystem grows past a few hundred MB, and CheerpX then refuses with a bare
   `Invalid disk image` — no mention of inodes. A 384 MB image happened to get
   128-byte inodes and booted; the identical tree at 1024 MB did not. Hence
   `mke2fs -I 128`, plus its own assertion. Both this and the block size present
   only at boot, as `Linux.create` never settling.
2. **Mount parents must exist** (§5.1b): `mkdir -p /vmbro/in /vmbro/out`.
3. **The HTTP server must send `Last-Modified` or `ETag`.** `HttpBytesDevice`
   refuses to initialise otherwise — `Server didn't include header
   'Last-Modified' nor header 'Etag'` — because it needs a validator to detect the
   block device changing underneath it. nginx sends both for static files by
   default; `cx-isolation-runner.mjs` had to be taught to. This joins Range/206
   as a **hosting requirement**, so it belongs in the deploy checklist.

**Reproducibility caveat:** two builds of identical inputs produced different
sha256 values, because `mke2fs` embeds a random filesystem UUID and timestamps.
The manifest discipline inherited from `vm-images.json` records a `sha256`, so
either pin `mke2fs -U <uuid>` with a fixed `SOURCE_DATE_EPOCH`, or treat the
recorded hash as identifying *one published artifact* rather than a reproducible
function of the Dockerfile. Decide before publishing the first tier.

### 8.2 Packages without apt — and a correction to the premise

Package installation does **not** need a container runtime after all. A `.deb` is
an `ar` archive whose data member is a tar, so `images/cheerpx/add-packages.py`
resolves dependencies against the release's `Packages` index, downloads the
`.deb`s and untars them into the rootfs — no apt, no chroot, no root, inside the
same fakeroot session. It reads the base image's `dpkg/status` to skip what is
already present (114 packages) and appends to it afterwards.

Maintainer scripts never run. That is acceptable for self-contained CLI tools and
is why the list stays close to them; it is not a substitute for apt.

**Installing a package is not the same as it working, and this is where the
plan's premise breaks.** Decision 2 chose CheerpX largely for "real Node and
Python — the main reason to choose CheerpX over v86". Measured in the guest:

| package | `--version` | real work |
|---|---|---|
| git | instant | `git init` + commit, **691 ms** |
| jq | instant | filter, **536 ms** |
| make | instant | builds a target, **293 ms** |
| grep | instant | **143 ms** |
| **python3** | instant | `python3 -c "print(42)"` — **never returns (>60 s)** |
| **ripgrep** | instant | `rg -n pattern file` — **never returns**, even `--threads 1` |

Version prints are not evidence: they exit before the interpreter or the real
work path is reached. Both hangs also survive `timeout 120`, so **`timeout` does
not reliably kill a wedged process under CheerpX** — the guest client's 120 s
bound is best-effort, not a guarantee.

Neither was network-bound: block fetches ran at 2.8 ms median and only ~2.5
requests/second, so ~99% of the time was guest compute.

python3 and ripgrep are therefore **excluded** from the tier. Shipping them would
be worse than omitting them: an agent would reach for them and stall for the full
command timeout. The agent prompts say so explicitly, so the model uses `grep`
rather than `rg` and does not write Python.

**So CheerpX's practical advantage over v86 is not "Node and Python".** It is
boot time (~120 ms against tens of seconds), near-native throughput, and a real
bash/GNU userland. If a language runtime is genuinely required, that needs its
own investigation — and node was never verified at all, since Debian dropped
official i386 builds.

Every package added to a tier must be smoke-tested in the guest, not merely
installed.

Podman/Docker remain **optional** — useful only if a future image needs true
`RUN` steps (generated caches, users, alternatives).

Porting the `vm*` tools: today they speak the `__V86RPC__` serial protocol. Retarget
them to the CheerpX RPC transport chosen in §7.5. Keep the command-line surface,
flags, `--help` text, and the 16 MiB fetch / 8 MiB export limits identical, so
`docs/guest-tools.md` stays true for both providers.

Expect the image to be substantially larger than the ~92 MiB v86 AI-Tools tier —
Debian with Node and Python lands in the several-hundred-MiB range. Publish tiers
mirroring the v86 ladder (barebones → essentials → dev) so users can pick, and rely
on `HttpBytesDevice` streaming plus IDB caching so first paint does not wait on the
full download.

Reproducibility: pin the Debian snapshot date and record `sha256` in
`cx-images.json`, matching the existing manifest discipline.

---

## 9. Phase 3 — Dev experience (the "dev image" UX)

Mirror the v86 dev tier's choreography, which already exists in `index.html`:

- `DEV_APP_URL` / `DEVAPP_READY_MARKER` (`"DEVAPP-READY-OK"`)
- `startDevAppPhase()` → ticker + 300 s timeout
- `finishDevApp(ready)` → `enterDevIDE()` → loads the `#dev-ide` iframe
- `#share-ide` copies the public IDE link
- theme propagation via `postMessage({type:"vmvm-theme"})`

For CheerpX:

1. On the `dev` tier, boot into the project at `/root/project` and start its dev
   server, emitting `DEVAPP-READY-OK` on the console when listening.
2. The host watches the console stream for the marker (replacing
   `serialFaultContext` matching) and calls `finishDevApp(true)`.
3. Register `providers/cheerpx/portal-sw.js` scoped to `/cx/preview/`. It serves the
   iframe from guest-produced bytes.
4. Point `#dev-ide` at `/cx/preview/<session>/` instead of the fixed `/ide/`.

Per §5, the **static-export mirror is the default**, not a contingency: guest builds
to `/root/project/dist`, the host mirrors it through `guestClient.list()`/`read()`
into a `Map`, and the service worker serves from that map with correct MIME types.
Re-sync incrementally on change — compare mtime/size from a single `list()` call and
re-read only the files that actually changed, rather than re-mirroring the tree.
Serving from memory means preview requests never touch the guest, which is why this
is the faster design as well as the compatible one. Socket-level proxying is a
follow-on, not a prerequisite.

Because Debian has Node, the CheerpX dev tier can run a *real* Vite/Astro dev server
— unlike the v86 dev tier, which needs the QuickJS + Chi + Go-WASM workaround
described in `network/guest/dev-template/README.md`. That is the single biggest user-visible
win of this provider and should drive the tier's design.

Editor/file-tree: reuse the existing `#dev-ide` iframe slot. Keep the phase-1 surface
to terminal + preview + file import/export; a full editor is a follow-on once the
guest client is proven.

---

## 10. Phase 4 — Agent tiers (deferred)

Because the guest client is built to contract (§3.1), this reduces to:

1. `providers/cheerpx/workspace.js` — `CheerpXFilesystem` / `CheerpXSandbox`
   extending `MastraFilesystem` / `MastraSandbox`. Port from `v86-workspace.js`,
   dropping the `cacheTtlMs` round-trip cache, `prefetchMaxBytes`, and the BusyBox
   `stat` workarounds. Note this is a *performance-neutral* deletion, not a
   regression: both mechanisms exist solely to amortise ~400 ms UART round-trips.
   On CheerpX a stat is a memory-speed operation, so the cache buys almost nothing
   while adding real staleness risk — the guest is also being driven by a human at
   the terminal, and `v86-workspace.js` documents exactly that hazard. Measure
   before reinstating either.

   Rewrite `getInstructions()`: it currently promises BusyBox, no networking, and
   "limited emulated CPU throughput". All three are wrong for a JIT-compiled Debian
   guest, and a stale prompt actively degrades agent behaviour — it is the reason
   the v86 prose tells models to batch commands, advice that CheerpX does not need
   to the same degree.
2. Point `VmAgentController`'s `getGuest` at the CheerpX client.
3. `V86DeepAgentsBackend` needs no changes — construct it with the CheerpX client.
4. Re-run `agent/test/*.test.mjs` against a CheerpX fake implementing the contract.

Ship order once unblocked: **rig → vmlang → vmmastra** (cheapest to most complex).

---

## 11. Testing

- **Regression gate (blocking):** the v86 page boots AI-Tools and passes existing
  `network/test/*` suites after the phase-0 move. No CheerpX work merges before this
  is green.
- **Contract conformance:** one shared test suite run against both
  `V86GuestReadonlyClient` and `CheerpXGuestClient`, asserting identical behaviour
  for all nine methods including `..` rejection, relative-path resolution, non-zero
  exit codes, and stderr separation. This is the highest-value new test asset —
  write it in phase 1, and it de-risks phase 4 entirely.
- **LLM router:** `network/test/settings-providers.test.mjs` must pass unmodified —
  it is the proof that the router was reused rather than forked.
- **E2E:** a CheerpX analogue of `network/test/host-bridge-e2e.html` covering
  `vmfetch`, `vmclip`, `vmexport`, and an LLM round-trip.
- **Isolation:** automated check that `/cx/` responds with COOP/COEP and `/` does not.

---

## 12. Risks and checkpoints

| Risk | Impact | Mitigation |
|---|---|---|
| **CheerpX licensing** | Blocking for any commercial/organisational deployment | CheerpX is free for personal projects and technical evaluation only. The npm package loads Leaning's CDN rather than vendoring the runtime (§5.2), so ordinary use is **not** redistribution — but fapstaff.com is a public deployment, and offline/portable mode *would* require self-hosting, which needs explicit permission. **Confirm terms with Leaning before phase 1 ships.** |
| ~~No image build tooling~~ | None — retired | WSL is present (Arch + Ubuntu) with `mke2fs` 1.47.4 and `fakeroot`. `images/cheerpx/build-ext2.sh` builds the image with **no Docker, no root, no debootstrap** and is proven end to end (§8.1). |
| ~~**CDN dependency**~~ | ~~CheerpX page cannot boot if cxrtnc.leaningtech.com is unreachable~~ | **Resolved.** The runtime is vendored under `vendor/cheerpx/1.3.7/` and served from our own origin (§5.2a). Residual risk moved to licensing: self-hosting is redistribution. |
| S-3 fails (no socket portals) | None in phase 1 | Already the planned default (§5, §9). Static-export mirror serves from memory, so it is the faster path for preview reads regardless of the spike outcome |
| Image size | Slow first load | Tiered images, `HttpBytesDevice` streaming, IDB cache, honest progress UI |
| ~~COEP breaks LiteRT/OPFS~~ | None — retired | S-4 resolved (§5.1): all checks pass under `require-corp`; the LiteRT chain is same-origin, which COEP does not constrain |
| Two isolated pages diverge | UX drift, duplicated code | Extract shared Settings/boot/terminal partials in phase 0–1, not later |
| 32-bit Debian availability | Image build blocked | `i386` Debian is still published but is a reduced-support architecture; verify package availability early and pin a snapshot |

---

## 13. Definition of done (phase 1)

- `/cx/` boots a Debian guest into an interactive xterm.
- Settings offers the same LLM providers as `/`, backed by the same
  `LlmProviderRouter` and secret storage — verified by the unmodified provider test.
- `vmfetch`, `vmclip`, `vmexport` work from the CheerpX guest.
- `CheerpXGuestClient` passes the shared contract suite.
- The v86 page is byte-for-byte unchanged in behaviour.
- No BrowserCode/BrowserPod code, templates, or agent scaffolding present.
