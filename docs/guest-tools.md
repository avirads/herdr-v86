# Browser-backed guest tools

Every coding-agent tier can read the canonical in-guest capability reference at
`/usr/local/share/vm-agent-capabilities.md`. Zerostack also receives the same
content as its global `AGENTS.md`, so newly started agents discover it
automatically.

The main page revalidates the selected tier's versioned VM image URL at boot.
If the hosted image is not newer, the browser loads the existing local
HTTP-cache entry. Image URLs, sizes, versions, and checksums live in
`vm-images.json`; update the selected image's version and checksum whenever it
changes. After an image boots successfully, the page records that version
locally under a tier-specific cache key.
Every long-lived startup message then includes `[local cache]` for that same
version or `[remote]` for a new version, together with the tier name. The source is not inferred from a
one-byte Range cache probe because browsers do not reliably expose cached
partial responses through `only-if-cached`.
The v86 `download-progress` event is emitted for cached XHR reads too, so disk
progress is labeled from the selected VM source rather than from that event's
name.

The production portal is `https://fapstaff.com/`. Its navigation-only
`service-worker.js` revalidates the small app shell on refresh while deliberately
ignoring VM image and Range requests, preserving the local disk cache.

This is the canonical command reference for gateway-free services in the
VM guest. These tools communicate with JavaScript in the hosting browser;
they do not require a guest network interface or the external TAP gateway.

## Determine which networking mode is available

```sh
ip route
```

- A default route through `10.77.0.1` means the full gateway is connected. Use
  ordinary programs such as `curl`, `ssh`, and package managers.
- No default route means ordinary networking is unavailable. Use the `vm*`
  browser-backed commands in this document.

## `vmfetch` — browser-backed HTTP client

```text
vmfetch [-o FILE] [-X METHOD] [-H 'NAME: VALUE']... [-d DATA] URL
```

Examples:

```sh
vmfetch -o page.html https://example.com/
vmfetch -o - https://api.github.com/repos/avirads/herdr-v86
vmfetch -X POST -H 'Content-Type: application/json' \
  -d '{"enabled":true}' -o response.json https://api.example.com/items
```

- Default method: `GET`; specifying `-d` changes it to `POST` unless `-X` was used.
- Default output: basename of the final URL path; use `-o -` for standard output.
- `-H` is repeatable. Browsers reject controlled headers including `Host`,
  `Connection`, `Content-Length`, `Cookie`, `Origin`, and `Referer`.
- HTTPS is permitted. Plain HTTP is permitted only for localhost.
- Redirects are followed by the browser.
- Maximum response size: 16 MiB.
- Success: HTTP 200–399 and exit status 0. HTTP errors return exit status 22.
- CORS, mixed-content policy, and browser permission rules always apply.

`vmfetch` does not support DNS tools, ICMP, SSH, arbitrary sockets, proxy/TLS
controls, client certificates, or every `curl` option.

## `vmclip` — system clipboard

The terminal also supports direct clipboard controls:

- Select text and press **Copy**, `Ctrl+C`, or `Ctrl+Shift+C` (`Cmd+C` on
  macOS). Without a selection, `Ctrl+C` remains the shell interrupt key.
- Press **Paste**, `Ctrl+Shift+V` (`Cmd+V` on macOS), or `Shift+Insert` to
  insert clipboard text into the active shell or `vmlang` conversation.
- Plain `Ctrl+C` remains the shell interrupt key when terminal text is not
  selected.
- If direct clipboard permission is unavailable, the **Paste** button opens a
  text box where content can be pasted and inserted without granting access.

```text
vmclip read
vmclip write
```

Examples:

```sh
vmclip read > pasted.txt
printf '%s' 'text from the guest' | vmclip write
```

Clipboard access may require browser permission and a recent user gesture. It
can be unavailable in embedded frames, non-secure origins, or some mobile browsers.

## `vmexport` — download a guest file

```text
vmexport FILE
```

Example:

```sh
tar czf project.tar.gz project/
vmexport project.tar.gz
```

