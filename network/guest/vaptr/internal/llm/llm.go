// Package llm defines the report-narrative provider seam. The LLM is used ONLY
// to turn structured findings into prose — it is never given the ability to run
// tools or shell commands. All tool execution goes through the deterministic
// controller and the tool registry; the provider here receives a finished,
// validated model.Report and returns text.
//
// Multiple providers can be added behind Provider (OpenAI-compatible, Anthropic,
// a local model served inside the v86 VM, etc.). The default is Template, which
// needs no network and keeps the framework fully functional offline.
package llm

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/operator/vmvapt/internal/model"
)

// Provider turns a structured report into an executive narrative.
type Provider interface {
	// Summarize returns a prose executive summary for rep. Implementations must
	// treat rep as read-only data and must not perform any side effects beyond
	// the LLM call itself.
	Summarize(ctx context.Context, rep model.Report) (string, error)
}

// TemplateSummary is the deterministic, offline fallback narrative. It is also
// exported so the report agent can call it directly when no Provider is set.
func TemplateSummary(rep model.Report) string {
	s := rep.Summary
	var b strings.Builder
	fmt.Fprintf(&b, "This assessment of %s produced %d finding(s). ", rep.Target, s.Total)

	crit := s.BySeverity[model.SeverityCritical]
	high := s.BySeverity[model.SeverityHigh]
	switch {
	case crit > 0:
		fmt.Fprintf(&b, "%d critical and %d high-severity issue(s) require prompt remediation. ", crit, high)
	case high > 0:
		fmt.Fprintf(&b, "%d high-severity issue(s) require prompt remediation. ", high)
	case s.Total == 0:
		b.WriteString("No issues were identified within the authorized scope by the selected checks. ")
	default:
		b.WriteString("No critical or high-severity issues were identified; lower-severity items are listed for hardening. ")
	}

	verified := s.ByConfidence[model.ConfVerified]
	manual := s.ByConfidence[model.ConfNeedsManual]
	if verified > 0 {
		fmt.Fprintf(&b, "%d finding(s) were verified via out-of-band interaction. ", verified)
	}
	if manual > 0 {
		fmt.Fprintf(&b, "%d finding(s) need manual validation before they are treated as confirmed. ", manual)
	}
	b.WriteString("All testing was constrained to the operator-authorized scope.")
	return b.String()
}

// PromptFor builds the instruction a networked Provider would send. It is kept
// here (not inside a specific provider) so every provider shares one prompt and
// so it can be inspected/tested without a network call.
func PromptFor(rep model.Report) string {
	var b strings.Builder
	b.WriteString("You are a penetration-testing report writer. Given the JSON summary below, ")
	b.WriteString("write a concise (max 150 words) executive summary for a technical audience. ")
	b.WriteString("Do not invent findings; describe only what is present.\n\n")
	fmt.Fprintf(&b, "Target: %s\nTotal findings: %d\n", rep.Target, rep.Summary.Total)
	sevs := make([]string, 0, len(rep.Summary.BySeverity))
	for sev, n := range rep.Summary.BySeverity {
		sevs = append(sevs, fmt.Sprintf("%s=%d", sev, n))
	}
	sort.Strings(sevs)
	fmt.Fprintf(&b, "Severity breakdown: %s\n", strings.Join(sevs, ", "))
	return b.String()
}
