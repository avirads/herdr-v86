package scope

import (
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/model"
)

func fixedClock() func() time.Time {
	t := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	return func() time.Time { return t }
}

func newGuard(t *testing.T, cfg model.ScopeConfig) *Guard {
	t.Helper()
	g, err := New(cfg, nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return g.WithClock(fixedClock())
}

func TestScope_AllowedDomain(t *testing.T) {
	g := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}})
	cases := []struct {
		target string
		want   bool
	}{
		{"example.com", true},
		{"https://example.com/login", true},
		{"example.com:8443", true},
		{"evil.com", false},
		{"notexample.com", false},
	}
	for _, c := range cases {
		if got := g.Evaluate(c.target).InScope; got != c.want {
			t.Errorf("Evaluate(%q).InScope = %v, want %v", c.target, got, c.want)
		}
	}
}

func TestScope_Subdomains(t *testing.T) {
	off := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}})
	if off.Evaluate("api.example.com").InScope {
		t.Error("subdomain should be rejected when allow_subdomains=false")
	}
	on := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}, AllowSubdomains: true})
	if !on.Evaluate("api.example.com").InScope {
		t.Error("subdomain should be allowed when allow_subdomains=true")
	}
	if on.Evaluate("evil.com").InScope {
		t.Error("unrelated domain must still be rejected with subdomains on")
	}
}

func TestScope_RejectsPrivateAndLocalhost(t *testing.T) {
	g := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}})
	for _, tgt := range []string{"localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.9", "::1", "169.254.1.1"} {
		if g.Evaluate(tgt).InScope {
			t.Errorf("private/localhost target %q must be rejected", tgt)
		}
	}
}

func TestScope_AllowPrivateOptIn(t *testing.T) {
	g := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}, AllowPrivate: true})
	if !g.Evaluate("127.0.0.1").InScope {
		t.Error("loopback should be allowed when allow_private=true")
	}
	if !g.Evaluate("localhost").InScope {
		t.Error("localhost should be allowed when allow_private=true")
	}
}

func TestScope_Wildcard(t *testing.T) {
	off := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}})
	if off.Evaluate("*.example.com").InScope {
		t.Error("wildcard must be rejected by default")
	}
	on := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}, AllowSubdomains: true, AllowWildcard: true})
	// wildcard host itself is not a real host; ensure it is not rejected *for*
	// being a wildcard (it will still fail host match, which is fine).
	if got := on.Evaluate("*.example.com").Reason; got == "wildcard target rejected (allow_wildcard=false)" {
		t.Errorf("wildcard should be permitted when allow_wildcard=true, got reason %q", got)
	}
}

func TestScope_CIDRAllowlist(t *testing.T) {
	g := newGuard(t, model.ScopeConfig{
		AllowedDomains: []string{"example.com"},
		AllowedCIDRs:   []string{"203.0.113.0/24"},
		AllowPrivate:   false,
	})
	if !g.Evaluate("203.0.113.10").InScope {
		t.Error("IP inside allowed CIDR should be approved")
	}
	if g.Evaluate("203.0.114.10").InScope {
		t.Error("IP outside allowed CIDR must be rejected")
	}
}

func TestScope_InvalidCIDRFailsFast(t *testing.T) {
	if _, err := New(model.ScopeConfig{AllowedCIDRs: []string{"not-a-cidr"}}, nil); err == nil {
		t.Fatal("expected error for malformed CIDR")
	}
}

func TestScope_EvaluateAll(t *testing.T) {
	g := newGuard(t, model.ScopeConfig{AllowedDomains: []string{"example.com"}})
	res := g.EvaluateAll([]string{"example.com", "evil.com", "localhost"})
	if len(res.Approved) != 1 || res.Approved[0] != "example.com" {
		t.Errorf("Approved = %v, want [example.com]", res.Approved)
	}
	if len(res.Decisions) != 3 {
		t.Errorf("Decisions len = %d, want 3", len(res.Decisions))
	}
}
