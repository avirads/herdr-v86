# Deep Agents coding agent

The browser demo integrates DeepAgentsJS with the real `/root/project`
filesystem inside v86. Run it from the guest terminal with `vmagent`; there is
no separate agent panel. The agent uses the page-local LiteRT-LM WebGPU model
and does not require a browser extension or cloud API.

```sh
vmagent 'Inspect the project, fix the failing test, and verify the change.'
cat task.txt | vmagent
vmagent status
vmagent stop
vmagent reset
vmagent yolo on
vmagent yolo off
```

The command submits the task and the browser temporarily reserves terminal
input while DeepAgents uses the serial bridge for guest tools. Results and
activity are printed in the same terminal. Press Ctrl-C to request a stop.

## Framework capabilities

The integration enables the framework's standard coding-agent facilities:

- `write_todos` planning and progress tracking
- `ls`, `read_file`, `glob`, and `grep`
- `write_file` and exact-string `edit_file`
- `execute` for BusyBox shell commands in `/root/project`
- the general-purpose `task` subagent for delegated work
- automatic large-context management and summarization
- project instructions from `/root/project/AGENTS.md`
- project skills discovered under `/root/project/skills/*/SKILL.md`
- an in-memory conversation checkpoint retained across prompts in the panel
- typed `vmfetch`, `vmgithub`, `vmclip`, `vmexport`, `vmai`, and `vmllm_info`
  tools backed by the browser bridge

Run `vmagent reset` to discard the conversation checkpoint. YOLO returns to its
default enabled state. Guest files remain unchanged until edited or the VM is
restarted/restored.

## Approval boundary

Reads, listing, globbing, grep, planning, memory loading, and delegated analysis
run automatically. The browser displays the exact operation and asks for
confirmation before every:

- file creation or overwrite;
- exact-string edit;
- file deletion; or
- shell command.

Approval is enforced in the guest backend, not merely requested in the model
prompt. Rejecting an operation returns a tool error to the agent. Shell approval
is intentionally required because a shell can mutate files, use credentials,
or access the network when a gateway is attached.

## Browser-backed `vm*` tools

The agent receives typed schemas for the gateway-free guest commands instead
of having to construct opaque shell strings:

| Agent tool | Guest capability |
|---|---|
| `vmfetch` | HTTPS/localhost browser fetch with method, headers, body, and output path |
| `vmgithub` | Repository metadata, API requests, and source archives |
| `vmclip` | Browser clipboard read or write |
| `vmexport` | Download a guest file through the browser |
| `vmai` | OpenAI-compatible Responses API through browser fetch |
| `vmllm_info` | Page-local LiteRT-LM status and model discovery |

All except the read-only `vmllm_info` require approval, or active YOLO mode.
Browser CORS, permission, response-size, credential, and user-gesture rules
still apply. `vmllm` chat is intentionally not exposed because asking the agent
to invoke its own underlying model recursively can deadlock or exhaust context;
the agent already talks directly to that model.

These tools are not browser automation. For example, `vmfetch` cannot search or
scrape `google.com` because Google does not grant cross-origin fetch access, and
it cannot click or inspect rendered pages. Use a CORS-enabled search/API service
or a separately authorized browser-automation integration for that workflow.

## AutoBro browser automation

Install/load the AutoBro Web Bridge extension from `web-bridge/extension`, then
click **Connect AutoBro** in the VM header and enter its extension ID and pairing
token. The ID is retained in localStorage; the token exists only in the current
tab's sessionStorage. Connecting AutoBro resets the current agent harness so the
next run receives the `autobro_command` tool.

That tool covers bridge-v3 tab management, navigation, page/DOM inventory,
visible actions, forms, coordinate clicks, text/key input, scrolling, waits,
dialogs, screenshots, JavaScript/CDP, uploads, skills, and enabled domain
commands. Example prompts include:

