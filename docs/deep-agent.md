# Deep Agents coding agent

The browser demo integrates DeepAgentsJS with the real `/root/project`
filesystem inside v86. The agent uses the page-local LiteRT-LM WebGPU model and
does not require a browser extension or cloud API.

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

Choose **New session** to discard the panel's conversation checkpoint. Guest
files remain unchanged until edited or the VM is restarted/restored.

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

## YOLO mode

**Enable YOLO** removes per-operation approval for the current open page only.
Enabling it requires a prominent confirmation and displays a persistent red
warning. **Disable YOLO**, **New session**, or a page reload turns it off. The
choice is never stored in localStorage, OPFS, a VM snapshot, or the URL.

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
4. Open **Agent** and give it a concrete task including expected verification.
5. Review each requested mutation or command before approving it.

Example:

```text
Inspect the parser, reproduce the failing test, fix the smallest underlying
bug, rerun the relevant tests, and summarize changed files and evidence.
```
