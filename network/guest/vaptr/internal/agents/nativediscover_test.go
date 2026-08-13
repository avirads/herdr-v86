package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// crawlableServer serves a homepage with links/form/script, a couple of
// sensitive paths, and a query-reflecting API endpoint. Unknown paths 404 (so
// the content baseline is clean, not catch-all).
func crawlableServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/.git/config", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("[core]\n\trepositoryformatversion = 0\n"))
	})
	mux.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("admin panel"))
	})
	mux.HandleFunc("/about", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("<html><title>About</title><a href=\"/\">home</a></html>"))
	})
	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"query":%q,"results":[]}`, r.URL.Query().Get("q"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><head><title>Home</title><script src="/app.js"></script></head><body>
<a href="/about">about</a><a href="/api/products?q=apple">products</a>
<form action="/login" method="post"><input name="u"></form></body></html>`))
	})
	return httptest.NewServer(mux)
}

func newCtx(t *testing.T, approved ...string) (*Context, *workspace.Workspace) {
	t.Helper()
	ws, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return &Context{Scope: model.ScopeConfig{RateLimit: 2000}, WS: ws, Approved: approved}, ws
}

func TestNativeCrawl(t *testing.T) {
	ts := crawlableServer()
	defer ts.Close()
	ac, ws := newCtx(t, ts.URL)

	if err := runNativeCrawl(context.Background(), ac); err != nil {
		t.Fatalf("native crawl: %v", err)
	}
	data, _ := ws.ReadFile(workspace.FileKatana)
	kinds := map[string]bool{}
	n := 0
	for _, line := range splitLines(data) {
		var it model.CrawlItem
		if json.Unmarshal(line, &it) == nil {
			kinds[it.Kind] = true
			n++
		}
	}
	if n == 0 {
		t.Fatal("native crawl found nothing")
	}
	for _, want := range []string{"js", "form", "api"} {
		if !kinds[want] {
			t.Errorf("native crawl missing kind %q (kinds: %v)", want, kinds)
		}
	}
}

func TestNativeContent(t *testing.T) {
	ts := crawlableServer()
	defer ts.Close()
	ac, ws := newCtx(t, ts.URL)

	if err := runNativeContent(context.Background(), ac); err != nil {
		t.Fatalf("native content: %v", err)
	}
	var recs []model.ContentRecord
	if err := ws.ReadJSON(workspace.FileContent, &recs); err != nil {
		t.Fatal(err)
	}
	byCat := map[string]bool{}
	for _, r := range recs {
		byCat[r.Category] = true
	}
	if !byCat["config"] {
		t.Errorf("expected a 'config' hit (.git/config); got %+v", recs)
	}
	if !byCat["admin"] {
		t.Errorf("expected an 'admin' hit; got categories %v", byCat)
	}
}

func TestNativeParams(t *testing.T) {
	ts := crawlableServer()
	defer ts.Close()
	// Point param discovery at the reflecting endpoint.
	ac, ws := newCtx(t, ts.URL+"/api/products")

	if err := runNativeParams(context.Background(), ac); err != nil {
		t.Fatalf("native params: %v", err)
	}
	var recs []model.ParamRecord
	if err := ws.ReadJSON(workspace.FileParams, &recs); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range recs {
		for _, p := range r.Params {
			if p == "q" {
				found = true
			}
		}
	}
	if !found {
		t.Errorf("native params should discover reflected 'q', got %+v", recs)
	}
}