```text
Go to google.com, search for test, and report the result-page title and URL.
Open a new tab, navigate to the application, inspect visible actions, and stop.
```

For search-engine prompts, the agent also receives a dedicated
`browser_search` tool supporting Google, Bing, and DuckDuckGo. It opens a real
AutoBro-controlled tab, waits for load, and returns page metadata. Interactive
search-engine URLs passed to `vmfetch` produce a recoverable instruction to use
`browser_search` rather than aborting the agent graph.

Every AutoBro call requires approval unless YOLO is active, including read-only
inspection, because logged-in pages may contain private information. The
extension retains its own origin allow-list and pairing-token checks. Chrome
internal pages cannot be automated. Screenshot image data is omitted from the
text model context to prevent context exhaustion; DOM inventory is the primary
inspection path for the current text-only LiteRT model.

## Automatic provider switching

Equivalent operations now switch providers automatically after one disclosed
approval. Tool results include `switchedProvider` so the agent can continue with
the provider that actually completed the operation:

| Primary operation | Automatic fallback |
|---|---|
| `vmfetch` GET fails, or targets an interactive search site | Open and inspect the URL with AutoBro |
| `vmgithub repo` or `archive` fails | Open the repository page with AutoBro |
| `vmclip write` fails | Type the text into AutoBro's focused page element |
| AutoBro `newTab` or `gotoUrl` fails for an HTTPS URL | Read raw content with `vmfetch` |

The approval dialog identifies the possible fallback before execution; YOLO
applies to the same combined operation. Switching is intentionally unavailable
where the operations are not equivalent: non-GET HTTP requests, GitHub API
calls, clipboard reads, exports, AI API calls, clicks/forms, screenshots,
uploads, dialogs, and arbitrary JavaScript/CDP. An AutoBro fallback opens a page
but does not create the guest output file originally requested from `vmfetch`.

## YOLO mode

YOLO is enabled by default for each page session, so agent writes, deletions,
shell commands, and browser actions run without per-operation confirmation.
Run `vmagent yolo off` before a task to restore approval prompts. Turning it
back on with `vmagent yolo on` requires browser confirmation. `vmagent reset`
and page reload both restore the enabled default. The choice is never stored in
localStorage, OPFS, a VM snapshot, or the URL.

YOLO mode preserves RPC path validation, 64 KiB limits, and the 120-second
command timeout. However, an approved arbitrary shell is not confined to the
project directory: it starts in `/root/project` but can alter the entire guest,
read guest credentials, install software, and use any attached network. Use it
only with a disposable VM/project and no secrets.

## Environment limits

This is feature parity with the DeepAgentsJS coding loop, adapted to the v86
sandbox—not parity with a modern x86-64 workstation:

- the guest is Alpine Linux i386 with BusyBox `sh`;
- individual RPC inputs and outputs are limited to 64 KiB;
- shell commands time out after 120 seconds;
- binaries and packages must support 32-bit x86;
- ordinary networking requires the external gateway; gateway-free `vm*` tools
  remain subject to browser policy;
- the page-local Gemma E2B model is much smaller than hosted frontier models,
  so long autonomous tasks may need narrower prompts and more supervision;
- checkpoints survive multiple prompts in the open page, but not a page reload.

The LiteRT engine reserves a 16,384-token context window. DeepAgentsJS receives
that model profile and automatically summarizes older conversation/tool history
at 85% utilization, preventing the previous 8,192-token startup overflow caused
by the framework's complete native tool catalogue.

## Setup

1. Download the model with the link in the VM header.
2. Select it with **Configure LLM** and wait for WebGPU compilation.
3. Prepare a project at `/root/project`.
4. Run `vmagent 'TASK'` with a concrete task including expected verification.
5. Review each requested mutation or command before approving it.

Example:

```text
Inspect the parser, reproduce the failing test, fix the smallest underlying
bug, rerun the relevant tests, and summarize changed files and evidence.
```
