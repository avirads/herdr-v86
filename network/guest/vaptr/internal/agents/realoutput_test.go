package agents

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/model"
)

// These tests lock the tool-output parsers onto REAL output captured from the
// actual tools (httpx, katana, nuclei) against the local test server. The
// fixtures in testdata/*.real.jsonl were produced by internal/testserver +
// the installed ProjectDiscovery binaries. If a future tool version changes its
// JSON shape, these tests fail — which is exactly the signal we want.

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return b
}

func TestParseHTTPX_RealOutput(t *testing.T) {
	fps := parseHTTPX(readFixture(t, "httpx.real.jsonl"))
	if len(fps) != 1 {
		t.Fatalf("expected 1 fingerprint, got %d", len(fps))
	}
	fp := fps[0]
	if fp.StatusCode != 200 {
		t.Errorf("status_code = %d, want 200", fp.StatusCode)
	}
	if fp.Title != "Test Target Home" {
		t.Errorf("title = %q", fp.Title)
	}
	if fp.Server != "TestServer/1.0" {
		t.Errorf("server = %q, want TestServer/1.0 (webserver field mapped)", fp.Server)
	}
	if len(fp.Technologies) == 0 {
		t.Errorf("technologies empty; tech field not mapped")
	}
	found := false
	for _, tech := range fp.Technologies {
		if tech == "Express" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Express in technologies, got %v", fp.Technologies)
	}
}

func TestParseKatana_RealOutput(t *testing.T) {
	items := parseKatana(readFixture(t, "katana.real.jsonl"))
	if len(items) == 0 {
		t.Fatal("no crawl items parsed from real katana output")
	}
	// Every item must have a URL and a classified kind.
	var sawJS, sawAPI bool
	for _, it := range items {
		if it.URL == "" {
			t.Errorf("crawl item missing URL: %+v", it)
		}
		if it.Kind == "js" {
			sawJS = true
		}
		if it.Kind == "api" {
			sawAPI = true
		}
	}
	if !sawJS {
		t.Error("expected app.js to be classified as kind=js")
	}
	if !sawAPI {
		t.Error("expected an /api/ endpoint to be classified as kind=api")
	}
}

func TestParseHakrawler_RealOutput(t *testing.T) {
	items := parseHakrawler(readFixture(t, "hakrawler.real.jsonl"))
	if len(items) == 0 {
		t.Fatal("no crawl items parsed from real hakrawler output")
	}
	var sawJS, sawForm, sawAPI bool
	for _, it := range items {
		if it.URL == "" {
			t.Errorf("item missing URL: %+v", it)
		}
		switch it.Kind {
		case "js":
			sawJS = true
		case "form":
			sawForm = true
		case "api":
			sawAPI = true
		}
	}
	if !sawJS {
		t.Error("hakrawler: app.js should classify as js")
	}
	if !sawForm {
		t.Error("hakrawler: form source should classify as form")
	}
	if !sawAPI {
		t.Error("hakrawler: /api/ should classify as api")
	}
}

func TestParseGospider_RealOutput(t *testing.T) {
	items := parseGospider(readFixture(t, "gospider.real.jsonl"))
	if len(items) == 0 {
		t.Fatal("no crawl items parsed from real gospider output")
	}
	var sawJS, sawForm bool
	for _, it := range items {
		if !strings.HasPrefix(it.URL, "http") {
			t.Errorf("gospider item should have an http URL: %+v", it)
		}
		if it.Kind == "js" {
			sawJS = true
		}
		if it.Kind == "form" {
			sawForm = true
		}
	}
	if !sawJS {
		t.Error("gospider: javascript type should classify as js")
	}
	if !sawForm {
		t.Error("gospider: form type should classify as form")
	}
}

func TestParseFFUF_RealOutput(t *testing.T) {
	recs := parseFFUF(readFixture(t, "ffuf.real.json"))
	if len(recs) == 0 {
		t.Fatal("no content records parsed from real ffuf output")
	}
	byURL := map[string]model.ContentRecord{}
	for _, r := range recs {
		if r.Status == 0 {
			t.Errorf("record missing status: %+v", r)
		}
		if r.Category == "" {
			t.Errorf("record missing category: %+v", r)
		}
		byURL[r.URL] = r
	}
	// The planted /.git/config must be found and categorized as a config leak.
	var git *model.ContentRecord
	for u, r := range byURL {
		if strings.HasSuffix(u, "/.git/config") {
			rr := r
			git = &rr
		}
	}
	if git == nil {
		t.Fatal("expected /.git/config in ffuf results")
	}
	if git.Category != "config" {
		t.Errorf("/.git/config category = %q, want config", git.Category)
	}
}

func TestParseFFUFParams_RealOutput(t *testing.T) {
	names := parseFFUFParamNames(readFixture(t, "param-ffuf.real.json"))
	if len(names) != 1 || names[0] != "q" {
		t.Fatalf("expected discovered params [q], got %v", names)
	}
}

func TestParseInteractsh_RealOutput(t *testing.T) {
	events := parseInteractsh(readFixture(t, "interactsh.real.jsonl"))
	const id = "d9kkn1i1ee34j26u31506afcptig69i46"
	ev, ok := events[id]
	if !ok {
		t.Fatalf("interaction id %q not parsed; got keys %v", id, keysOf(events))
	}
	// The hyphenated real fields must map onto the canonical model.
	if ev.CorrelationID != id {
		t.Errorf("unique-id not mapped to CorrelationID: %q", ev.CorrelationID)
	}
	if ev.RemoteAddr == "" {
		t.Error("remote-address not mapped to RemoteAddr")
	}
	if ev.RawRequest == "" {
		t.Error("raw-request not mapped to RawRequest")
	}
	// An HTTP interaction should win over the bare DNS lookup for display.
	if ev.Protocol != "http" {
		t.Errorf("expected HTTP interaction to be preferred, got protocol %q", ev.Protocol)
	}
	if ev.Timestamp.IsZero() {
		t.Error("timestamp not parsed")
	}
}

func keysOf(m map[string]model.OASTEvent) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestParseNuclei_RealOutput(t *testing.T) {
	now := func() time.Time { return time.Unix(0, 0).UTC() }
	findings := parseNuclei(readFixture(t, "nuclei.real.jsonl"), now)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	f := findings[0]
	if f.TemplateID != "git-config" {
		t.Errorf("template_id = %q, want git-config", f.TemplateID)
	}
	if f.Title == "" {
		t.Error("title empty; info.name not mapped")
	}
	if f.Severity != model.SeverityMedium {
		t.Errorf("severity = %q, want medium", f.Severity)
	}
	if f.AffectedURL == "" {
		t.Error("affected_url empty; matched-at not mapped")
	}
	if len(f.Tags) == 0 {
		t.Error("tags empty; info.tags not mapped")
	}
	// Reproduction must be populated from the real request.
	if f.Reproduction == "" {
		t.Error("reproduction empty; request not mapped")
	}
	if f.ID == "" {
		t.Error("finding id not derived")
	}
}
