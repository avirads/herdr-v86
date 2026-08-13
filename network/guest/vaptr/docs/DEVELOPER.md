# Developer Guide

## Layout & responsibilities

See [ARCHITECTURE.md](ARCHITECTURE.md) §7 for the package responsibility table.
The golden rules:

- Exactly one package execs: `runner`.
- Exactly one package touches arbitrary files: `workspace`.
- Exactly one constructor makes an `Invocation`: `registry.Build`.
- The LLM lives behind exactly one interface: `llm.Provider`.

If a change would break any of those, it needs a security review.

## Building & testing

```bash
make vet         # go vet ./...
make test        # unit + integration
make test-race   # race detector (host arch)
make demo        # offline end-to-end
make linux386    # cross-compile the v86 artifact
```

The module is **stdlib-only**. Do not add third-party Go dependencies without a
strong reason — they enlarge the binary, slow startup, and add supply-chain risk
that undercuts the framework's own threat model. `go.mod` should stay clean.

## Adding an agent (checklist)

1. New `model.Stage` constant + append to `model.OrderedStages`.
2. New capability + `Tool` in `registry` with a **minimal** `AllowedArgs`.
3. New file in `agents/` implementing `Agent`; parse with `eachJSONLine[T]`.
4. Handle `errors.Is(err, runner.ErrToolMissing)` → write empty artifact.
5. Apply `rateArgs(...)` for the tool's rate/concurrency flags.
6. Insert into `controller.pipeline` at the right position.
7. Unit test the parser; add a fixture to `controller_test.go`.
8. Add a JSON Schema in `schemas/` and a TS interface in `types/index.ts`.

## Testing patterns

- **Deterministic clocks**: pass `Now func() time.Time` (agents/controller) and
  `WithClock` (scope/audit) so timestamps are reproducible.
- **Fake runner**: `runner.Fake{Outputs: map[Capability][]byte}` records calls
  and returns canned output — no external tools needed. The integration test
  asserts on the *whole* pipeline this way.
- **Resume**: `controller_test.TestPipeline_Resume` proves a second run invokes
  zero tools.
- **Windows note**: the audit log file handle is closed by `Controller.Close`
  (deferred in `Run`) so `t.TempDir()` cleanup succeeds on Windows.

## Live parser validation harness

The tool-output parsers (`parseHTTPX`, `parseKatana`, `parseNuclei`) are pure
functions locked onto **real** captured output, so a tool version bump that
changes JSON shape fails a test instead of silently mis-parsing.

- `internal/testserver` is a tiny localhost HTTP server exposing crawlable
  links, a JS file, an `/api` endpoint, and a planted `/.git/config` (so a real
  Nuclei exposure template fires). It is authorized by definition — the
  operator's own loopback.
- `internal/agents/testdata/*.real.jsonl` are outputs captured from the actual
  installed httpx / katana / nuclei against that server.
- `internal/agents/realoutput_test.go` runs the parsers over those fixtures.

To refresh the fixtures after installing/upgrading tools:

```bash
go run ./internal/testserver -addr 127.0.0.1:8899 &   # start target
echo http://127.0.0.1:8899 | httpx  -json  -td -silent            > internal/agents/testdata/httpx.real.jsonl
echo http://127.0.0.1:8899 | katana -jsonl -jc -silent            > internal/agents/testdata/katana.real.jsonl
echo http://127.0.0.1:8899 | nuclei -jsonl -id git-config -silent > internal/agents/testdata/nuclei.real.jsonl
go test ./internal/agents/ -run RealOutput
```

**Targets reach tools via stdin.** Agents feed the scope-approved target list to
httpx/katana/nuclei/urlfinder through `Invocation.Stdin` (see `targetStdin`),
never as a file-path argument — which keeps the registry's arg allowlist strict
(no path separators) and avoids any shell involvement.

A full live run against the local server (`configs/live-local.json`) completes
the whole pipeline; expect the Nuclei stage to dominate wall-clock (minutes)
because it runs the auto-selected template set — the orchestrator itself stays
in the millisecond range.

## Data contract discipline

`internal/model` (Go), `schemas/*.json` (JSON Schema), and `types/index.ts`
(TypeScript) describe the **same** shapes and must be kept in sync. JSON field
names are snake_case in all three. When you change a struct:

1. update the `json:"..."` tag,
2. update the matching schema,
3. update the TS interface.

## Coding conventions

- Match the surrounding style; keep functions small and single-purpose.
- Pure decision logic (e.g. `scope.decide`, `validator.Score`) stays free of I/O
  so it is trivially testable.
- Errors wrap with `%w` and a stage/agent prefix (`fmt.Errorf("crawl: run: %w")`).
- No `panic` outside `mustRegister` (programmer error at startup).

## Release

```bash
make release     # dist/vaptr-linux-386 + dist/vaptr-linux-amd64
```

Set the version: `make release VERSION=0.2.0` (stamped into `main.version`).

## CI recommendation

```yaml
steps:
  - run: go vet ./...
  - run: go test ./...
  - run: CGO_ENABLED=0 GOOS=linux GOARCH=386 go build ./cmd/vaptr
  - run: go run ./examples/demo   # smoke test the pipeline
```
