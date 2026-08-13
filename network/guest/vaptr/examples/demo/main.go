// Command demo runs a complete, fully-offline scan against a *simulated*
// deliberately-vulnerable training application ("juice-shop.test"). It uses the
// framework's Fake runner pre-loaded with recorded tool outputs, so it needs no
// network access and none of httpx/katana/nuclei/etc. installed — ideal inside
// v86 or CI.
//
// It demonstrates the full pipeline end to end and prints the resulting
// Markdown report. To run a REAL scan against a real training target you own
// (e.g. a local OWASP Juice Shop or DVWA instance), install the tools and use
// the `vaptr` CLI with a config whose scope authorizes that host — see
// docs/EXAMPLE_SCAN.md.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/operator/vmvapt/internal/controller"
	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// recordedOutputs are canned outputs captured from the real tools against a
// vulnerable training app. They stand in for live execution.
func recordedOutputs() map[registry.Capability][]byte {
	return map[registry.Capability][]byte{
		registry.CapFingerprint: []byte(
			`{"url":"https://juice-shop.test","input":"juice-shop.test","status_code":200,"title":"OWASP Juice Shop","tech":["Node.js","Express","Angular"],"webserver":"Express","tls":{"host":"juice-shop.test","issuer_cn":"Local Test CA","subject_cn":"juice-shop.test","tls_version":"tls12"}}` + "\n"),
		registry.CapCrawl: []byte(
			`{"request":{"method":"GET","endpoint":"https://juice-shop.test/","tag":"a","source":"root"}}` + "\n" +
				`{"request":{"method":"GET","endpoint":"https://juice-shop.test/main.js","tag":"script"}}` + "\n" +
				`{"request":{"method":"POST","endpoint":"https://juice-shop.test/rest/user/login","tag":"form"}}` + "\n" +
				`{"request":{"method":"GET","endpoint":"https://juice-shop.test/api/Products","tag":"a"}}` + "\n"),
		registry.CapURLDiscover: []byte(
			`{"url":"https://juice-shop.test/rest/products/search?q=apple","source":"gau"}` + "\n" +
				`{"url":"https://juice-shop.test/ftp/","source":"wayback"}` + "\n"),
		registry.CapParamDiscover: []byte(
			`{"url":"https://juice-shop.test/rest/products/search","method":"GET","params":["q"]}` + "\n"),
		registry.CapContentDiscover: []byte(
			`{"results":[` +
				`{"url":"https://juice-shop.test/ftp","status":200,"length":3400,"words":120},` +
				`{"url":"https://juice-shop.test/administration","status":200,"length":800,"words":40},` +
				`{"url":"https://juice-shop.test/.git/config","status":200,"length":210,"words":18}` +
				`]}`),
		registry.CapScan: []byte(
			`{"template-id":"git-config","info":{"name":"Exposed .git/config","severity":"medium","tags":["exposure"],"reference":["https://owasp.org/git-exposure"],"remediation":"Block access to the .git directory at the web server."},"matched-at":"https://juice-shop.test/.git/config","extracted-results":["[core] repositoryformatversion=0"]}` + "\n" +
				`{"template-id":"sqli-error","info":{"name":"SQL Injection (error-based)","severity":"critical","tags":["cve","sqli"],"reference":["https://owasp.org/sqli"],"remediation":"Use parameterized queries."},"matched-at":"https://juice-shop.test/rest/products/search?q=","extracted-results":["SQLITE_ERROR: unrecognized token"],"matcher-name":"error","request":"GET /rest/products/search?q=%27 HTTP/1.1\nHost: juice-shop.test"}` + "\n" +
				`{"template-id":"blind-ssrf-oob","info":{"name":"Blind SSRF (out-of-band)","severity":"high","tags":["ssrf"],"reference":["https://owasp.org/ssrf"],"remediation":"Disallow user-controlled outbound requests; enforce an allowlist."},"matched-at":"https://juice-shop.test/rest/track-order","extracted-results":["oob-corr-9f8a"],"matcher-name":"dns"}` + "\n" +
				`{"template-id":"default-login","info":{"name":"Default admin credentials","severity":"high","tags":["default-login"],"remediation":"Change default credentials."},"matched-at":"https://juice-shop.test/administration","extracted-results":["admin:admin123"]}` + "\n"),
		registry.CapOAST: []byte(
			`{"correlation_id":"oob-corr-9f8a","protocol":"dns","remote_addr":"198.51.100.7","timestamp":"2026-01-01T12:00:00Z","raw_request":"A? oob-corr-9f8a.oast.test"}` + "\n"),
	}
}

func main() {
	dir := "./examples/demo/workspace"
	_ = os.RemoveAll(dir)
	ws, err := workspace.Open(dir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	// A fixed clock keeps the demo output byte-for-byte reproducible.
	clk := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	ctl, err := controller.New(ws, controller.Options{
		Target:  "juice-shop.test",
		Targets: []string{"https://juice-shop.test", "127.0.0.1", "*.juice-shop.test"},
		Scope: model.ScopeConfig{
			AllowedDomains: []string{"juice-shop.test"},
			RateLimit:      20,
			MaxConcurrency: 4,
			Authorization:  "TRAINING-LAB / self-hosted vulnerable app",
		},
		Registry: registry.Default(),
		Runner:   &runner.Fake{Outputs: recordedOutputs()},
		Now:      func() time.Time { return clk },
		Progress: func(e controller.Event) {
			fmt.Printf("  [%-5s] %-14s %s\n", e.Status, e.Stage, e.Message)
		},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("Running offline demo scan against simulated juice-shop.test ...")
	if err := ctl.Run(context.Background()); err != nil {
		fmt.Fprintln(os.Stderr, "demo failed:", err)
		os.Exit(1)
	}

	md, _ := ws.ReadFile(workspace.FileReportMD)
	fmt.Print("\n================ report.md ================\n\n")
	fmt.Println(string(md))
	fmt.Printf("Artifacts written to %s\n", ws.Root())
}
