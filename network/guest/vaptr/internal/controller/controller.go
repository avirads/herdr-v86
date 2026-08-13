// Package controller is the deterministic orchestrator. It — and only it —
// decides what runs, in what order, against which targets. The LLM never drives
// control flow: it is confined to writing report prose (see internal/llm). This
// separation is the core security property of the framework.
//
// The controller enforces scope before anything else runs, threads the
// operator's rate limits into every agent, records every transition to the
// audit log, and checkpoints after each stage so a scan is resumable.
package controller

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/operator/vmvapt/internal/agents"
	"github.com/operator/vmvapt/internal/audit"
	"github.com/operator/vmvapt/internal/llm"
	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/scope"
	"github.com/operator/vmvapt/internal/workspace"
)

// Options configures a single scan run.
type Options struct {
	Target             string   // primary target label for the report
	Targets            []string // candidate targets to evaluate against scope
	Scope              model.ScopeConfig
	Registry           *registry.Registry
	Runner             runner.Runner
	LLM                llm.Provider     // optional; nil -> deterministic template summary
	FingerprintBackend string           // httpx (default) | native
	CrawlBackend       string           // katana (default) | hakrawler | gospider | native
	ContentBackend     string           // ffuf (default) | native
	ParamBackend       string           // ffuf (default) | native
	ScanBackend        string           // nuclei (default) | native
	OASTServer         string           // self-hosted interactsh base URL (empty = off)
	OASTToken          string           // interactsh auth token (resolved from env)
	Force              bool             // re-run completed stages instead of resuming
	Now                func() time.Time // injectable clock (tests)
	Progress           func(Event)      // optional progress sink for CLI/dashboard
}

// Event is a progress notification emitted as stages start and finish.
type Event struct {
	Stage   model.Stage
	Status  string // "start" | "done" | "skip" | "error"
	Message string
	At      time.Time
}

// Controller runs the pipeline for one workspace.
type Controller struct {
	ws        *workspace.Workspace
	log       *audit.Log
	auditFile io.Closer
	opt       Options
	now       func() time.Time
}

// Close releases the audit log file handle. Run calls it automatically; it is
// exported so callers that construct a Controller without running can still
// release resources.
func (c *Controller) Close() error {
	if c.auditFile != nil {
		err := c.auditFile.Close()
		c.auditFile = nil
		return err
	}
	return nil
}

// New builds a controller bound to a workspace directory.
func New(ws *workspace.Workspace, opt Options) (*Controller, error) {
	if opt.Registry == nil {
		opt.Registry = registry.Default()
	}
	if opt.Runner == nil {
		opt.Runner = runner.Exec{Timeout: 10 * time.Minute}
	}
	now := opt.Now
	if now == nil {
		now = time.Now
	}
	af, err := ws.OpenAppend(workspace.FileAudit)
	if err != nil {
		return nil, fmt.Errorf("open audit log: %w", err)
	}
	log := audit.New(af).WithClock(now)
	return &Controller{ws: ws, log: log, auditFile: af, opt: opt, now: now}, nil
}

func (c *Controller) emit(stage model.Stage, status, msg string) {
	if c.opt.Progress != nil {
		c.opt.Progress(Event{Stage: stage, Status: status, Message: msg, At: c.now().UTC()})
	}
}

// Run executes the full pipeline. It returns the first fatal error; a missing
// external tool is not fatal (the stage produces an empty artifact and the scan
// continues), matching the "each agent executes independently" goal.
func (c *Controller) Run(ctx context.Context) error {
	defer c.Close()
	state, err := c.ws.LoadState(c.opt.Target)
	if err != nil {
		return fmt.Errorf("load state: %w", err)
	}
	_, _ = c.log.Record("controller", "scan.start", c.opt.Target,
		map[string]string{"authorization": c.opt.Scope.Authorization})

	// Stage 1 — Scope Guard (always runs the guard; approval gates everything).
	approved, err := c.runScope(state)
	if err != nil {
		return err
	}
	if len(approved) == 0 {
		return fmt.Errorf("scope: no targets approved; refusing to scan")
	}

	ac := &agents.Context{
		Scope:              c.opt.Scope,
		Registry:           c.opt.Registry,
		Runner:             c.opt.Runner,
		WS:                 c.ws,
		Audit:              c.log,
		Approved:           approved,
		FingerprintBackend: c.opt.FingerprintBackend,
		CrawlBackend:       c.opt.CrawlBackend,
		ContentBackend:     c.opt.ContentBackend,
		ParamBackend:       c.opt.ParamBackend,
		ScanBackend:        c.opt.ScanBackend,
		OASTServer:         c.opt.OASTServer,
		OASTToken:          c.opt.OASTToken,
	}

	// Stages 2..10 — ordered agents.
	pipeline := []agents.Agent{
		agents.Fingerprint{},
		agents.Crawl{},
		agents.URLDiscovery{},
		agents.ParamDiscovery{},
		agents.ContentDiscovery{},
		agents.Vulnerability{Now: c.now},
		agents.OAST{},
		agents.Validator{},
		agents.Report{LLM: c.opt.LLM, Target: c.opt.Target, Now: c.now},
	}

	for _, ag := range pipeline {
		st := ag.Stage()
		if state.Completed[st] && !c.opt.Force {
			c.emit(st, "skip", "already completed (resume)")
			_, _ = c.log.Record("controller", "stage.skip", string(st), nil)
			continue
		}
		c.emit(st, "start", ag.Name())
		_, _ = c.log.Record("controller", "stage.start", string(st), nil)

		if err := ag.Run(ctx, ac); err != nil {
			c.emit(st, "error", err.Error())
			_, _ = c.log.Record("controller", "stage.error", string(st), map[string]string{"error": err.Error()})
			return fmt.Errorf("stage %s: %w", st, err)
		}
		state.Completed[st] = true
		if err := c.ws.SaveState(state); err != nil {
			return fmt.Errorf("save state after %s: %w", st, err)
		}
		c.emit(st, "done", ag.Name())
		_, _ = c.log.Record("controller", "stage.done", string(st), nil)
	}

	_, _ = c.log.Record("controller", "scan.complete", c.opt.Target, nil)
	return nil
}

// runScope executes the Scope Guard, persists scope.json, and returns the
// approved targets. It is skipped on resume if already completed.
func (c *Controller) runScope(state *workspace.State) ([]string, error) {
	if state.Completed[model.StageScope] && !c.opt.Force {
		c.emit(model.StageScope, "skip", "already completed (resume)")
		var res model.ScopeResult
		if err := c.ws.ReadJSON(workspace.FileScope, &res); err != nil {
			return nil, fmt.Errorf("scope: reload: %w", err)
		}
		return res.Approved, nil
	}
	c.emit(model.StageScope, "start", "scope guard")
	guard, err := scope.New(c.opt.Scope, c.log)
	if err != nil {
		return nil, fmt.Errorf("scope: %w", err)
	}
	guard.WithClock(c.now)
	res := guard.EvaluateAll(c.opt.Targets)
	if err := c.ws.WriteJSON(workspace.FileScope, res); err != nil {
		return nil, fmt.Errorf("scope: write: %w", err)
	}
	state.Completed[model.StageScope] = true
	if err := c.ws.SaveState(state); err != nil {
		return nil, err
	}
	c.emit(model.StageScope, "done", fmt.Sprintf("%d/%d approved", len(res.Approved), len(res.Decisions)))
	return res.Approved, nil
}

// DiscardWriter is a convenience no-op writer for callers that do not want a
// separate progress stream.
var DiscardWriter io.Writer = io.Discard
