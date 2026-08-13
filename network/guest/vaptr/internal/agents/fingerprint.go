package agents

import (
	"context"
	"errors"
	"fmt"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// Fingerprint is Agent 2. It runs httpx over the approved targets and records
// status, title, technologies, server, redirects and TLS to httpx.jsonl.
type Fingerprint struct{}

func (Fingerprint) Name() string       { return "fingerprint" }
func (Fingerprint) Stage() model.Stage { return model.StageFinger }

// httpxLine matches the subset of httpx -json output we consume.
type httpxLine struct {
	URL        string   `json:"url"`
	Input      string   `json:"input"`
	StatusCode int      `json:"status_code"`
	Title      string   `json:"title"`
	Tech       []string `json:"tech"`
	WebServer  string   `json:"webserver"`
	Chain      []string `json:"chain"`
	TLS        *struct {
		Host       string `json:"host"`
		IssuerCN   string `json:"issuer_cn"`
		SubjectCN  string `json:"subject_cn"`
		NotBefore  string `json:"not_before"`
		NotAfter   string `json:"not_after"`
		TLSVersion string `json:"tls_version"`
	} `json:"tls"`
	ContentType string `json:"content_type"`
}

func (a Fingerprint) Run(ctx context.Context, ac *Context) error {
	// "native" backend: probe in-process (no httpx).
	if ac.FingerprintBackend == "native" {
		return runNativeFingerprint(ctx, ac)
	}

	args := [][2]string{{"-json", ""}, {"-td", ""}, {"-tls-grab", ""}, {"-silent", ""}}
	args = append(args, rateArgs(ac.Scope, "-rate-limit", "-threads")...)
	inv, err := ac.Registry.Build(ctx, registry.CapFingerprint, args)
	if err != nil {
		return fmt.Errorf("fingerprint: build: %w", err)
	}
	inv.Stdin = targetStdin(ac) // feed approved targets to httpx via stdin
	logInvoke(ac, a.Name(), inv)

	res, err := ac.Runner.Run(ctx, inv)
	if errors.Is(err, runner.ErrToolMissing) {
		return writeEmpty(ac.WS, workspace.FileHTTPX)
	}
	if err != nil {
		return fmt.Errorf("fingerprint: run: %w", err)
	}

	var out []byte
	for _, fp := range parseHTTPX(res.Stdout) {
		out = appendJSONL(out, fp)
	}
	return ac.WS.WriteFile(workspace.FileHTTPX, out)
}

// parseHTTPX converts raw httpx -json output into model.Fingerprint records.
// Extracted as a pure function so it can be regression-tested against real
// captured httpx output (see testdata/httpx.real.jsonl).
func parseHTTPX(data []byte) []model.Fingerprint {
	var out []model.Fingerprint
	eachJSONLine(data, func(l httpxLine) {
		fp := model.Fingerprint{
			URL: l.URL, Input: l.Input, StatusCode: l.StatusCode, Title: l.Title,
			Technologies: l.Tech, Server: l.WebServer, Redirects: l.Chain, ContentType: l.ContentType,
		}
		if l.TLS != nil {
			fp.TLS = &model.TLSInfo{
				Host: l.TLS.Host, Issuer: l.TLS.IssuerCN, SubjectCN: l.TLS.SubjectCN,
				Version: l.TLS.TLSVersion,
			}
		}
		out = append(out, fp)
	})
	return out
}