The browser opens its normal download flow. File bytes travel through the
dedicated binary VirtIO 9P channel rather than Base64 over the terminal.
Maximum file size is 8 MiB. Export only regular files; directories should
first be archived.

## `vmproject` — import and export projects

```text
vmproject import ARCHIVE.tar.gz [DESTINATION]
vmproject pack [PROJECT_DIR] [OUTPUT.tar.gz]
vmproject export [PROJECT_DIR] [DOWNLOAD_NAME.tar.gz]
```

Examples:

```sh
vmproject import /root/my-project.tar.gz /root/project
vmproject pack /root/project /tmp/project.tar.gz
vmproject export /root/project project.tar.gz
```

The browser Settings dialog provides matching **Import project** and
**Export project** controls. Imports merge a `.tar.gz` or `.tgz` archive into
`/root/project`; archive entries with absolute paths or `..` traversal are
rejected. Exports are limited to 8 MiB compressed. Settings imports and exports
use a dedicated binary VirtIO 9P channel; their payloads do not pass through
the interactive terminal or use Base64.

The guest also includes `git`, `rg` (ripgrep), `jq`, `curl`, `shfmt`, `ctags`,
`make`, `patch`, and [Grafana k6](https://grafana.com/docs/k6/latest/) 2.0.0.
Use k6 for JavaScript HTTP/API performance and load tests:

```sh
k6 new load-test.js
k6 run --vus 5 --duration 30s load-test.js
```

## `k6obs` — stream k6 results to OpenObserve

`k6obs` wraps `k6 run` and ships the metrics out **while the test runs** and
again when it finishes. Anything it does not recognise is passed straight
through to k6, so an existing command works unchanged by swapping the binary:

```sh
k6obs --oo-url https://openobserve.example.com \
      --oo-user you@example.com --oo-pass secret \
      --interval 10 --tag env=ci \
      run --vus 5 --duration 30s load-test.js
```

Every option also reads from the environment (`K6_OO_URL`, `K6_OO_USER`,
`K6_OO_PASS`, `K6_OO_TOKEN`, `K6_OO_STREAM`, `K6_OBS_INTERVAL`,
`K6_OBS_MODE`, `K6_OBS_TAGS`), so a pipeline can configure it once. Use
`--dry-run` to print the payloads instead of sending them.

### What it sends

k6's JSON output is one line per metric sample per virtual user — thousands of
lines a second. `k6obs` collapses each interval into **one flat record per
metric** (`count`, `sum`, `min`, `max`, `avg`), which is what makes the volume
independent of load. A final rollup and k6's own summary (with its exit code)
follow at the end. Records are tagged with a `run_id` so one test is queryable
as a unit, plus whatever `--tag K=V` pairs you add.

Records are posted as a JSON array to
`{--oo-url}/api/{org}/{stream}/_json`. Because that body is plain
JSON-over-HTTP, the same payload can go to a second sink with `--bi-url` —
useful for a Microsoft Fabric **Eventstream custom endpoint**, which is the
supported path into Power BI now that Power BI's own streaming datasets are
being retired. Each record carries both `_timestamp` (what OpenObserve indexes
on) and `timestamp`, because BI tools dislike a leading underscore.

### Modes and transport

| `--mode` | Behaviour |
|---|---|
| `rollup` (default) | `k6obs` aggregates and posts the JSON above. Works with or without the network gateway, and is the only mode that can also feed `--bi-url`. |
| `native` | k6's own Prometheus remote-write output goes straight to OpenObserve. Lower overhead and finer resolution, but **requires the network gateway** and does not feed `--bi-url`. |
| `both` | `native` for OpenObserve, `rollup` for `--bi-url`. |

Transport is chosen automatically: `curl` when the WebSocket ethernet gateway
is attached, otherwise [`vmfetch`](#vmfetch--browser-backed-http-client) via
the browser. The `vmfetch` path inherits its limits — **HTTPS only, and the
OpenObserve endpoint must send CORS headers** permitting `Authorization`,
since the request originates from the page. Without the gateway, `--mode
native` is unavailable and falls back to `rollup` with a warning.

Ingestion failures never fail the test: they are reported on stderr and the k6
run continues, so telemetry problems cannot corrupt a performance result.

## `vaptr` — authorized web VAPT orchestration

The cumulative **VAPT — native scanner** VMVM image adds the static 32-bit
[`vaptr`](https://github.com/avirads/vmvapt) orchestrator. No external tools are
bundled — every stage runs in-process through vaptr's built-in `native`
backends:

```text
fingerprint  crawl  content discovery  parameter discovery  vulnerability checks
```

Because there are no heavyweight helper binaries (httpx, katana, nuclei, ffuf,
…), the whole pipeline fits and runs inside the 512 MB v86 guest. Inspect
capabilities and prepare a scan:

```sh
vaptr version
vaptr caps
cp /opt/vaptr/configs/native.json /root/vaptr-scan.json
vi /root/vaptr-scan.json
vaptr scan -config /root/vaptr-scan.json
```

Before running a scan, replace the example target, allowed domains, workspace,
and authorization reference. Use this tooling only for systems you own or have
explicit written permission to assess. Normal targets require working guest
networking; the browser-backed `vmfetch` command is not a general network
adapter for Vaptr or its child processes.

ShellCheck is documented but is not installed because
Alpine 3.22 does not publish an x86 package and this VM image remains fixed-size.
Remote Git and curl require a default route; without one, use
`vmgithub archive` or `vmfetch` as appropriate. For shell scripts, run:

```sh
shfmt -w script.sh
sh -n script.sh
shellcheck script.sh
```

Run the ShellCheck command above only in an external environment where
ShellCheck is installed.

## `vmgithub` — focused GitHub helper

```text
vmgithub repo OWNER/REPOSITORY
vmgithub archive OWNER/REPOSITORY [REF] [FILE]
vmgithub api /API/PATH
```

Examples:

```sh
vmgithub repo avirads/herdr-v86
vmgithub archive avirads/herdr-v86 main source.tar.gz
GITHUB_TOKEN=... vmgithub api /user
unset GITHUB_TOKEN
```

`repo` reads public repository metadata. `archive` downloads a source tarball.
`api` calls `https://api.github.com`; it uses `GITHUB_TOKEN` when set. GitHub's
CORS, authentication, API permissions, rate limits, and the 16 MiB response
limit still apply. This is not a full replacement for Git or GitHub CLI.

## `vmai` — OpenAI-compatible Responses API helper

```text
OPENAI_API_KEY=... vmai PROMPT...
```

Optional environment variables:

```text
OPENAI_MODEL       default: gpt-4.1-mini
OPENAI_BASE_URL    default: https://api.openai.com/v1
```

Example:

```sh
OPENAI_API_KEY=... OPENAI_MODEL=gpt-4.1-mini vmai 'Explain main.c'
unset OPENAI_API_KEY
```

The configured endpoint must implement `POST /responses` and allow the page's
origin via CORS. The command returns raw JSON. Credentials cross the trusted
hosting page; use short-lived, narrow-scope keys. Never save a VM snapshot while
a key remains in the environment or shell history.

## Cloud LLMs: OpenAI, Claude, Gemini, and gateways

Rig, Zerostack, vmlang, and vmmastra use the model loaded under
**Settings → AI Model** by default. This Local WebGPU path remains direct and
does not pass through the cloud router. Add OpenAI, Anthropic, Gemini, or an
OpenAI-compatible endpoint under **Settings → Cloud AI providers**, then either
choose a per-agent default there or override one invocation:

```sh
rig --provider work-openai --model gpt-4.1-mini 'Review this project'
vmlang --provider claude --session review-a run 'Review this project'
vmmastra --provider gemini --session build-a 'Implement and test the change'
zerostack --provider local-gateway --model provider/model-id
```

`--provider`, `--model`, and `--session` must precede the task or subcommand.
A named session is pinned to its first provider/model selection, preventing a
later request from silently moving its conversation to another service.
Different terminal instances can use different session names and providers.
Omit all three flags to use that agent's Settings default; the initial default
for every agent is `local`.

API keys are kept in the current browser tab by default. Selecting **Retain key
in this browser** stores the key in browser storage, which is convenient but is
not a hardware-backed secret vault. Cloud requests fail visibly on provider,
authentication, network, or CORS errors and never fall back to another model.
The provider receives the agent prompt and any content the agent places in its
model context.

### OpenAI Responses API

`vmai` is the shortest path when the provider implements the OpenAI Responses
API and permits browser-origin requests:

```sh
export OPENAI_API_KEY='your-short-lived-key'
export OPENAI_MODEL='model-id-from-your-account'
vmai 'Explain the current project structure'
unset OPENAI_API_KEY OPENAI_MODEL
```

See the [OpenAI Responses API documentation](https://platform.openai.com/docs/api-reference/responses).

### OpenAI-compatible cloud gateway

A gateway can expose OpenAI, Claude, Gemini, or another hosted model through a
common interface. The endpoint used with `vmai` must implement
`POST /responses`, not only `/chat/completions`, and must allow the
`https://fapstaff.com` browser origin:

```sh
export OPENAI_BASE_URL='https://your-gateway.example/v1'
export OPENAI_API_KEY='your-short-lived-key'
export OPENAI_MODEL='provider/model-id'
vmai 'Review main.js for correctness'
unset OPENAI_BASE_URL OPENAI_API_KEY OPENAI_MODEL
```

Model identifiers and authentication rules are gateway-specific. Do not assume
that a provider's “OpenAI-compatible” label includes the Responses API.

### Anthropic Claude native API

The native Claude API is not compatible with `vmai`. With full guest networking
connected, call its Messages API using `curl`:

```sh
export ANTHROPIC_API_KEY='your-short-lived-key'
export ANTHROPIC_MODEL='model-id-from-your-account'
curl -fsS https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H 'anthropic-version: 2023-06-01' \
  -H 'content-type: application/json' \
  -d "{\"model\":\"$ANTHROPIC_MODEL\",\"max_tokens\":1024,\"messages\":[{\"role\":\"user\",\"content\":\"Explain this project\"}]}"
unset ANTHROPIC_API_KEY ANTHROPIC_MODEL
```

See the [Anthropic Messages API documentation](https://docs.anthropic.com/en/api/messages).

### Google Gemini native API

With full guest networking connected, call Gemini using its native API:

```sh
export GEMINI_API_KEY='your-short-lived-key'
export GEMINI_MODEL='model-id-from-your-account'
curl -fsS "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Explain this project"}]}]}'
unset GEMINI_API_KEY GEMINI_MODEL
```

See the [Gemini API documentation](https://ai.google.dev/api).

Native Claude and Gemini requests use ordinary guest networking. If `ip route`
has no default route, connect the AutoBro userspace helper or remote gateway
first. `vmfetch` is generally unsuitable for native provider APIs unless the
provider explicitly allows the portal origin through CORS.

Never paste a long-lived key directly into a command that will be retained in
shell history. Prefer restricted, short-lived credentials, clear relevant
history afterward, and unset every credential variable when finished.

## `vmllm` — local WebGPU model through AutoBro Web Bridge

```text
vmllm PROMPT...
vmllm chat PROMPT...
vmllm status
vmllm models
```

Examples:

```sh
vmllm status
vmllm models
vmllm 'Explain the build failure in one paragraph'
cat main.c | vmllm chat
VMLLM_SYSTEM='Return only a unified diff.' VMLLM_MAX_TOKENS=2048 \
  vmllm 'Patch the parser to reject an empty name.'
```

`vmllm` runs inference in the PC's browser WebGPU implementation, not inside the
32-bit guest. The VM page directly hosts LiteRT-LM and stores the selected
model in its origin-private filesystem. No extension, network gateway, native
process, or cloud API key is needed.

Before using it:

1. Open the VM in a WebGPU-capable desktop browser.
2. Click **Configure LLM** and select a compatible `.litertlm` or `.task` file.
3. Wait while the page copies it to OPFS and compiles the WebGPU kernels.
4. On later visits, the last cached model loads automatically.
5. Verify with `vmllm status`, then run a prompt.

Optional variables are `VMLLM_SYSTEM`, `VMLLM_MODEL`, and `VMLLM_MAX_TOKENS`.
Using a browser without WebGPU, clearing site storage, insufficient OPFS quota,
or having no model loaded causes a clear command error.

## Browser **Import file** control

1. Select **Import file** in the toolbar.
2. Choose one local file, no larger than 8 MiB.
3. The bridge writes it to `/root/SAFE_FILENAME`.
4. Verify it in the guest:

```sh
ls -l /root
sha256sum /root/SAFE_FILENAME
```

Unsafe filename characters are replaced with underscores. Import uses the
dedicated binary VirtIO 9P channel, so terminal input remains responsive during
the transfer.

## Troubleshooting

| Message or symptom | Meaning | Action |
|---|---|---|
| `blocked by CORS policy` | Destination did not authorize the page origin | Use a CORS-enabled endpoint or the full gateway |
| `Failed to fetch` | CORS, TLS, mixed content, offline browser, or destination failure | Check browser developer console and URL scheme |
| `browser-forbidden header` | JavaScript is not allowed to set that header | Remove the header or use full gateway-backed `curl` |
| `response exceeds ... limit` | Response passed 16 MiB | Use the full gateway or request a smaller/ranged resource |
| Clipboard permission error | Browser denied clipboard access | Focus the page, grant permission, and retry after a click |
| `no page-local LiteRT-LM model loaded` | No model is ready in this site origin | Click **Configure LLM** and select a compatible model |
| `WebGPU is unavailable` | Browser/GPU cannot expose WebGPU | Use current desktop Chrome/Edge with compatible GPU drivers |
| `curl: could not resolve host` without a route | No full gateway connection | Use `vmfetch` or configure the network gateway |

## `rig` — compact native coding agent

`rig 'TASK'` runs the low-latency Rig-compatible browser agent. It uses the
page-local WebGPU model and provides `read_file`, `list_directory`,
`write_file`, and `shell` tools rooted at the current project directory.

```sh
cd /root/project
rig 'Summarize this project'
rig 'Create hello.txt containing hello from the VM'
rig --codeact 'Create 5 files f1..f5.txt each containing its name'
```

The command sends one framed request directly to the browser and starts no
native runtime, HTTP proxy, or guest model process. Guest networking and an API
key are not required.

With `--codeact`, the model instead writes one POSIX shell script for the whole
task, which runs locally in the VM in a single `execute` round-trip — collapsing
the per-tool model calls and RPC round-trips of the default loop into roughly
one each. It is faster for multi-step tasks but relies on the model producing a
correct script, so prefer the default loop when a step needs to react to
intermediate results.

## Coding-agent tiers and shared facilities

All coding-agent commands use the ready page-local WebGPU model. They operate on
the directory where the command was invoked, normally `/root/project`, and can
read the canonical capability reference at
`/usr/local/share/vm-agent-capabilities.md`.

| Command | Agent foundation | Best suited to |
|---|---|---|
| `rig` | [Rig](https://github.com/0xPlaygrounds/rig) compatible compact loop | Low-latency tasks using four focused project tools |
| `rig --codeact` | Rig-compatible one-script mode | Tasks that can be completed safely by one POSIX shell script |
| `vmlang` | [DeepAgentsJS](https://github.com/langchain-ai/deepagentsjs) | Planning, filesystem work, persistent conversations, optional browser automation, and multi-step coding |
| `vmmastra` | [Mastra](https://github.com/mastra-ai/mastra) | Mastra workspace tools, selectable lean/full profiles, and fast batch execution |
| `vmmastra code` | Mastra-backed persistent coding thread | Interactive code/chat/batch modes with saved browser-side threads |
| `zerostack` | [Zerostack](https://github.com/gi-dellav/zerostack) | Native i686 coding-agent operation through the browser LLM adapter |

The VM adapters integrate these upstream projects with the browser-hosted model;
they are not unmodified upstream command-line distributions.

Shared facilities available to the agents include:

- Project file inspection and editing rooted at the invocation directory.
- BusyBox utilities plus `jq`, `rg`, `git`, `curl`, `tar`, `gzip`, `qjs`,
  `vmjs`, `shfmt`, `ctags`, `make`, `patch`, Grafana `k6`, and `k6obs`.
- `vmproject import/export` and the matching Settings controls for moving a
  project into or out of the VM.
- `vmfetch`, `vmgithub`, `vmclip`, and `vmexport` when ordinary guest networking
  or direct host integration is unavailable.
- AutoBro search and browser automation only when the active tier exposes those
  tools and the extension is connected.
- Approval controls for mutations and shell execution; YOLO mode bypasses those
  prompts for the current agent session.
- Persistent browser-side sessions for `vmlang`, `vmmastra`, and
  `vmmastra code`, with reset/stop commands for recovery.

Agents must verify executable code before reporting success. JavaScript is
tested with both `qjs` and `vmjs`, including elapsed time. POSIX shell scripts
are formatted with `shfmt`, checked with `sh -n`, and executed with
representative arguments. ShellCheck is not installed in the fixed-size i686
image.

## `vmmastra` — Mastra workspace agent

`vmmastra` runs a [Mastra](https://github.com/mastra-ai/mastra)-based agent in
the browser and maps its workspace filesystem and command tools to the current
VM project directory.

```text
vmmastra TASK...
vmmastra run TASK...
vmmastra batch TASK...
vmmastra status
vmmastra tools
vmmastra tools lean|full
vmmastra cost
vmmastra yolo on|off
vmmastra reset
vmmastra stop
```

- Plain `vmmastra` uses a tool loop that can inspect results between steps.
- `vmmastra batch` asks the model for one POSIX shell script, runs it in one
  guest round-trip, and falls back to the tool loop if the script fails.
- `tools lean` keeps the smaller workspace-focused profile; `tools full`
  includes browser-backed and parity tools. Changing profiles resets the
  current Mastra session.
- `status`, `tools`, and `cost` explain model readiness, approvals, active tools,
  and prompt budget without requiring a model task.
- `reset` discards a wedged conversation; `stop` aborts the task in flight.

For the persistent coding interface:

```text
vmmastra code
vmmastra code TASK...
vmmastra code threads
vmmastra code reset
```

Interactive `vmmastra code` supports `code`, `chat`, and `batch` modes. Threads
are stored in browser IndexedDB and remain available across page reloads.
Generated files are written under the directory from which `vmmastra code` was
started.

## `zerostack` — native i686 coding agent

`zerostack` runs the native Zerostack 1.5.0 agent inside the 32-bit guest while
using the configured page-local WebGPU model through the browser bridge.

```sh
cd /root/project
zerostack -p 'Summarize this project'
zerostack --version
```

While it runs, the launcher temporarily reserves the private RPC serial port
for an OpenAI-compatible loopback adapter. The normal hidden guest bridge shell
is restored automatically when Zerostack exits.

## Security boundary

Trust the page that hosts the VM: it processes bridge requests and can observe
their URLs, headers, bodies, and responses. Do not use secrets with an untrusted
or modified deployment. The browser bridge deliberately cannot bypass browser
security controls.

## `vmlang` — Deep Agents coding agent

The guest command `vmlang 'TASK'` uses the page-local WebGPU LLM and maps
DeepAgentsJS filesystem and shell tools to `/root/project`. Use `vmlang status`,
`stop`, `reset`, or `yolo on|off` for lifecycle control. After the first reply,
the browser keeps a persistent `vmlang>` conversation using the same agent
checkpoint; enter `/exit` to return to the guest shell. A hidden second UART
carries agent tool RPC while VM retains the visible primary console. YOLO is
on by default; use `vmlang yolo off` to require per-operation
browser confirmations. Running bare `vmlang` reads the first prompt; stdin
pipes can contain longer initial prompts.
Reads run automatically; edits and commands require browser confirmation. See
[the Deep Agents guide](deep-agent.html) for capabilities, skills, approvals, and
environment limits.
