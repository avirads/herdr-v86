// Package agents implements the ten independent pipeline agents. Each agent is
// a small, deterministic unit that:
//  1. reads its input artifact(s) from the workspace,
//  2. asks the registry to build a validated tool invocation (never a raw
//     command),
//  3. runs it through the Runner,
//  4. parses the tool's JSON output into model types,
//  5. writes its output artifact and returns.
//
// Agents share nothing but the workspace on disk, so they can run, be tested,
// and be resumed independently.
package agents

import (
	"context"
	"strconv"
	"strings"

	"github.com/operator/vmvapt/internal/audit"
	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// Context carries the shared collaborators every agent needs. It is assembled
// once by the controller and passed to each agent's Run.
type Context struct {
	Scope    model.ScopeConfig
	Registry *registry.Registry
	Runner   runner.Runner
	WS       *workspace.Workspace
	Audit    *audit.Log
	Approved []string // scope-approved targets
	// FingerprintBackend selects the prober: httpx (default) | native.
	FingerprintBackend string
	// CrawlBackend selects the crawl tool: katana (default) | hakrawler | gospider | native.
	CrawlBackend string
	// ContentBackend selects content discovery: ffuf (default) | native.
	ContentBackend string
	// ParamBackend selects param discovery: ffuf (default) | native.
	ParamBackend string
	// ScanBackend selects the vuln scanner: nuclei (default) | native.
	ScanBackend string
	// OASTServer is the self-hosted interactsh base URL (empty = OAST off).
	OASTServer string
	// OASTToken is the interactsh auth token (resolved from the config's
	// token_env by the controller; never read from the config file directly).
	OASTToken string
}

// Agent is the uniform contract implemented by all ten agents.
type Agent interface {
	// Name is the stable agent identifier used in logs and the audit trail.
	Name() string
	// Stage is the pipeline stage this agent fulfills.
	Stage() model.Stage
	// Run executes the agent against the shared Context. It must be idempotent:
	// running it twice on the same workspace yields the same artifact.
	Run(ctx context.Context, ac *Context) error
}

// rateArgs returns the {flag,value} pairs that apply the operator's scope rate
// limit and concurrency to a tool, using each tool's own flag names. Centralised
// so no agent can forget to pass them.
func rateArgs(cfg model.ScopeConfig, rateFlag, concFlag string) [][2]string {
	var out [][2]string
	if cfg.RateLimit > 0 && rateFlag != "" {
		out = append(out, [2]string{rateFlag, strconv.Itoa(cfg.RateLimit)})
	}
	if cfg.MaxConcurrency > 0 && concFlag != "" {
		out = append(out, [2]string{concFlag, strconv.Itoa(cfg.MaxConcurrency)})
	}
	return out
}

// targetStdin renders the scope-approved targets as newline-delimited stdin for
// the tools that read their target list from standard input (httpx, katana,
// nuclei, urlfinder). Returns nil when there are no approved targets so the
// caller can decide whether running the tool makes sense.
func targetStdin(ac *Context) []byte {
	if len(ac.Approved) == 0 {
		return nil
	}
	return []byte(strings.Join(ac.Approved, "\n") + "\n")
}

// ensureScheme returns a target as an http(s) base URL. Approved targets may be
// bare hosts or full URLs; ffuf needs a URL. Defaults to http:// when no
// scheme is present. The returned value has no trailing slash.
func ensureScheme(target string) string {
	t := strings.TrimSpace(target)
	if t == "" {
		return ""
	}
	if !strings.Contains(t, "://") {
		t = "http://" + t
	}
	return strings.TrimRight(t, "/")
}

// logInvoke records a tool invocation to the audit log.
func logInvoke(ac *Context, agent string, inv registry.Invocation) {
	if ac.Audit == nil {
		return
	}
	_, _ = ac.Audit.Record("agent:"+agent, "tool.invoke", string(inv.Capability),
		map[string]string{"binary": inv.Binary, "argc": strconv.Itoa(len(inv.Args))})
}
