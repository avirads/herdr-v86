// Command testserver is a tiny, self-contained, deliberately-"interesting" HTTP
// server used ONLY to validate the framework's tool-output parsers against real
// httpx/katana/nuclei output. It runs on localhost and is authorized by
// definition (the operator's own machine).
//
// It exposes: a homepage with crawlable links + a form, a JS file, an /api
// endpoint, and a planted /.git/config so a real Nuclei exposure template
// (git-config) fires — giving us genuine finding JSON to parse.
//
//	go run ./internal/testserver -addr 127.0.0.1:8899
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8899", "listen address")
	flag.Parse()

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Server", "TestServer/1.0")
		w.Header().Set("X-Powered-By", "Express")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!doctype html><html><head><title>Test Target Home</title>
<script src="/static/app.js"></script></head><body>
<h1>Test Target</h1>
<a href="/about">About</a>
<a href="/api/products?q=apple">Products API</a>
<a href="/admin">Admin</a>
<form action="/login" method="POST">
  <input name="username"><input name="password" type="password">
  <button type="submit">Login</button>
</form>
</body></html>`)
	})

	mux.HandleFunc("/about", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `<html><title>About</title><body><a href="/">home</a></body></html>`)
	})

	mux.HandleFunc("/static/app.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		fmt.Fprint(w, `fetch("/api/v1/user");console.log("app.js loaded");`)
	})

	mux.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"query":%q,"results":[]}`, r.URL.Query().Get("q"))
	})

	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	})

	// Planted exposure: a real .git/config so nuclei's git-config template fires.
	mux.HandleFunc("/.git/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote \"origin\"]\n\turl = https://example.com/repo.git\n")
	})

	log.Printf("testserver listening on http://%s", *addr)
	srv := &http.Server{Addr: *addr, Handler: mux}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
