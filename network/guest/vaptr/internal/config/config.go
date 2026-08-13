// Package config loads the operator-authored scan configuration. Config is
// plain JSON (no YAML dependency) so the binary stays stdlib-only and tiny.
package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/operator/vmvapt/internal/model"
)

// Config is the top-level scan configuration file.
type Config struct {
	// Target is the primary label used in the report header.
	Target string `json:"target"`
	// Targets are the candidate hosts/URLs evaluated by the Scope Guard.
	Targets []string `json:"targets"`
	// Scope is the authorization boundary and rate limits.
	Scope model.ScopeConfig `json:"scope"`
	// Workspace is the scan output directory.
	Workspace string `json:"workspace"`
	// LLM configures the optional report-narrative provider.
	LLM LLMConfig `json:"llm"`
	// OAST configures the out-of-band interaction server used for blind-vuln
	// confirmation (self-hosted interactsh).
	OAST OASTConfig `json:"oast"`
	// Fingerprint selects the fingerprint backend.
	Fingerprint FingerprintConfig `json:"fingerprint"`
	// Crawl selects the crawl backend.
	Crawl CrawlConfig `json:"crawl"`
	// Content selects the content-discovery backend.
	Content ContentConfig `json:"content"`
	// Params selects the parameter-discovery backend.
	Params ParamConfig `json:"params"`
	// Scan selects the vulnerability-scan backend.
	Scan ScanConfig `json:"scan"`
}

// FingerprintConfig selects which prober the fingerprint stage uses.
type FingerprintConfig struct {
	// Backend is httpx (default) or native (built-in prober).
	Backend string `json:"backend"`
}

// CrawlConfig selects which crawler the crawl stage uses.
type CrawlConfig struct {
	// Backend is katana (default), hakrawler, gospider, or native.
	Backend string `json:"backend"`
}

// ContentConfig selects the content-discovery backend.
type ContentConfig struct {
	// Backend is ffuf (default) or native.
	Backend string `json:"backend"`
}

// ParamConfig selects the parameter-discovery backend.
type ParamConfig struct {
	// Backend is ffuf (default) or native.
	Backend string `json:"backend"`
}

// ScanConfig selects which vulnerability scanner the scan stage uses.
type ScanConfig struct {
	// Backend is nuclei (default, broad) or native (built-in curated checks).
	Backend string `json:"backend"`
}

// OASTConfig points the scan at a self-hosted interactsh server (e.g.
// https://oast.fapstaff.com) instead of a public one. The auth token is read
// from an environment variable so the secret never lives in the config file.
type OASTConfig struct {
	// Server is the interactsh server base URL, passed to nuclei
	// (-interactsh-server) and interactsh-client (-server). Empty = OAST off /
	// nuclei's default public server.
	Server string `json:"server"`
	// TokenEnv names the environment variable holding the interactsh auth token.
	TokenEnv string `json:"token_env"`
}

// LLMConfig selects the report-narrative provider. "none" (default) uses the
// offline deterministic template. "vmllm" reaches the browser's WebGPU model
// through herdr's `vmllm` bridge when vaptr runs inside the v86 guest.
type LLMConfig struct {
	Provider string `json:"provider"` // none|vmllm|command|openai|anthropic|local
	Model    string `json:"model"`
	BaseURL  string `json:"base_url"`
	// APIKeyEnv names the environment variable holding the key. The key itself
	// is never stored in config, keeping secrets out of the workspace.
	APIKeyEnv string `json:"api_key_env"`
	// Command is the CLI invoked for the "vmllm"/"command" providers. Defaults
	// to "vmllm". It is resolved from PATH and run with an explicit argv.
	Command string `json:"command"`
	// MaxTokens caps the generated executive summary (default 320).
	MaxTokens int `json:"max_tokens"`
}

// Load reads and validates a config file.
func Load(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var c Config
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if err := c.validate(); err != nil {
		return nil, err
	}
	c.applyDefaults()
	return &c, nil
}

func (c *Config) validate() error {
	if c.Target == "" {
		return fmt.Errorf("config: target is required")
	}
	if len(c.Targets) == 0 {
		return fmt.Errorf("config: at least one entry in targets is required")
	}
	if len(c.Scope.AllowedDomains) == 0 && len(c.Scope.AllowedCIDRs) == 0 {
		return fmt.Errorf("config: scope must list at least one allowed_domain or allowed_cidr")
	}
	if c.Scope.Authorization == "" {
		return fmt.Errorf("config: scope.authorization is required (record the engagement authority)")
	}
	switch c.Fingerprint.Backend {
	case "", "httpx", "native":
	default:
		return fmt.Errorf("config: fingerprint.backend %q must be httpx or native", c.Fingerprint.Backend)
	}
	switch c.Crawl.Backend {
	case "", "katana", "hakrawler", "gospider", "native":
	default:
		return fmt.Errorf("config: crawl.backend %q must be katana, hakrawler, gospider, or native", c.Crawl.Backend)
	}
	switch c.Content.Backend {
	case "", "ffuf", "native":
	default:
		return fmt.Errorf("config: content.backend %q must be ffuf or native", c.Content.Backend)
	}
	switch c.Params.Backend {
	case "", "ffuf", "native":
	default:
		return fmt.Errorf("config: params.backend %q must be ffuf or native", c.Params.Backend)
	}
	switch c.Scan.Backend {
	case "", "nuclei", "native":
	default:
		return fmt.Errorf("config: scan.backend %q must be nuclei or native", c.Scan.Backend)
	}
	return nil
}

func (c *Config) applyDefaults() {
	if c.Workspace == "" {
		c.Workspace = "./workspace"
	}
	if c.Scope.RateLimit == 0 {
		c.Scope.RateLimit = 50
	}
	if c.Scope.MaxConcurrency == 0 {
		c.Scope.MaxConcurrency = 10
	}
	if c.LLM.Provider == "" {
		c.LLM.Provider = "none"
	}
}
