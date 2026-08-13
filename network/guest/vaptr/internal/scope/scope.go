// Package scope implements Agent 1 — the Scope Guard. It is the trust boundary
// of the entire framework: no target reaches any downstream tool unless the
// Scope Guard approves it. Every decision is recorded to the audit log.
//
// Rejection rules (in order):
//   - reject wildcard expressions unless AllowWildcard
//   - reject loopback / localhost unless AllowPrivate
//   - reject RFC1918 / link-local / unique-local unless AllowPrivate
//   - reject IPs outside AllowedCIDRs when any CIDR is configured
//   - accept only hosts matching AllowedDomains (apex or subdomain per config)
package scope

import (
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/audit"
	"github.com/operator/vmvapt/internal/model"
)

// Guard evaluates candidate targets against a ScopeConfig.
type Guard struct {
	cfg   model.ScopeConfig
	log   *audit.Log
	cidrs []*net.IPNet
	nowFn func() time.Time
}

// New builds a Guard, pre-parsing the allowed CIDRs. It returns an error if a
// CIDR is malformed so misconfiguration fails fast rather than silently
// widening scope.
func New(cfg model.ScopeConfig, log *audit.Log) (*Guard, error) {
	g := &Guard{cfg: cfg, log: log, nowFn: time.Now}
	for _, c := range cfg.AllowedCIDRs {
		_, ipnet, err := net.ParseCIDR(strings.TrimSpace(c))
		if err != nil {
			return nil, fmt.Errorf("invalid allowed_cidr %q: %w", c, err)
		}
		g.cidrs = append(g.cidrs, ipnet)
	}
	return g, nil
}

// WithClock overrides the clock (test hook).
func (g *Guard) WithClock(fn func() time.Time) *Guard { g.nowFn = fn; return g }

// Evaluate decides a single target. A target may be a bare host, a host:port,
// or a full URL. The returned decision is always recorded to the audit log.
func (g *Guard) Evaluate(target string) model.ScopeDecision {
	inScope, reason := g.decide(target)
	dec := model.ScopeDecision{
		Target:    target,
		InScope:   inScope,
		Reason:    reason,
		DecidedAt: g.nowFn().UTC(),
	}
	if g.log != nil {
		action := "scope.reject"
		if inScope {
			action = "scope.approve"
		}
		_, _ = g.log.Record("agent:scope", action, target, map[string]string{"reason": reason})
	}
	return dec
}

// EvaluateAll evaluates every candidate and returns the full ScopeResult,
// including the flat list of approved targets for downstream stages.
func (g *Guard) EvaluateAll(targets []string) model.ScopeResult {
	res := model.ScopeResult{Config: g.cfg}
	for _, t := range targets {
		d := g.Evaluate(t)
		res.Decisions = append(res.Decisions, d)
		if d.InScope {
			res.Approved = append(res.Approved, t)
		}
	}
	return res
}

// decide is the pure decision function (no side effects) so it is trivially
// unit-testable.
func (g *Guard) decide(target string) (bool, string) {
	host := normalizeHost(target)
	if host == "" {
		return false, "empty or unparseable target"
	}

	if strings.Contains(host, "*") {
		if !g.cfg.AllowWildcard {
			return false, "wildcard target rejected (allow_wildcard=false)"
		}
	}

	if ip := net.ParseIP(host); ip != nil {
		return g.decideIP(ip)
	}

	// Hostname path.
	if isLocalhostName(host) {
		if g.cfg.AllowPrivate {
			return true, "localhost allowed (allow_private=true)"
		}
		return false, "localhost rejected (allow_private=false)"
	}
	if g.hostAllowed(host) {
		return true, "host matches allowed_domains"
	}
	return false, "host not in allowed_domains"
}

func (g *Guard) decideIP(ip net.IP) (bool, string) {
	if isPrivate(ip) && !g.cfg.AllowPrivate {
		return false, "private/loopback/link-local IP rejected (allow_private=false)"
	}
	if len(g.cidrs) > 0 {
		for _, n := range g.cidrs {
			if n.Contains(ip) {
				return true, "IP within allowed_cidrs"
			}
		}
		return false, "IP outside allowed_cidrs"
	}
	// No CIDR allowlist configured: a bare public IP is not an approved domain.
	if g.cfg.AllowPrivate {
		return true, "IP allowed (allow_private=true, no cidr restriction)"
	}
	return false, "bare IP rejected; add it to allowed_cidrs to authorize"
}

// hostAllowed matches a hostname against the allowed domain list, honoring the
// AllowSubdomains flag.
func (g *Guard) hostAllowed(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, d := range g.cfg.AllowedDomains {
		d = strings.ToLower(strings.TrimSpace(d))
		if d == "" {
			continue
		}
		if host == d {
			return true
		}
		if g.cfg.AllowSubdomains && strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}

// normalizeHost extracts a comparable host from a bare host, host:port, or URL.
func normalizeHost(target string) string {
	t := strings.TrimSpace(target)
	if t == "" {
		return ""
	}
	if strings.Contains(t, "://") {
		if u, err := url.Parse(t); err == nil && u.Hostname() != "" {
			return strings.ToLower(u.Hostname())
		}
	}
	// Strip a trailing :port if present and unambiguous.
	if h, _, err := net.SplitHostPort(t); err == nil {
		return strings.ToLower(h)
	}
	return strings.ToLower(t)
}

func isLocalhostName(host string) bool {
	h := strings.ToLower(host)
	return h == "localhost" || strings.HasSuffix(h, ".localhost")
}

// isPrivate reports whether ip is loopback, link-local, or in an RFC1918 /
// RFC4193 private range.
func isPrivate(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}
	return ip.IsPrivate() // covers 10/8, 172.16/12, 192.168/16, fc00::/7
}
