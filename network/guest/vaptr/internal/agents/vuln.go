package agents

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// Vulnerability is Agent 7. It runs Nuclei with an automatically-selected,
// bounded template set — never the full template corpus. Template tags are
// derived from the technologies HTTPX detected plus a safe baseline of
// exposure/misconfiguration/CVE/default-login checks.
type Vulnerability struct {
	// Now is injectable for deterministic tests.
	Now func() time.Time
}

func (Vulnerability) Name() string       { return "vulnerability" }
func (Vulnerability) Stage() model.Stage { return model.StageVuln }

// baselineTags are always included: high-signal, low-noise categories.
var baselineTags = []string{"exposure", "misconfig", "cve", "default-login", "tech"}

// nucleiLine matches the subset of nuclei -jsonl output we consume.
type nucleiLine struct {
	TemplateID string `json:"template-id"`
	Info       struct {
		Name        string   `json:"name"`
		Severity    string   `json:"severity"`
		Tags        []string `json:"tags"`
		Reference   []string `json:"reference"`
		Remediation string   `json:"remediation"`
	} `json:"info"`
	MatchedAt               string   `json:"matched-at"`
	ExtractedResults        []string `json:"extracted-results"`
	Request                 string   `json:"request"`
	MatcherName             string   `json:"matcher-name"`
	InteractshCorrelationID string   `json:"interactsh-event"` // correlation hint if present
}

func (a Vulnerability) Run(ctx context.Context, ac *Context) error {
	now := a.Now
	if now == nil {
		now = time.Now
	}

	// "native" backend: run the built-in curated checks in-process (no nuclei,
	// no templates). Anything else uses nuclei.
	if ac.ScanBackend == "native" {
		return runNativeScan(ctx, ac, now)
	}

	tags := SelectTemplates(ac.WS)
	args := [][2]string{
		{"-jsonl", ""}, {"-silent", ""}, {"-duc", ""},
		{"-tags", strings.Join(tags, ",")},
	}
	// Route OAST payloads through the self-hosted interactsh server so blind
	// vulns are confirmed on our own infrastructure, not a public one.
	if ac.OASTServer != "" {
		args = append(args, [2]string{"-interactsh-server", ac.OASTServer})
		if ac.OASTToken != "" {
			args = append(args, [2]string{"-interactsh-token", ac.OASTToken})
		}
	}
	args = append(args, rateArgs(ac.Scope, "-rate-limit", "-c")...)
	inv, err := ac.Registry.Build(ctx, registry.CapScan, args)
	if err != nil {
		return fmt.Errorf("vulnerability: build: %w", err)
	}
	inv.Stdin = targetStdin(ac) // feed approved targets to nuclei via stdin
	logInvoke(ac, a.Name(), inv)

	res, err := ac.Runner.Run(ctx, inv)
	if errors.Is(err, runner.ErrToolMissing) {
		return writeEmpty(ac.WS, workspace.FileFindings)
	}
	if err != nil {
		return fmt.Errorf("vulnerability: run: %w", err)
	}

	var out []byte
	for _, f := range parseNuclei(res.Stdout, now) {
		out = appendJSONL(out, f)
	}
	return ac.WS.WriteFile(workspace.FileFindings, out)
}

// parseNuclei converts raw nuclei -jsonl output into model.Finding records.
// Pure function for regression testing against testdata/nuclei.real.jsonl.
// Absent optional fields (reference, remediation, matcher-name,
// extracted-results) simply yield empty values — verified against real output.
func parseNuclei(data []byte, now func() time.Time) []model.Finding {
	var out []model.Finding
	eachJSONLine(data, func(l nucleiLine) {
		out = append(out, model.Finding{
			ID:           findingID(l.TemplateID, l.MatchedAt),
			TemplateID:   l.TemplateID,
			Title:        l.Info.Name,
			Severity:     normSeverity(l.Info.Severity),
			Confidence:   model.ConfCandidate,
			AffectedURL:  l.MatchedAt,
			Matcher:      l.MatcherName,
			Evidence:     strings.Join(l.ExtractedResults, "; "),
			Reproduction: reproFromRequest(l.Request, l.MatchedAt),
			Remediation:  l.Info.Remediation,
			References:   l.Info.Reference,
			Tags:         l.Info.Tags,
			FirstSeen:    now().UTC(),
		})
	})
	return out
}

// SelectTemplates computes the bounded Nuclei tag set from detected tech plus
// the safe baseline. Exported so it is directly unit-testable and so the tool
// registry's "never run everything" invariant is verifiable.
func SelectTemplates(ws *workspace.Workspace) []string {
	seen := map[string]bool{}
	var tags []string
	add := func(t string) {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" || seen[t] {
			return
		}
		seen[t] = true
		tags = append(tags, t)
	}
	for _, t := range baselineTags {
		add(t)
	}
	if data, err := ws.ReadFile(workspace.FileHTTPX); err == nil {
		eachJSONLine(data, func(fp model.Fingerprint) {
			for _, tech := range fp.Technologies {
				add(techToTag(tech))
			}
		})
	}
	sort.Strings(tags)
	return tags
}

// techToTag maps an HTTPX technology name to a Nuclei tag.
func techToTag(tech string) string {
	t := strings.ToLower(tech)
	t = strings.ReplaceAll(t, " ", "-")
	// Strip version suffixes like "nginx:1.25" -> "nginx".
	if i := strings.IndexAny(t, ":/"); i > 0 {
		t = t[:i]
	}
	return t
}

func findingID(template, at string) string {
	h := sha1.Sum([]byte(template + "|" + at))
	return hex.EncodeToString(h[:8])
}

func normSeverity(s string) model.Severity {
	switch strings.ToLower(s) {
	case "critical":
		return model.SeverityCritical
	case "high":
		return model.SeverityHigh
	case "medium":
		return model.SeverityMedium
	case "low":
		return model.SeverityLow
	default:
		return model.SeverityInfo
	}
}

func reproFromRequest(req, url string) string {
	if strings.TrimSpace(req) != "" {
		return "Replay the following request:\n" + strings.TrimSpace(req)
	}
	return "Send a request to: " + url
}
