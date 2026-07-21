# Browser-backed guest tools

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

## Security boundary

Trust the page that hosts the VM: it processes bridge requests and can observe
their URLs, headers, bodies, and responses. Do not use secrets with an untrusted
or modified deployment. The browser bridge deliberately cannot bypass browser
security controls.

## `vmagent` — Deep Agents coding agent

The guest command `vmagent 'TASK'` uses the page-local WebGPU LLM and maps
DeepAgentsJS filesystem and shell tools to `/root/project`. Use `vmagent status`,
`stop`, `reset`, or `yolo on|off` for lifecycle control. After the first reply,
the browser keeps a persistent `vmagent>` conversation using the same agent
checkpoint; enter `/exit` to return to the guest shell. A hidden second UART
carries agent tool RPC while VM retains the visible primary console. YOLO is
on by default; use `vmagent yolo off` to require per-operation
browser confirmations. Running bare `vmagent` reads the first prompt; stdin
pipes can contain longer initial prompts.
Reads run automatically; edits and commands require browser confirmation. See
[the Deep Agents guide](deep-agent.md) for capabilities, skills, approvals, and
environment limits.
