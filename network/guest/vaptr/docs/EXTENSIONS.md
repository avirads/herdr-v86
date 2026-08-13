# Extending vmvapt

The framework is built around three seams. Adding capability means plugging into
one of them — never bypassing the registry or the controller.

## Seam 1 — New tools (register a capability)

To add SQLMap, Dalfox, Semgrep, or ZAP-CLI, register the tool and write a thin
agent.

1. **Register the capability** in `internal/registry/registry.go`:

   ```go
   const CapExploit Capability = "exploit"

   r.mustRegister(Tool{
       Capability: CapExploit, Binary: "dalfox", License: "MIT",
       Description: "XSS scanner",
       AllowedArgs: set("pipe", "-o", "--rate-limit", "--worker", "--format"),
   })
   ```

   Only flags in `AllowedArgs` can ever be passed — this is the security review
   surface for a new tool. Keep it minimal.

2. **Write an agent** in `internal/agents/` implementing the `Agent` interface
   (`Name`, `Stage`, `Run`). Copy `contentdisc.go` as a template: build args →
   `Registry.Build` → `Runner.Run` → parse JSONL → write artifact. Handle
   `errors.Is(err, runner.ErrToolMissing)` so a missing tool degrades gracefully.

3. **Insert it into the pipeline** in `internal/controller/controller.go`'s
   `pipeline` slice at the right position. Add a `model.Stage` constant and
   append it to `model.OrderedStages`.

**Selectable backends.** A capability can have several interchangeable backends
(as `crawl` does: katana | hakrawler | gospider). Register each with a distinct
`Backend` name and its own `AllowedArgs`; the first registered is the default.
The operator selects one via config (e.g. `"crawl": {"backend": "hakrawler"}`),
the agent calls `Registry.BuildBackend(cap, backend, args)` and parses that
backend's output format (validate each parser against a real-output fixture,
like `testdata/hakrawler.real.jsonl`). This is how you add a lighter/heavier
alternative for a stage without touching the LLM-facing capability list. Sizes
matter for the v86 target: hakrawler (~11 MB) / gospider (~13 MB) vs katana
(~55 MB) — see the sizing notes in the crawl backend work.

**In-process backends.** A backend can be pure Go inside vaptr with no external
binary — mark its `Tool` with `InProcess: true` (the registry then refuses to
build an exec `Invocation` for it) and have the agent run it directly. The
`scan → native` backend (`internal/agents/native.go`) is the reference: a
curated set of high-signal HTTP checks (exposed `.git/config` & `.git/HEAD`,
`.env` secrets, `phpinfo()`, directory listing, missing security headers) that
produces real `Finding`s with **zero external tools or templates** — a full
scan runs even on an empty `PATH`. It respects scope (only approved targets) and
the rate limit, staying inside the trust boundary. It trades nuclei's
10k-template breadth for ~0 footprint; use `"scan": {"backend": "native"}` on
size-constrained hosts like the v86 guest, nuclei on a real host for depth.

The `fingerprint → native` backend (`internal/agents/nativefp.go`) is the same
idea for httpx: an in-process HTTP prober producing the same `model.Fingerprint`
fields (status/title/server/TLS/redirects + header/cookie/body tech detection)
without httpx's ~62 MB Wappalyzer DB. Native backends exist for **fingerprint, crawl, content, params, and scan**
(`nativefp.go`, `nativecrawl.go`, `nativediscover.go`, `native.go`). With every
backend set to `native` (see `configs/example.lightweight.json`) a full scan —
fingerprint → crawl → content → params → vulnerability — runs entirely inside
the ~6 MB vaptr binary with **zero external tools** (verified on an empty PATH).
That replaces httpx + katana + ffuf + nuclei (~280 MB of binaries + templates).
The deliberate trade is breadth: native detection is a curated subset, not
httpx's full tech DB or nuclei's 10k templates — the low-footprint/offline
choice (v86, air-gapped, quick triage), with the external tools one config line
away for depth on a real host.

Candidate integrations and where they fit:

| Tool | Capability | Slots after | Notes |
|---|---|---|---|
| Dalfox | `exploit` (XSS) | Parameter Discovery | feed discovered params |
| SQLMap | `exploit` (SQLi) | Vulnerability | gate on nuclei sqli hits; **destructive — keep opt-in** |
| Semgrep | `sast` | (pre-pipeline) | source-code mode, separate scope rules |
| OWASP ZAP (`zap-cli`) | `activescan` | Content Discovery | heavier; cap concurrency |
| Custom Nuclei templates | `scan` | — | add a `-t <workspace-path>` flag to `AllowedArgs` and ship templates in the workspace |

## Seam 2 — LLM providers

Implement `llm.Provider`:

```go
type Provider interface {
    Summarize(ctx context.Context, rep model.Report) (string, error)
}
```

Wire it in `cmd/vaptr/main.go`'s `selectLLM`. Use `llm.PromptFor(rep)` for a
shared prompt. Guidelines:

**Bundled: the WebGPU model via `vmllm`.** `provider: "vmllm"` (see
`configs/example.vmllm.json`) uses `llm.CommandProvider` to run herdr's `vmllm`
CLI, which bridges to the browser's WebGPU LiteRT-LM model when vaptr runs
inside the v86 guest. Two hard-won details, both encoded in
`internal/llm/command.go`:
- the prompt is passed as the final **argv element**, not on stdin — `vmllm
  chat` (stdin mode) requires an interactive TTY and fails under a piped exec;
- `cmd.Stdin = os.Stdin` — vmllm runs `stty` and reads its RPC reply from the
  controlling TTY, so it needs a real terminal on fd 0. Go connects a child's
  stdin to /dev/null by default, which makes vmllm bail with "stty: standard
  input: Not a tty". When vaptr's own stdin is not a TTY, vmllm fails and the
  report cleanly falls back to the offline template.

`CommandProvider` works for any local model CLI that takes a prompt argument and
prints a completion — point `llm.command` at it.


- Providers receive **only** the `Report` — never tool access.
- Read the API key from `os.Getenv(cfg.APIKeyEnv)`; never from the config file.
- On any error, return it — the report agent falls back to the offline template,
  so a provider outage never fails a scan.
- Multiple providers: switch on `cfg.LLM.Provider` (`openai`, `anthropic`,
  `local`). A `local` provider can target a model served **inside** the v86 VM
  to keep everything offline.

## Seam 3 — Browser-based visualization

Everything is JSON, and `types/index.ts` is the ready-made contract. A browser
UI (served from the v86 host page) can:

- Read `report.json` and render with the `Report`/`Finding` interfaces.
- Stream progress by reading the CLI's `-json` event log (each line is a
  `controller.Event`).
- Render the pre-built `report.html` directly in an `<iframe>` for a zero-code
  view.

Because the contract is shared, a future **TypeScript agent** running in the
browser can implement the same `Agent` interface shape (`types/index.ts`) and
talk to the same artifacts.

## Design rules for any extension

1. Never add a code path that execs without going through `registry.Build` +
   `runner`.
2. Never read/write outside `workspace`.
3. Keep new tool arg-allowlists as small as the feature needs.
4. Add unit tests for parsing and a fixture to the integration test.
5. Preserve resumability: one stage = one artifact = one `state.json` key.
