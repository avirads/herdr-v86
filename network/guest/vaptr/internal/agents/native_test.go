package agents

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// vulnServer serves a deliberately vulnerable target: exposed .git/config and
// .env, and a homepage with no security headers.
func vulnServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/.git/config", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("[core]\n\trepositoryformatversion = 0\n\tbare = false\n"))
	})
	mux.HandleFunc("/.env", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("DB_PASSWORD=s3cr3t\nAPI_KEY=abc123\nDEBUG=true\n"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html") // deliberately no security headers
		w.Write([]byte("<html><body>home</body></html>"))
	})
	return httptest.NewServer(mux)
}

func findingsByTemplate(t *testing.T, ws *workspace.Workspace) map[string]model.Finding {
	t.Helper()
	data, err := ws.ReadFile(workspace.FileFindings)
	if err != nil {
		t.Fatalf("read findings: %v", err)
	}
	out := map[string]model.Finding{}
	for _, line := range splitLines(data) {
		var f model.Finding
		if json.Unmarshal(line, &f) == nil && f.TemplateID != "" {
			out[f.TemplateID] = f
		}
	}
	return out
}

func splitLines(data []byte) [][]byte {
	var out [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if i > start {
				out = append(out, data[start:i])
			}
			start = i + 1
		}
	}
	if start < len(data) {
		out = append(out, data[start:])
	}
	return out
}

func TestNativeScan_FindsExposures(t *testing.T) {
	ts := vulnServer()
	defer ts.Close()

	ws, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ac := &Context{
		Scope:       model.ScopeConfig{RateLimit: 1000},
		WS:          ws,
		Approved:    []string{ts.URL},
		ScanBackend: "native",
	}
	now := func() time.Time { return time.Unix(0, 0).UTC() }
	if err := (Vulnerability{Now: now}).Run(context.Background(), ac); err != nil {
		t.Fatalf("native scan: %v", err)
	}

	got := findingsByTemplate(t, ws)
	cases := []struct {
		template string
		sev      model.Severity
	}{
		{"native-git-config-exposure", model.SeverityMedium},
		{"native-env-exposure", model.SeverityHigh},
		{"native-missing-security-headers", model.SeverityInfo},
	}
	for _, c := range cases {
		f, ok := got[c.template]
		if !ok {
			t.Errorf("expected finding %q, got templates %v", c.template, keysOfFindings(got))
			continue
		}
		if f.Severity != c.sev {
			t.Errorf("%s severity = %q, want %q", c.template, f.Severity, c.sev)
		}
		if f.Evidence == "" {
			t.Errorf("%s should carry evidence", c.template)
		}
	}
	// phpinfo isn't served → must NOT be reported (no false positives).
	if _, ok := got["native-phpinfo-exposure"]; ok {
		t.Error("phpinfo finding reported but not present on target (false positive)")
	}
}

func keysOfFindings(m map[string]model.Finding) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
