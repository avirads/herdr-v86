# Read-only coding agent

The browser demo includes a Deep Agents–based coding assistant that can inspect
a project inside the v86 guest. In the toolbar, click **Configure LLM** and
select a compatible LiteRT-LM model, then open **Agent**, enter a question, and
choose **Run analysis**. The model runs directly in the page through WebGPU; no
browser extension is required.

## Guest contract

The inspected workspace is `/root/project`. The agent can call only these RPC
operations:

| Tool | Capability |
|---|---|
| `guest_list` | List workspace paths and metadata |
| `guest_read` | Read up to 64 KiB from a regular file |
| `guest_grep` | Search workspace file contents |
| `guest_test` | Run one fixed test recipe after browser confirmation |

Test recipes are `make-test` (`make test`), `make-check` (`make check`), and
`shell-tests` (`./test.sh`). The RPC rejects absolute paths, `..` traversal,
and symlinks that resolve outside `/root/project`. Output is capped at 64 KiB.

This milestone deliberately has no tool for writing, deleting, renaming,
downloading, installing, starting arbitrary commands, or using credentials.
The model can explain findings and propose changes, but cannot apply them.

## Importing a project

The existing **Import file** control imports a single file into `/root`, not a
whole project. For agent inspection, prepare `/root/project` in a custom image,
restore a snapshot containing that directory, or use the serial console to
create/extract files there. Do not put secrets in the workspace or snapshot.

## Development and verification

The browser bundle is reproducible from its checked-in sources:

```text
cd agent
npm ci
npm run build
npm test
cd ..
node network/test/host-bridge-runner.mjs
```

The final command needs Chrome through `CHROME_BIN`. It boots v86 and verifies
vmfetch, the WebGPU bridge contract, list/read/grep RPC, and a scripted agent
tool call without requiring a real model response.
