# Browser-backed guest tools

Every coding-agent tier can read the canonical in-guest capability reference at
`/usr/local/share/vm-agent-capabilities.md`. Zerostack also receives the same
content as its global `AGENTS.md`, so newly started agents discover it
automatically.

The main page revalidates its versioned VM image URL at boot. If the hosted
image is not newer, the browser loads the existing local HTTP-cache entry.
Change `DISK_VERSION` in `index.html` whenever `vm-network-ext4.img` changes.
After a VM version boots successfully, the page records that version locally.
Every long-lived startup message then includes `[local cache]` for that same
version or `[remote]` for a new version. The source is not inferred from a
one-byte Range cache probe because browsers do not reliably expose cached
partial responses through `only-if-cached`.

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

The browser opens its normal download flow. Maximum file size is 8 MiB. Export
only regular files; directories should first be archived.

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
rejected. Exports are limited to the browser bridge's 8 MiB compressed-file
limit.

The guest also includes `git`, `rg` (ripgrep), `jq`, `curl`, `shfmt`, `ctags`,
`make`, and `patch`. ShellCheck is documented but is not installed because
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
interactive serial console; avoid typing while a large file is being imported.

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
[the Deep Agents guide](deep-agent.md) for capabilities, skills, approvals, and
environment limits.
