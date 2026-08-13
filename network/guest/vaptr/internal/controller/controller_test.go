package controller_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/agents"
	"github.com/operator/vmvapt/internal/controller"
	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// fixtures are canned tool outputs keyed by capability, letting us exercise the
// entire pipeline deterministically with no external binaries.
func fixtures() map[registry.Capability][]byte {
	return map[registry.Capability][]byte{
		registry.CapFingerprint: []byte(
			`{"url":"https://scanme.example.com","input":"scanme.example.com","status_code":200,"title":"Welcome","tech":["nginx","PHP"],"webserver":"nginx","tls":{"host":"scanme.example.com","issuer_cn":"Let's Encrypt","subject_cn":"scanme.example.com","tls_version":"tls13"}}` + "\n"),
		registry.CapCrawl: []byte(
			`{"request":{"method":"GET","endpoint":"https://scanme.example.com/","tag":"a","source":"root"}}` + "\n" +
				`{"request":{"method":"GET","endpoint":"https://scanme.example.com/app.js","tag":"script"}}` + "\n" +
				`{"request":{"method":"POST","endpoint":"https://scanme.example.com/api/v1/login","tag":"form"}}` + "\n"),
		registry.CapURLDiscover: []byte(
			`{"url":"https://scanme.example.com/?b=2&a=1","source":"gau"}` + "\n" +
				`{"url":"https://scanme.example.com/?a=1&b=2","source":"wayback"}` + "\n"),
		registry.CapParamDiscover: []byte(
			`{"url":"https://scanme.example.com/search","method":"GET","params":["q","lang"]}` + "\n"),
		registry.CapContentDiscover: []byte(
			`{"results":[{"url":"https://scanme.example.com/admin","status":401,"length":12,"words":3},{"url":"https://scanme.example.com/backup.zip","status":200,"length":900,"words":5}]}`),
		registry.CapScan: []byte(
			`{"template-id":"blind-ssrf","info":{"name":"Blind SSRF","severity":"high","tags":["ssrf"],"reference":["https://owasp.org/ssrf"],"remediation":"Validate outbound requests"},"matched-at":"https://scanme.example.com/api/v1/login","extracted-results":["oastcorr123"],"matcher-name":"dns"}` + "\n" +
				`{"template-id":"exposure-env","info":{"name":".env exposure","severity":"medium","tags":["exposure"]},"matched-at":"https://scanme.example.com/.env","extracted-results":["DB_PASSWORD"]}` + "\n"),
		// OAST interactions are seeded as a workspace artifact (interactsh.jsonl),
		// not via the runner — the OAST agent reads that stream directly.
	}
}

func newScope() model.ScopeConfig {
	return model.ScopeConfig{
		AllowedDomains:  []string{"scanme.example.com"},
		AllowSubdomains: false,
		RateLimit:       25,
		MaxConcurrency:  5,
		Authorization:   "SoW-2026-001",
	}
}

