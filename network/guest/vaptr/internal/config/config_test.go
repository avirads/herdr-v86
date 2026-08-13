package config

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "scan.json")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoad_Valid(t *testing.T) {
	p := write(t, `{
		"target":"example.com",
		"targets":["example.com"],
		"scope":{"allowed_domains":["example.com"],"authorization":"SoW-1"}
	}`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.Workspace != "./workspace" {
		t.Errorf("default workspace not applied: %q", c.Workspace)
	}
	if c.Scope.RateLimit != 50 || c.Scope.MaxConcurrency != 10 {
		t.Errorf("default rate/concurrency not applied: %d/%d", c.Scope.RateLimit, c.Scope.MaxConcurrency)
	}
	if c.LLM.Provider != "none" {
		t.Errorf("default llm provider = %q, want none", c.LLM.Provider)
	}
}

func TestLoad_RequiresAuthorization(t *testing.T) {
	p := write(t, `{"target":"x","targets":["x"],"scope":{"allowed_domains":["x"]}}`)
	if _, err := Load(p); err == nil {
		t.Fatal("expected error when scope.authorization is missing")
	}
}

func TestLoad_RequiresScopeEntry(t *testing.T) {
	p := write(t, `{"target":"x","targets":["x"],"scope":{"authorization":"a"}}`)
	if _, err := Load(p); err == nil {
		t.Fatal("expected error when no allowed_domains/allowed_cidrs")
	}
}

func TestLoad_RequiresTargets(t *testing.T) {
	p := write(t, `{"target":"x","targets":[],"scope":{"allowed_domains":["x"],"authorization":"a"}}`)
	if _, err := Load(p); err == nil {
		t.Fatal("expected error when targets is empty")
	}
}

func TestLoad_RejectsUnknownFields(t *testing.T) {
	p := write(t, `{"target":"x","targets":["x"],"scope":{"allowed_domains":["x"],"authorization":"a"},"bogus":true}`)
	if _, err := Load(p); err == nil {
		t.Fatal("expected error for unknown config field")
	}
}
