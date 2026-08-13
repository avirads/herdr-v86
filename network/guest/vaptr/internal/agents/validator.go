package agents

import (
	"context"
	"sort"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// Validator is Agent 9. It deduplicates findings and assigns a confidence
// state. It is pure and deterministic — given the same findings.jsonl it always
// produces the same result — so its scoring is auditable and testable.
type Validator struct{}

func (Validator) Name() string       { return "validator" }
func (Validator) Stage() model.Stage { return model.StageValidate }

func (a Validator) Run(_ context.Context, ac *Context) error {
	data, _ := ac.WS.ReadFile(workspace.FileFindings)
	var findings []model.Finding
	eachJSONLine(data, func(f model.Finding) { findings = append(findings, f) })

	deduped := Dedupe(findings)
	for i := range deduped {
		deduped[i].Confidence = Score(deduped[i])
	}
	// Persist the validated set back to findings.jsonl (canonical form).
	var out []byte
	for _, f := range deduped {
		out = appendJSONL(out, f)
	}
	return ac.WS.WriteFile(workspace.FileFindings, out)
}

// Dedupe collapses findings sharing the same (template, affected URL, matcher)
// identity, keeping the highest-confidence instance and preserving any OAST
// callback. The result is sorted by severity then URL for stable output.
func Dedupe(in []model.Finding) []model.Finding {
	type key struct{ tmpl, url, matcher string }
	best := map[key]model.Finding{}
	order := []key{}
	for _, f := range in {
		k := key{f.TemplateID, f.AffectedURL, f.Matcher}
		cur, ok := best[k]
		if !ok {
			best[k] = f
			order = append(order, k)
			continue
		}
		best[k] = mergeFinding(cur, f)
	}
	out := make([]model.Finding, 0, len(order))
	for _, k := range order {
		out = append(out, best[k])
	}
	sort.SliceStable(out, func(i, j int) bool {
		si, sj := severityRank(out[i].Severity), severityRank(out[j].Severity)
		if si != sj {
			return si > sj
		}
		return out[i].AffectedURL < out[j].AffectedURL
	})
	return out
}

// mergeFinding keeps the stronger evidence of two duplicates.
func mergeFinding(a, b model.Finding) model.Finding {
	if b.OASTCallback != nil && a.OASTCallback == nil {
		a.OASTCallback = b.OASTCallback
	}
	if confidenceRank(b.Confidence) > confidenceRank(a.Confidence) {
		a.Confidence = b.Confidence
	}
	if len(b.Evidence) > len(a.Evidence) {
		a.Evidence = b.Evidence
	}
	return a
}

// Score assigns the confidence state from the available evidence. The rules are
// intentionally conservative: only an out-of-band callback yields "verified"
// automatically; unauthenticated high/critical matches without corroboration
// are flagged for a human.
func Score(f model.Finding) model.Confidence {
	if f.OASTCallback != nil {
		return model.ConfVerified
	}
	switch f.Severity {
	case model.SeverityInfo:
		return model.ConfInformational
	case model.SeverityCritical, model.SeverityHigh:
		// High impact but only pattern-matched: a human must confirm before
		// it is treated as verified.
		if f.Evidence == "" {
			return model.ConfNeedsManual
		}
		return model.ConfCandidate
	default:
		return model.ConfCandidate
	}
}

func severityRank(s model.Severity) int {
	switch s {
	case model.SeverityCritical:
		return 4
	case model.SeverityHigh:
		return 3
	case model.SeverityMedium:
		return 2
	case model.SeverityLow:
		return 1
	default:
		return 0
	}
}

func confidenceRank(c model.Confidence) int {
	switch c {
	case model.ConfVerified:
		return 4
	case model.ConfCandidate:
		return 3
	case model.ConfNeedsManual:
		return 2
	case model.ConfInformational:
		return 1
	case model.ConfFalsePositive:
		return 0
	}
	return 0
}
