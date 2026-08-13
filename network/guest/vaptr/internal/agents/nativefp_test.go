package agents

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

func TestNativeFingerprint_Probe(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Server", "TestServer/1.0")
		w.Header().Set("X-Powered-By", "Express")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte("<html><head><title>Native Probe Test</title></head><body>hi</body></html>"))
	})
	ts := httptest.NewServer(mux)
	defer ts.Close()

	ws, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ac := &Context{
		Scope:              model.ScopeConfig{RateLimit: 1000},
		WS:                 ws,
		Approved:           []string{ts.URL},
		FingerprintBackend: "native",
	}
	if err := (Fingerprint{}).Run(context.Background(), ac); err != nil {
		t.Fatalf("native fingerprint: %v", err)
	}

	// The native backend writes the same model.Fingerprint artifact as httpx.
	data, _ := ws.ReadFile(workspace.FileHTTPX)
	lines := splitLines(data)
	if len(lines) != 1 {
		t.Fatalf("expected 1 fingerprint line, got %d", len(lines))
	}
	var fp model.Fingerprint
	if err := json.Unmarshal(lines[0], &fp); err != nil {
		t.Fatalf("unmarshal fingerprint: %v", err)
	}
	if fp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", fp.StatusCode)
	}
	if fp.Title != "Native Probe Test" {
		t.Errorf("title = %q, want 'Native Probe Test'", fp.Title)
	}
	if fp.Server != "TestServer/1.0" {
		t.Errorf("server = %q", fp.Server)
	}
	found := false
	for _, tech := range fp.Technologies {
		if tech == "Express" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Express in technologies (from X-Powered-By), got %v", fp.Technologies)
	}
}
