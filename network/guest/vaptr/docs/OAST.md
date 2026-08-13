# OAST — Out-of-band Application Security Testing (Agent 8)

OAST catches **blind** vulnerabilities: bugs where the target is exploitable but
the HTTP response reveals nothing (blind SSRF, blind command injection/RCE,
blind XXE, out-of-band SQLi). Instead of matching on the response, a payload
makes the *target server* reach out to an interaction server you control. A
callback = proof the server did something it shouldn't have.

## Flow

```
nuclei injects payload containing  <corr-id>.oast.fapstaff.com
        │
        ▼
target server (if vulnerable) resolves / requests that host
        │  DNS or HTTP
        ▼
interactsh server (self-hosted, see deploy/) records the interaction, tagged <corr-id>
        │
        ▼
correlation by <corr-id> → the finding that used it is promoted to "verified"
```

The correlation id is a unique subdomain, so each interaction ties back to the
exact template/target/request that triggered it.

## How vmvapt wires it

**Primary path — nuclei's built-in interactsh (in-scan).** When `oast.server`
is configured, the vulnerability agent passes `-interactsh-server` /
`-interactsh-token` to nuclei. Nuclei registers with **your** server, injects
OAST payloads, and correlates callbacks *while it scans* — OAST-confirmed
findings come straight out of the vuln stage.

**Supplementary path — Agent 8 (the OAST monitor).** Agent 8 reads any raw
interaction stream captured to the workspace as `interactsh.jsonl` (e.g. an
operator-run `interactsh-client -json -o interactsh.jsonl` bridged to the same
server), correlates by interaction id against `findings.jsonl`, attaches the
callback, and promotes the finding's confidence to `verified`. Absent that file
it is a graceful no-op.

`verified` from an OAST callback is the **only** automatic path to that
confidence state (see `validator.Score`); pattern-only matches top out at
`candidate` / `needs_manual_validation`.

## Two lessons the live run taught (both fixed)

1. **Parser mismatch.** interactsh-client's real `-json` output uses hyphenated
   fields — `unique-id`, `remote-address`, `raw-request` — not the snake_case of
   the canonical model. The agent now decodes a raw `interactshEvent` struct and
   maps it to `model.OASTEvent`; `internal/agents/testdata/interactsh.real.jsonl`
   + `TestParseInteractsh_RealOutput` lock it against real output. (The original
   fixture test passed only because the fixture used invented field names — the
   trap real output exposes.)
2. **Daemon hang.** `interactsh-client` polls forever; running it synchronously
   would hang the stage until timeout, and a client started only at the OAST
   stage registers a *different* domain than nuclei used. So Agent 8 does **not**
   exec the daemon — it reads the captured stream, and live correlation is
   nuclei's job during the vuln stage.

## Self-hosting

Use your own interactsh server so interactions stay on your infrastructure. Full
reproducible setup (systemd unit, nginx, firewall, DNS delegation, TLS) in
[../deploy/README.md](../deploy/README.md). Config: `oast.server` +
`oast.token_env` (the token is read from the named env var, never stored).

## Limitations

- **Delegation type.** Full OAST (incl. DNS-based) needs the OAST zone genuinely
  delegated via an `NS` record so interactsh is authoritative DNS. If your DNS
  panel lacks `NS` (e.g. Hostinger's basic editor), a **wildcard A**
  (`*.oast.<zone> → server IP`) still enables **HTTP/HTTPS OAST** — the common
  blind-SSRF/RCE-over-HTTP cases — but **not DNS-based OAST** (those lookups are
  answered by your DNS host, not interactsh). The live fapstaff.com deployment
  uses this wildcard-A mode; it's proven end-to-end for HTTP/HTTPS callbacks.
- HTTPS callbacks to `<id>.<zone>` use interactsh's self-signed cert unless you
  add a `*.<zone>` wildcard TLS cert (DNS-01/TXT). HTTP callbacks need no cert;
  the base domain gets a normal cert via `certbot --nginx`.
- The offline v86 guest has no route to a public callback server, so OAST there
  requires a reachable interactsh server (like the self-hosted one).
