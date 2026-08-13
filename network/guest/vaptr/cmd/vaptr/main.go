// Command vaptr is the CLI for the v86 Web VAPT framework. It runs the full
// pipeline against an operator-authored config, printing a compact terminal
// dashboard and emitting structured JSON logs.
//
// Usage:
//
//	vaptr scan   -config scan.json          run (or resume) a scan
//	vaptr resume -config scan.json          alias for scan (resumes by default)
//	vaptr scan   -config scan.json -force   re-run every stage
//	vaptr caps                              list registered tool capabilities
//	vaptr version                           print version
//
// All execution is deterministic and confined to the workspace; the LLM (if
// configured) only writes the report narrative.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/config"
	"github.com/operator/vmvapt/internal/controller"
	"github.com/operator/vmvapt/internal/llm"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

var version = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "scan", "resume":
		os.Exit(cmdScan(os.Args[2:], os.Args[1] == "resume"))
	case "caps":
		cmdCaps()
	case "version":
		fmt.Println("vaptr", version)
	case "-h", "--help", "help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `vaptr — v86 Web VAPT framework

Commands:
  scan   -config <file> [-force] [-json]   run or resume a scan
  resume -config <file> [-json]            resume a scan
  caps                                     list registered tool capabilities
  version                                  print version

Only authorized, in-scope targets are ever probed. See docs/ for details.
`)
}

func cmdScan(args []string, _ bool) int {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	cfgPath := fs.String("config", "scan.json", "path to scan config JSON")
	force := fs.Bool("force", false, "re-run stages already marked complete")
	jsonLogs := fs.Bool("json", false, "emit machine-readable JSON progress logs")
	_ = fs.Parse(args)

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		return 1
	}

	ws, err := workspace.Open(cfg.Workspace)
	if err != nil {
		fmt.Fprintln(os.Stderr, "workspace error:", err)
		return 1
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	start := time.Now()
	dash := newDashboard(*jsonLogs)
	ctl, err := controller.New(ws, controller.Options{
		Target:             cfg.Target,
		Targets:            cfg.Targets,
		Scope:              cfg.Scope,
		Registry:           registry.Default(),
		Runner:             runner.Exec{Timeout: 10 * time.Minute},
		LLM:                selectLLM(cfg.LLM),
		FingerprintBackend: cfg.Fingerprint.Backend,
		CrawlBackend:       cfg.Crawl.Backend,
		ContentBackend:     cfg.Content.Backend,
		ParamBackend:       cfg.Params.Backend,
		ScanBackend:        cfg.Scan.Backend,
		OASTServer:         cfg.OAST.Server,
		OASTToken:          oastToken(cfg.OAST),
		Force:              *force,
		Progress:           dash.emit,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "controller error:", err)
		return 1
	}

	if err := ctl.Run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "\nscan failed:", err)
		return 1
	}
	fmt.Printf("\n✔ scan complete in %s\n", time.Since(start).Round(time.Millisecond))
	fmt.Printf("  report: %s\n", ws.Root())
	return 0
}

func cmdCaps() {
	r := registry.Default()
	fmt.Println("Registered capabilities (the LLM may invoke ONLY these):")
	for _, c := range r.Capabilities() {
		t, _ := r.Lookup(c)
		fmt.Printf("  %-18s -> %-18s [%s]  %s\n", c, t.Binary, t.License, t.Description)
		if backends := r.Backends(c); len(backends) > 1 {
			fmt.Printf("  %-18s    backends: %s (default: %s)\n", "", strings.Join(backends, ", "), backends[0])
		}
	}
}

// oastToken resolves the interactsh auth token from the env var named in the
// config, so the secret is never stored in the config file or workspace.
func oastToken(c config.OASTConfig) string {
	if c.TokenEnv == "" {
		return ""
	}
	return os.Getenv(c.TokenEnv)
}

// selectLLM wires the configured provider. "none" uses the offline template;
// "vmllm"/"command" reach a local model CLI (the WebGPU model via herdr's
// vmllm bridge inside v86). Networked providers are extension points.
func selectLLM(c config.LLMConfig) llm.Provider {
	switch c.Provider {
	case "", "none":
		return nil // report agent falls back to the deterministic template
	case "vmllm", "command", "local":
		p := llm.DefaultVMLLM(c.Command, c.MaxTokens)
		fmt.Fprintf(os.Stderr, "note: report narrative via local model command %q\n", p.Bin)
		return p
	default:
		// Unknown providers degrade gracefully to the offline template rather
		// than failing a scan (see docs/EXTENSIONS.md to add networked ones).
		fmt.Fprintf(os.Stderr, "note: llm provider %q not compiled in; using offline template\n", c.Provider)
		return nil
	}
}

// dashboard renders the terminal progress indicator (and optional JSON logs).
type dashboard struct {
	jsonMode bool
	order    []string
	done     map[string]string
}

func newDashboard(jsonMode bool) *dashboard {
	return &dashboard{jsonMode: jsonMode, done: map[string]string{}}
}

func (d *dashboard) emit(e controller.Event) {
	if d.jsonMode {
		_ = json.NewEncoder(os.Stdout).Encode(e)
		return
	}
	icon := map[string]string{"start": "▶", "done": "✔", "skip": "↩", "error": "✖"}[e.Status]
	if icon == "" {
		icon = "•"
	}
	line := fmt.Sprintf("%s  %-14s %s", icon, e.Stage, e.Message)
	fmt.Println(line)
}
