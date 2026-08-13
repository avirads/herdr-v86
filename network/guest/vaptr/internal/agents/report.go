package agents

import (
	"context"
	"fmt"
	"html"
	"sort"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/llm"
	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// Report is Agent 10. It renders the validated findings into JSON, Markdown and
// HTML. An LLM provider (via the llm.Provider interface) writes the executive
// narrative; if no provider is configured it falls back to a deterministic
// template so a report is always produced offline.
type Report struct {
	LLM    llm.Provider
	Target string
	Now    func() time.Time
}

func (Report) Name() string       { return "report" }
func (Report) Stage() model.Stage { return model.StageReport }

func (a Report) Run(ctx context.Context, ac *Context) error {
	now := a.Now
	if now == nil {
		now = time.Now
	}
	data, _ := ac.WS.ReadFile(workspace.FileFindings)
	findings := []model.Finding{}
	eachJSONLine(data, func(f model.Finding) { findings = append(findings, f) })

	rep := model.Report{
		Target:    a.Target,
		Generated: now().UTC(),
		Summary:   summarize(findings),
		Findings:  findings,
	}
	if err := ac.WS.WriteJSON(workspace.FileReportJSON, rep); err != nil {
		return err
	}

	narrative := a.narrative(ctx, rep)
	md := renderMarkdown(rep, narrative)
	if err := ac.WS.WriteFile(workspace.FileReportMD, []byte(md)); err != nil {
		return err
	}
	htmlDoc := renderHTML(rep, narrative)
	return ac.WS.WriteFile(workspace.FileReportHTML, []byte(htmlDoc))
}

// narrative asks the LLM provider for an executive summary, falling back to a
// deterministic template when none is configured or the call fails.
func (a Report) narrative(ctx context.Context, rep model.Report) string {
	if a.LLM != nil {
		if s, err := a.LLM.Summarize(ctx, rep); err == nil && strings.TrimSpace(s) != "" {
			return s
		}
	}
	return llm.TemplateSummary(rep)
}

func summarize(findings []model.Finding) model.Summary {
	s := model.Summary{
		BySeverity:   map[model.Severity]int{},
		ByConfidence: map[model.Confidence]int{},
	}
	for _, f := range findings {
		s.Total++
		s.BySeverity[f.Severity]++
		s.ByConfidence[f.Confidence]++
	}
	return s
}

func renderMarkdown(rep model.Report, narrative string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# VAPT Report — %s\n\n", rep.Target)
	fmt.Fprintf(&b, "_Generated %s (UTC)_\n\n", rep.Generated.Format("2006-01-02 15:04:05"))
	b.WriteString("> Authorized assessment. Findings below pertain only to in-scope, operator-owned or explicitly permitted assets.\n\n")

	b.WriteString("## Executive summary\n\n")
	b.WriteString(narrative + "\n\n")

	b.WriteString("## Findings by severity\n\n")
	b.WriteString("| Severity | Count |\n|---|---|\n")
	for _, sev := range []model.Severity{model.SeverityCritical, model.SeverityHigh, model.SeverityMedium, model.SeverityLow, model.SeverityInfo} {
		fmt.Fprintf(&b, "| %s | %d |\n", sev, rep.Summary.BySeverity[sev])
	}
	b.WriteString("\n## Details\n\n")

	for i, f := range rep.Findings {
		fmt.Fprintf(&b, "### %d. %s\n\n", i+1, nonEmpty(f.Title, f.TemplateID, "Untitled finding"))
		fmt.Fprintf(&b, "- **Severity:** %s\n", f.Severity)
		fmt.Fprintf(&b, "- **Confidence:** %s\n", f.Confidence)
		fmt.Fprintf(&b, "- **Affected URL:** %s\n", f.AffectedURL)
		if f.Evidence != "" {
			fmt.Fprintf(&b, "- **Evidence:** %s\n", f.Evidence)
		}
		if f.OASTCallback != nil {
			fmt.Fprintf(&b, "- **OAST callback:** %s from %s at %s\n",
				f.OASTCallback.Protocol, f.OASTCallback.RemoteAddr, f.OASTCallback.Timestamp.Format(time.RFC3339))
		}
		if f.Reproduction != "" {
			fmt.Fprintf(&b, "\n**Reproduction:**\n\n```\n%s\n```\n", f.Reproduction)
		}
		if f.Remediation != "" {
			fmt.Fprintf(&b, "\n**Remediation:** %s\n", f.Remediation)
		}
		if len(f.References) > 0 {
			b.WriteString("\n**References:**\n")
			for _, r := range f.References {
				fmt.Fprintf(&b, "- %s\n", r)
			}
		}
		b.WriteString("\n")
	}
	return b.String()
}

func renderHTML(rep model.Report, narrative string) string {
	var b strings.Builder
	b.WriteString("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
	fmt.Fprintf(&b, "<title>VAPT Report — %s</title>", html.EscapeString(rep.Target))
	b.WriteString("<style>body{font:15px/1.5 system-ui,sans-serif;max-width:60rem;margin:0 auto;padding:2rem 1rem;color:#111;background:#fff}" +
		"h1{margin-bottom:.2rem}.sev{display:inline-block;padding:.1rem .5rem;border-radius:.3rem;color:#fff;font-size:.8rem}" +
		".critical{background:#7c1d1d}.high{background:#b91c1c}.medium{background:#c2740c}.low{background:#2563eb}.info{background:#4b5563}" +
		"table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem .6rem}" +
		"pre{background:#f5f5f5;padding:.6rem;overflow:auto;border-radius:.3rem}article{border-top:1px solid #eee;padding-top:1rem}</style></head><body>")
	fmt.Fprintf(&b, "<h1>VAPT Report — %s</h1>", html.EscapeString(rep.Target))
	fmt.Fprintf(&b, "<p><em>Generated %s UTC</em></p>", rep.Generated.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(&b, "<h2>Executive summary</h2><p>%s</p>", html.EscapeString(narrative))

	b.WriteString("<h2>Findings by severity</h2><table><tr><th>Severity</th><th>Count</th></tr>")
	for _, sev := range []model.Severity{model.SeverityCritical, model.SeverityHigh, model.SeverityMedium, model.SeverityLow, model.SeverityInfo} {
		fmt.Fprintf(&b, "<tr><td><span class=\"sev %s\">%s</span></td><td>%d</td></tr>", sev, sev, rep.Summary.BySeverity[sev])
	}
	b.WriteString("</table><h2>Details</h2>")
	for i, f := range rep.Findings {
		b.WriteString("<article>")
		fmt.Fprintf(&b, "<h3>%d. %s <span class=\"sev %s\">%s</span></h3>",
			i+1, html.EscapeString(nonEmpty(f.Title, f.TemplateID, "Untitled")), f.Severity, f.Severity)
		fmt.Fprintf(&b, "<p><strong>Confidence:</strong> %s<br><strong>Affected URL:</strong> %s</p>",
			f.Confidence, html.EscapeString(f.AffectedURL))
		if f.Evidence != "" {
			fmt.Fprintf(&b, "<p><strong>Evidence:</strong> %s</p>", html.EscapeString(f.Evidence))
		}
		if f.Reproduction != "" {
			fmt.Fprintf(&b, "<p><strong>Reproduction:</strong></p><pre>%s</pre>", html.EscapeString(f.Reproduction))
		}
		if f.Remediation != "" {
			fmt.Fprintf(&b, "<p><strong>Remediation:</strong> %s</p>", html.EscapeString(f.Remediation))
		}
		if len(f.References) > 0 {
			b.WriteString("<p><strong>References:</strong></p><ul>")
			refs := append([]string(nil), f.References...)
			sort.Strings(refs)
			for _, r := range refs {
				fmt.Fprintf(&b, "<li>%s</li>", html.EscapeString(r))
			}
			b.WriteString("</ul>")
		}
		b.WriteString("</article>")
	}
	b.WriteString("</body></html>")
	return b.String()
}

func nonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
