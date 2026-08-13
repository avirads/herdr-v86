# vmvapt — Lightweight Agent-Based Web VAPT Framework for v86 (32-bit)

A modular, deterministic, AI-assisted **Web Application VAPT** orchestrator built
to run inside a 32-bit Linux VM on [v86](https://github.com/copy/v86) — the
browser-based x86 emulator. It coordinates the best-of-breed
[ProjectDiscovery](https://projectdiscovery.io) toolchain (httpx, katana, nuclei,
interactsh) and friends behind a **tool registry** and a **deterministic
controller**, so an LLM can help *interpret and report* — but can never execute
arbitrary commands.

> ⚠️ **Authorized use only.** This framework is for security assessments of
> systems you **own** or have **explicit written permission** to test. The Scope
> Guard (Agent 1) refuses out-of-scope, private, localhost, and wildcard targets
> by default, and every action is written to a tamper-evident audit log.

---

## Why Go (with TypeScript contracts)

| Constraint | How it's met |
|---|---|
| Runs inside v86, 32-bit Linux | Single static ELF, `GOARCH=386`, **~2.8 MB**, no libc |
| RAM < 512 MB | Streaming JSONL parsing, no in-memory corpus, stdlib-only |
| No Docker / K8s / Java / Chromium / Python | Pure Go orchestrator + native Go security tools |
| Prefer static binaries, cross-compile to linux/386 | `CGO_ENABLED=0 GOOS=linux GOARCH=386` |
| Prefer Go **or** TypeScript | Go core; **TypeScript interfaces** are the canonical data contract (`types/index.ts`) for any UI/agent |
| MIT/Apache-2.0 | Core is MIT; **every default tool is Go and MIT-licensed** |

The orchestrated tools (httpx, katana, nuclei, ffuf, urlfinder, interactsh) are
themselves Go static binaries that cross-compile to `linux/386`, so the entire
stack fits the target.

---

## Pipeline

```
Target → Scope Guard → HTTPX → Katana → URL Discovery → Parameter Discovery
       → Content Discovery → Nuclei → Interactsh → Finding Validator → LLM Report
```

Each stage is an independent **agent** that reads and writes structured JSON in a
confined **workspace**, so any stage can be run, tested, and *resumed*
independently.

| # | Agent | Capability → Tool | Output |
|---|---|---|---|
| 1 | Scope Guard | — (pure) | `scope.json` |
| 2 | Fingerprinting | `fingerprint` → httpx (default) \| native (built-in prober) | `httpx.jsonl` |
| 3 | Crawl | `crawl` → katana \| hakrawler \| gospider \| native | `katana.jsonl` |
| 4 | URL Discovery | `url_discover` → urlfinder | `urls.json` |
| 5 | Parameter Discovery | `param_discover` → ffuf (default) \| native | `parameters.json` |
| 6 | Content Discovery | `content_discover` → ffuf (default) \| native | `content.json` |
| 7 | Vulnerability | `scan` → nuclei (default) \| native (built-in checks) | `findings.jsonl` |
| 8 | OAST | `oast` → interactsh (self-hostable) | updates `findings.jsonl` |
| 9 | Validator | — (pure) | dedup + confidence in `findings.jsonl` |
| 10 | Report | — (+ optional LLM) | `report.{json,md,html}` |

Stages 2, 3, 6, 7 (and 5) have selectable **backends** — the heavy
ProjectDiscovery tools (httpx, katana, nuclei) plus lighter externals
(hakrawler/gospider) **and built-in `native` backends** implemented in Go inside
vaptr. With `configs/example.lightweight.json` (every backend `native`) a full
scan — fingerprint, crawl, content, params, and vulnerability findings — runs
from **just the ~6 MB vaptr binary with zero external tools**, ideal for the v86
guest. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component and
data-flow diagrams.

---

## Quick start

```bash
# 1. Build native binary
make build            # -> ./vaptr

# 2. See the tool registry (the LLM may invoke ONLY these)
./vaptr caps

# 3. Run the fully-offline demo (no external tools needed)
make demo

# 4. Run a real scan against a target you are authorized to test
./vaptr scan -config configs/example.scan.json
```

Build the v86 target:

```bash
make linux386         # -> dist/vaptr-linux-386  (static 32-bit ELF)
# or: sh scripts/build-386.sh
```

See [docs/BUILD.md](docs/BUILD.md) for the full `linux/386` + v86 guide.

---

## Directory structure

```
vmvapt/
├── cmd/vaptr/            # CLI entrypoint + terminal dashboard
├── internal/
│   ├── model/            # canonical data structures (1:1 with schemas & TS)
│   ├── scope/            # Agent 1: Scope Guard (trust boundary)
│   ├── registry/         # Tool Registry — the only path to execution
│   ├── runner/           # exec runner (no shell) + Fake runner for tests
│   ├── workspace/        # filesystem-confined artifacts + resume checkpoints
│   ├── audit/            # tamper-evident, hash-chained audit log
│   ├── agents/           # Agents 2–10
│   ├── controller/       # deterministic orchestrator (drives control flow)
│   ├── llm/              # report-narrative provider seam (LLM confined here)
│   └── config/           # JSON config loader + validation
├── types/index.ts        # TypeScript data contract
├── schemas/              # JSON Schemas for every artifact
├── configs/              # example scan configs
├── examples/demo/        # offline vulnerable-app example scan
├── scripts/              # build-386.sh / .ps1
├── deploy/               # self-hosted interactsh OAST server artifacts
├── docs/                 # architecture, build, security, extensions, oast, dev guide
├── Makefile
└── go.mod                # stdlib-only; no external Go dependencies
```

---

## Security model (the important part)

1. **The LLM never executes anything.** It receives a finished, validated
   `Report` and returns prose (`internal/llm`). Control flow is owned entirely by
   the deterministic controller.
2. **The Tool Registry is the only execution path.** Agents request a
   *capability* (`scan`), never a binary or flag. Unknown capabilities, unknown
   flags, and values with shell metacharacters are rejected before exec.
3. **No shell, ever.** The runner calls `exec` with an explicit argv — no
   `sh -c`, so no value can be re-interpreted as a command.
4. **Scope is enforced first.** Nothing runs until the Scope Guard approves a
   target. Private/localhost/wildcard are refused unless explicitly opted in.
5. **The workspace is a jail.** All reads/writes are confined to one scan
   directory; `..` and path separators in artifact names are rejected.
6. **Everything is audited.** A hash-chained `audit.jsonl` makes truncation or
   edits detectable after the fact.

Full details: [docs/SECURITY.md](docs/SECURITY.md).

---

## Performance

- **Startup < 5 s** — the demo pipeline completes in ~150 ms with fixtures; real
  runs are dominated by the network-bound tools, not the orchestrator.
- **Resumable** — each stage checkpoints to `state.json`; re-running skips
  completed stages and reloads their artifacts.
- **Streaming** — JSONL is parsed line-by-line; memory stays flat regardless of
  target size.

---

## Extending

Design extension points exist for SQLMap, Dalfox, Semgrep, OWASP ZAP, custom
Nuclei templates, additional LLM providers, and a browser-based visualization.
See [docs/EXTENSIONS.md](docs/EXTENSIONS.md).

## License

MIT — see [LICENSE](LICENSE). Orchestrated third-party tools retain their own
licenses (recorded per-tool in the registry).
