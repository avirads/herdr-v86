# Example Scan — Deliberately Vulnerable Training App

This walks through scanning a **self-hosted, deliberately vulnerable** training
application (OWASP Juice Shop). Only ever run this against an instance **you host
yourself**.

## A) Offline demo (no tools, no network)

The fastest way to see the whole pipeline produce findings:

```bash
make demo
# or: go run ./examples/demo
```

This drives the controller with recorded tool outputs (`examples/demo/main.go`)
for a simulated `juice-shop.test`, and prints the Markdown report. It exercises
Scope Guard → … → Report exactly as a live run would, including:

- scope rejecting `127.0.0.1` and `*.juice-shop.test` (1/3 approved),
- a **critical** error-based SQLi finding,
- a **high** blind-SSRF finding **verified** via a correlated OAST callback,
- an exposed `.git/config` and default admin credentials.

Artifacts land in `examples/demo/workspace/`.

## B) Live scan against your own Juice Shop

### 1. Stand up the target (on a host you own)

Juice Shop is a Node app; run it however you like on a private host, e.g.
`http://juice.local:3000`. (The scanner itself needs no Node — this is just the
target.)

### 2. Install the tools (host or v86 guest)

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/httpx/cmd/httpx@latest
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/katana/cmd/katana@latest
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/ffuf/ffuf/v2@latest
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/urlfinder/cmd/urlfinder@latest
CGO_ENABLED=0 GOOS=linux GOARCH=386 go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
```

### 3. Author the scan config

`juice.scan.json`:

```json
{
  "target": "juice.local",
  "targets": ["http://juice.local:3000"],
  "workspace": "./workspace/juice",
  "scope": {
    "allowed_domains": ["juice.local"],
    "allow_subdomains": true,
    "allow_private": true,
    "rate_limit": 20,
    "max_concurrency": 4,
    "authorization": "Self-hosted training lab; owner-operated"
  },
  "llm": { "provider": "none" }
}
```

> `allow_private: true` is required here because `juice.local` resolves to a
> private address — this is the explicit opt-in the Scope Guard demands.

### 4. Run

```bash
vaptr scan -config juice.scan.json
```

You'll see the terminal dashboard tick through the ten stages. Outputs in
`workspace/juice/`:

```
scope.json  httpx.jsonl  katana.jsonl  urls.json  parameters.json
content.json  findings.jsonl  report.json  report.md  report.html
audit.jsonl  state.json
```

### 5. Resume

If interrupted (`Ctrl-C`), just run the same command again — completed stages are
skipped. Use `-force` to re-run everything.

### 6. Read the report

Open `report.html` in a browser, or read `report.md`. Each finding carries
title, severity, confidence, affected URL, evidence, reproduction, remediation,
and references.

## Interpreting confidence

| State | Meaning |
|---|---|
| `verified` | corroborated by an out-of-band (OAST) callback |
| `candidate` | matched with supporting evidence; likely real |
| `needs_manual_validation` | high/critical but only pattern-matched — confirm by hand |
| `informational` | info-severity context |
| `false_positive` | dismissed (set during manual triage) |

## Verifying the audit trail

```bash
# every scope decision and tool invocation is logged and hash-chained
cat workspace/juice/audit.jsonl
```

A helper that replays and verifies the chain is available via `audit.Verify` in
Go tooling.