func TestPipeline_EndToEnd(t *testing.T) {
	dir := t.TempDir()
	ws, err := workspace.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	clk := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	// Seed a captured interactsh interaction stream (real interactsh-client
	// field names) whose id matches the SSRF finding's evidence; the OAST agent
	// reads this artifact and promotes the correlated finding to verified.
	if err := ws.WriteFile(workspace.FileInteractsh,
		[]byte(`{"unique-id":"oastcorr123","protocol":"dns","remote-address":"203.0.113.55","timestamp":"2026-01-01T00:00:00Z"}`+"\n")); err != nil {
		t.Fatal(err)
	}

	fake := &runner.Fake{Outputs: fixtures()}
	ctl, err := controller.New(ws, controller.Options{
		Target:   "scanme.example.com",
		Targets:  []string{"scanme.example.com", "evil.com", "127.0.0.1"},
		Scope:    newScope(),
		Registry: registry.Default(),
		Runner:   fake,
		Now:      func() time.Time { return clk },
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := ctl.Run(context.Background()); err != nil {
		t.Fatalf("Run: %v", err)
	}

	// Scope: only the approved host made it through.
	var scope model.ScopeResult
	mustReadJSON(t, ws, workspace.FileScope, &scope)
	if len(scope.Approved) != 1 || scope.Approved[0] != "scanme.example.com" {
		t.Fatalf("approved = %v, want [scanme.example.com]", scope.Approved)
	}

	// URL discovery: ?b=2&a=1 and ?a=1&b=2 must normalize to a single record
	// carrying both passive sources.
	var urls []model.URLRecord
	mustReadJSON(t, ws, workspace.FileURLs, &urls)
	permuted := 0
	for _, u := range urls {
		if len(u.Params) == 2 && u.Params[0] == "a" && u.Params[1] == "b" {
			permuted++
			if len(u.Sources) != 2 {
				t.Errorf("permuted URL should union both sources, got %v", u.Sources)
			}
		}
	}
	if permuted != 1 {
		t.Errorf("expected the two permuted query URLs to dedupe to 1 record, got %d (urls=%v)", permuted, urls)
	}

	// Report: the SSRF finding must be OAST-verified; the .env finding present.
	var rep model.Report
	mustReadJSON(t, ws, workspace.FileReportJSON, &rep)
	if rep.Summary.Total != 2 {
		t.Fatalf("expected 2 findings, got %d", rep.Summary.Total)
	}
	var ssrf *model.Finding
	for i := range rep.Findings {
		if rep.Findings[i].TemplateID == "blind-ssrf" {
			ssrf = &rep.Findings[i]
		}
	}
	if ssrf == nil {
		t.Fatal("blind-ssrf finding missing")
	}
	if ssrf.Confidence != model.ConfVerified {
		t.Errorf("SSRF should be OAST-verified, got %s", ssrf.Confidence)
	}
	if ssrf.OASTCallback == nil || ssrf.OASTCallback.CorrelationID != "oastcorr123" {
		t.Errorf("SSRF should carry the OAST callback, got %+v", ssrf.OASTCallback)
	}

	// Report artifacts in all three formats exist and are non-empty.
	for _, f := range []string{workspace.FileReportMD, workspace.FileReportHTML, workspace.FileReportJSON} {
		if b, err := ws.ReadFile(f); err != nil || len(b) == 0 {
			t.Errorf("report artifact %s missing/empty (err=%v)", f, err)
		}
	}

	// Audit log recorded the scope rejections.
	if b, err := ws.ReadFile(workspace.FileAudit); err != nil || len(b) == 0 {
		t.Errorf("audit log missing (err=%v)", err)
	}
}

func TestPipeline_NucleiTagsAreBounded(t *testing.T) {
	dir := t.TempDir()
	ws, _ := workspace.Open(dir)
	// Seed httpx output so template selection has tech to work with.
	_ = ws.WriteFile(workspace.FileHTTPX,
		[]byte(`{"url":"https://x","technologies":["nginx","PHP"]}`+"\n"))
	// SelectTemplates is the exported, bounded template-selection helper.
	tags := agents.SelectTemplates(ws)
	if len(tags) == 0 {
		t.Fatal("expected non-empty bounded tag set")
	}
	// Must never be a wildcard/"run everything" marker.
	for _, tg := range tags {
		if tg == "*" || tg == "all" {
			t.Fatalf("template selection must never be unbounded, got %v", tags)
		}
	}
}

func TestPipeline_Resume(t *testing.T) {
	dir := t.TempDir()
	ws, _ := workspace.Open(dir)
	clk := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	fake := &runner.Fake{Outputs: fixtures()}

	opt := controller.Options{
		Target: "scanme.example.com", Targets: []string{"scanme.example.com"},
		Scope: newScope(), Registry: registry.Default(), Runner: fake,
		Now: func() time.Time { return clk },
	}
	ctl, _ := controller.New(ws, opt)
	if err := ctl.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	callsFirst := len(fake.Calls)

	// Second run should resume: every stage is already complete, so no tool is
	// invoked again.
	fake2 := &runner.Fake{Outputs: fixtures()}
	opt.Runner = fake2
	ctl2, _ := controller.New(ws, opt)
	if err := ctl2.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(fake2.Calls) != 0 {
		t.Errorf("resume should invoke 0 tools, invoked %d", len(fake2.Calls))
	}
	if callsFirst == 0 {
		t.Error("first run should have invoked tools")
	}
}

func mustReadJSON(t *testing.T, ws *workspace.Workspace, name string, v any) {
	t.Helper()
	if err := ws.ReadJSON(name, v); err != nil {
		t.Fatalf("read %s: %v", filepath.Base(name), err)
	}
}
