package agents

import (
	"context"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// OAST is Agent 8. It correlates Interactsh out-of-band interactions back to
// findings and promotes any finding that triggered a callback to "verified" —
// an out-of-band callback is strong evidence of a real (often blind)
// vulnerability.
//
// Design note (learned from running interactsh live): interactsh-client is a
// long-running daemon that polls forever, so this agent does NOT exec it
// synchronously (that would hang the stage). Instead:
//   - Nuclei performs the primary, in-scan OAST correlation via its built-in
//     interactsh (the vuln agent passes -interactsh-server / -interactsh-token
//     for the self-hosted server); OAST-confirmed findings arrive already
//     marked from that stage.
//   - This agent additionally reads any raw interaction stream captured to the
//     workspace as interactsh.jsonl (e.g. by an operator-run
//     `interactsh-client -json -o interactsh.jsonl` bridged to the same
//     self-hosted server) and correlates by interaction id. Absent that file it
//     is a graceful no-op.
type OAST struct{}

func (OAST) Name() string       { return "oast" }
func (OAST) Stage() model.Stage { return model.StageOAST }

// interactshEvent matches interactsh-client's real -json output. Field names are
// hyphenated (unique-id, remote-address, raw-request) — NOT the snake_case of
// the canonical model — which is exactly the mismatch a live capture exposed.
type interactshEvent struct {
	Protocol    string `json:"protocol"`
	UniqueID    string `json:"unique-id"`
	FullID      string `json:"full-id"`
	QType       string `json:"q-type"`
	RawRequest  string `json:"raw-request"`
	RawResponse string `json:"raw-response"`
	RemoteAddr  string `json:"remote-address"`
	Timestamp   string `json:"timestamp"`
}

func (a OAST) Run(_ context.Context, ac *Context) error {
	// interaction stream captured to the workspace (optional).
	raw, _ := ac.WS.ReadFile(workspace.FileInteractsh)
	events := parseInteractsh(raw)

	// Rewrite findings.jsonl, enriching any finding whose evidence/matcher/
	// reproduction references an interaction id we observed a callback for.
	data, _ := ac.WS.ReadFile(workspace.FileFindings)
	var out []byte
	eachJSONLine(data, func(f model.Finding) {
		for id, ev := range events {
			if referencesCID(f, id) {
				ev := ev
				f.OASTCallback = &ev
				f.Confidence = model.ConfVerified
				break
			}
		}
		out = appendJSONL(out, f)
	})
	return ac.WS.WriteFile(workspace.FileFindings, out)
}

// parseInteractsh converts raw interactsh-client -json output into a map of
// interaction id -> model.OASTEvent. Pure function for regression testing
// against testdata/interactsh.real.jsonl. Multiple interactions share one id
// (e.g. a DNS lookup then an HTTP request); the first HTTP interaction wins for
// display, otherwise the first seen.
func parseInteractsh(data []byte) map[string]model.OASTEvent {
	events := map[string]model.OASTEvent{}
	eachJSONLine(data, func(e interactshEvent) {
		id := e.UniqueID
		if id == "" {
			id = e.FullID
		}
		if id == "" {
			return
		}
		ev := model.OASTEvent{
			CorrelationID: id,
			Protocol:      e.Protocol,
			RemoteAddr:    e.RemoteAddr,
			RawRequest:    e.RawRequest,
		}
		if ts, ok := parseOASTTime(e.Timestamp); ok {
			ev.Timestamp = ts
		}
		// Prefer an HTTP interaction over a bare DNS lookup for the display record.
		if prev, exists := events[id]; !exists || (prev.Protocol == "dns" && e.Protocol != "dns") {
			events[id] = ev
		}
	})
	return events
}

func referencesCID(f model.Finding, cid string) bool {
	return strings.Contains(f.Evidence, cid) ||
		strings.Contains(f.Matcher, cid) ||
		strings.Contains(f.Reproduction, cid)
}
