package agents

import (
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/model"
)

func mkFinding(tmpl, url string, sev model.Severity) model.Finding {
	return model.Finding{
		TemplateID: tmpl, AffectedURL: url, Severity: sev,
		FirstSeen: time.Unix(0, 0).UTC(),
	}
}

func TestDedupe_CollapsesDuplicates(t *testing.T) {
	in := []model.Finding{
		mkFinding("cve-2021-1", "https://a/x", model.SeverityHigh),
		mkFinding("cve-2021-1", "https://a/x", model.SeverityHigh), // dup
		mkFinding("exposure", "https://a/y", model.SeverityLow),
	}
	out := Dedupe(in)
	if len(out) != 2 {
		t.Fatalf("expected 2 unique findings, got %d", len(out))
	}
	// Highest severity sorts first.
	if out[0].Severity != model.SeverityHigh {
		t.Errorf("expected high severity first, got %s", out[0].Severity)
	}
}

func TestScore_OASTVerified(t *testing.T) {
	f := mkFinding("blind-ssrf", "https://a", model.SeverityHigh)
	f.OASTCallback = &model.OASTEvent{CorrelationID: "abc", Protocol: "dns"}
	if got := Score(f); got != model.ConfVerified {
		t.Errorf("OAST-correlated finding should be verified, got %s", got)
	}
}

func TestScore_HighNoEvidenceNeedsManual(t *testing.T) {
	f := mkFinding("t", "https://a", model.SeverityCritical)
	f.Evidence = ""
	if got := Score(f); got != model.ConfNeedsManual {
		t.Errorf("critical w/o evidence should need manual validation, got %s", got)
	}
}

func TestScore_InfoIsInformational(t *testing.T) {
	f := mkFinding("t", "https://a", model.SeverityInfo)
	if got := Score(f); got != model.ConfInformational {
		t.Errorf("info severity should be informational, got %s", got)
	}
}

func TestScore_MediumIsCandidate(t *testing.T) {
	f := mkFinding("t", "https://a", model.SeverityMedium)
	if got := Score(f); got != model.ConfCandidate {
		t.Errorf("medium should be candidate, got %s", got)
	}
}
