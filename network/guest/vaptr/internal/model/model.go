// Package model defines the canonical data structures exchanged between
// pipeline stages. Every agent reads and writes these types, and each type
// maps 1:1 to a JSON schema in /schemas and a TypeScript interface in /types.
//
// The zero value of every struct is a valid (empty) document so that a
// resumed scan can load a partially-written workspace without special cases.
package model

import "time"

// Severity is the impact rating carried by a finding. It mirrors the
// Nuclei/CVSS qualitative bands.
type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

// Confidence is the validator's judgement about whether a finding is real.
type Confidence string

const (
	ConfInformational Confidence = "informational"
	ConfCandidate     Confidence = "candidate"
	ConfVerified      Confidence = "verified"
	ConfNeedsManual   Confidence = "needs_manual_validation"
	ConfFalsePositive Confidence = "false_positive"
)

// Stage names the pipeline stages in execution order. The controller uses
// these as checkpoint keys for resumable scans.
type Stage string

const (
	StageScope    Stage = "scope"
	StageFinger   Stage = "fingerprint"
	StageCrawl    Stage = "crawl"
	StageURLs     Stage = "urls"
	StageParams   Stage = "parameters"
	StageContent  Stage = "content"
	StageVuln     Stage = "vulnerability"
	StageOAST     Stage = "oast"
	StageValidate Stage = "validate"
	StageReport   Stage = "report"
)

// OrderedStages is the canonical pipeline order.
var OrderedStages = []Stage{
	StageScope, StageFinger, StageCrawl, StageURLs, StageParams,
	StageContent, StageVuln, StageOAST, StageValidate, StageReport,
}

// ScopeConfig is the operator-authored authorization boundary. The Scope Guard
// treats this as the single source of truth; nothing outside it may be probed.
type ScopeConfig struct {
	// AllowedDomains are exact hosts or apex domains that are in scope.
	AllowedDomains []string `json:"allowed_domains"`
	// AllowSubdomains permits *.domain for each allowed apex domain.
	AllowSubdomains bool `json:"allow_subdomains"`
	// AllowedCIDRs are IP ranges explicitly authorized (rare; usually empty).
	AllowedCIDRs []string `json:"allowed_cidrs"`
	// AllowPrivate permits RFC1918 / loopback targets. Default false.
	AllowPrivate bool `json:"allow_private"`
	// AllowWildcard permits wildcard (*) target expressions. Default false.
	AllowWildcard bool `json:"allow_wildcard"`
	// RateLimit caps requests-per-second passed to every downstream tool.
	RateLimit int `json:"rate_limit"`
	// MaxConcurrency caps parallel connections passed to downstream tools.
	MaxConcurrency int `json:"max_concurrency"`
	// Authorization is a free-text reference to the engagement authority
	// (e.g. a signed SoW id). Recorded in the audit log, never acted upon.
	Authorization string `json:"authorization"`
}

// ScopeDecision is the Scope Guard's verdict for a single candidate target.
type ScopeDecision struct {
	Target    string    `json:"target"`
	InScope   bool      `json:"in_scope"`
	Reason    string    `json:"reason"`
	DecidedAt time.Time `json:"decided_at"`
}

// ScopeResult is the full scope.json document.
type ScopeResult struct {
	Config    ScopeConfig     `json:"config"`
	Decisions []ScopeDecision `json:"decisions"`
	Approved  []string        `json:"approved"`
}

// Fingerprint is one line of httpx.jsonl.
type Fingerprint struct {
	URL          string   `json:"url"`
	Input        string   `json:"input"`
	StatusCode   int      `json:"status_code"`
	Title        string   `json:"title"`
	Technologies []string `json:"technologies"`
	Server       string   `json:"server"`
	Redirects    []string `json:"redirects,omitempty"`
	TLS          *TLSInfo `json:"tls,omitempty"`
	ContentType  string   `json:"content_type,omitempty"`
}

// TLSInfo captures the certificate facts httpx reports.
type TLSInfo struct {
	Host      string    `json:"host"`
	Issuer    string    `json:"issuer"`
	SubjectCN string    `json:"subject_cn"`
	NotBefore time.Time `json:"not_before"`
	NotAfter  time.Time `json:"not_after"`
	Version   string    `json:"version"`
}

// CrawlItem is one line of katana.jsonl.
type CrawlItem struct {
	URL      string `json:"url"`
	Method   string `json:"method,omitempty"`
	Kind     string `json:"kind"` // page|form|js|api|swagger|graphql
	Source   string `json:"source,omitempty"`
	FormData string `json:"form_data,omitempty"`
}

// URLRecord is one normalized URL in urls.json.
type URLRecord struct {
	URL     string   `json:"url"`
	Host    string   `json:"host"`
	Path    string   `json:"path"`
	Params  []string `json:"params,omitempty"`
	Sources []string `json:"sources"` // katana|urlfinder|gau|waybackurls
}

// ParamRecord is one discovered parameter set in parameters.json.
type ParamRecord struct {
	URL    string   `json:"url"`
	Method string   `json:"method"` // GET|POST
	Params []string `json:"params"`
}

// ContentRecord is one line of content.json (ffuf hit).
type ContentRecord struct {
	URL      string `json:"url"`
	Status   int    `json:"status"`
	Length   int    `json:"length"`
	Words    int    `json:"words"`
	Category string `json:"category"` // admin|upload|backup|config|api|hidden
}

// Finding is the central vulnerability record. Nuclei emits it (findings.jsonl),
// the OAST agent enriches it, the validator scores it, and the report renders it.
type Finding struct {
	ID           string     `json:"id"`
	TemplateID   string     `json:"template_id,omitempty"`
	Title        string     `json:"title"`
	Severity     Severity   `json:"severity"`
	Confidence   Confidence `json:"confidence"`
	AffectedURL  string     `json:"affected_url"`
	Matcher      string     `json:"matcher,omitempty"`
	Evidence     string     `json:"evidence"`
	Reproduction string     `json:"reproduction"`
	Remediation  string     `json:"remediation"`
	References   []string   `json:"references,omitempty"`
	OASTCallback *OASTEvent `json:"oast_callback,omitempty"`
	Tags         []string   `json:"tags,omitempty"`
	FirstSeen    time.Time  `json:"first_seen"`
}

// OASTEvent is one out-of-band interaction correlated from Interactsh.
type OASTEvent struct {
	CorrelationID string    `json:"correlation_id"`
	Protocol      string    `json:"protocol"` // dns|http|smtp
	RemoteAddr    string    `json:"remote_addr"`
	Timestamp     time.Time `json:"timestamp"`
	RawRequest    string    `json:"raw_request,omitempty"`
}

// Report is the top-level report.json document.
type Report struct {
	Target    string    `json:"target"`
	Generated time.Time `json:"generated"`
	Summary   Summary   `json:"summary"`
	Findings  []Finding `json:"findings"`
}

// Summary is the finding-count rollup used by dashboards and report headers.
type Summary struct {
	Total        int                `json:"total"`
	BySeverity   map[Severity]int   `json:"by_severity"`
	ByConfidence map[Confidence]int `json:"by_confidence"`
}
