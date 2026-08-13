package agents

import (
	"context"
	"testing"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// missingToolContext builds an agent Context whose runner reports every tool as
// absent (empty Fake outputs -> ErrToolMissing), reproducing a guest with no
// scan tools installed — exactly the v86 case that first surfaced the
// param_discovery regression.
func missingToolContext(t *testing.T) *Context {
	t.Helper()
	ws, err := workspace.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return &Context{
		Scope:    model.ScopeConfig{RateLimit: 10, MaxConcurrency: 2},
		Registry: registry.Default(),
		Runner:   &runner.Fake{Outputs: map[registry.Capability][]byte{}},
		WS:       ws,
		Approved: []string{"example.com"},
	}
}

// TestAgents_DegradeGracefullyWhenToolMissing asserts the contract that a
// missing external tool yields an empty artifact and a nil error, so one absent
// binary never aborts the pipeline (the property the in-v86 run validated).
func TestAgents_DegradeGracefullyWhenToolMissing(t *testing.T) {
	agentsUnderTest := []Agent{
		Fingerprint{},
		Crawl{},
		URLDiscovery{},
		ParamDiscovery{},
		ContentDiscovery{},
		Vulnerability{},
		OAST{},
	}
	for _, ag := range agentsUnderTest {
		t.Run(ag.Name(), func(t *testing.T) {
			ac := missingToolContext(t)
			if err := ag.Run(context.Background(), ac); err != nil {
				t.Fatalf("%s.Run should degrade gracefully when its tool is missing, got: %v", ag.Name(), err)
			}
		})
	}
}
