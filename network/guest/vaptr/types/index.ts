/**
 * vmvapt — canonical TypeScript data contract.
 *
 * These interfaces mirror the Go structs in `internal/model` 1:1 and the JSON
 * Schemas in `/schemas`. They are the single source of truth for any TypeScript
 * consumer: a browser dashboard rendering a report, a v86 front-end, or a
 * future TS-based agent. Field names use snake_case to match the on-disk JSON
 * exactly (the Go structs carry matching `json:"..."` tags).
 *
 * License: MIT.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Confidence =
  | "informational"
  | "candidate"
  | "verified"
  | "needs_manual_validation"
  | "false_positive";

export type Stage =
  | "scope"
  | "fingerprint"
  | "crawl"
  | "urls"
  | "parameters"
  | "content"
  | "vulnerability"
  | "oast"
  | "validate"
  | "report";

/** The pipeline stages in canonical execution order. */
export const ORDERED_STAGES: readonly Stage[] = [
  "scope", "fingerprint", "crawl", "urls", "parameters",
  "content", "vulnerability", "oast", "validate", "report",
] as const;

/** LLM-facing capabilities. An agent/LLM may request ONLY these — never a
 *  binary name, a flag, or a shell string. */
export type Capability =
  | "fingerprint"
  | "crawl"
  | "url_discover"
  | "param_discover"
  | "content_discover"
  | "scan"
  | "oast";

// ---------------------------------------------------------------------------
// Scope (Agent 1)
// ---------------------------------------------------------------------------

export interface ScopeConfig {
  allowed_domains: string[];
  allow_subdomains: boolean;
  allowed_cidrs: string[];
  allow_private: boolean;
  allow_wildcard: boolean;
  rate_limit: number;
  max_concurrency: number;
  /** Free-text reference to the engagement authority (e.g. signed SoW id). */
  authorization: string;
}

export interface ScopeDecision {
  target: string;
  in_scope: boolean;
  reason: string;
  decided_at: string; // RFC3339
}

export interface ScopeResult {
  config: ScopeConfig;
  decisions: ScopeDecision[];
  approved: string[];
}

// ---------------------------------------------------------------------------
// Fingerprint (Agent 2) — httpx.jsonl
// ---------------------------------------------------------------------------

export interface TLSInfo {
  host: string;
  issuer: string;
  subject_cn: string;
  not_before: string;
  not_after: string;
  version: string;
}

export interface Fingerprint {
  url: string;
  input: string;
  status_code: number;
  title: string;
  technologies: string[];
  server: string;
  redirects?: string[];
  tls?: TLSInfo;
  content_type?: string;
}

// ---------------------------------------------------------------------------
// Crawl (Agent 3) — katana.jsonl
// ---------------------------------------------------------------------------

export type CrawlKind =
  | "page" | "form" | "js" | "api" | "swagger" | "graphql";

export interface CrawlItem {
  url: string;
  method?: string;
  kind: CrawlKind;
  source?: string;
  form_data?: string;
}

// ---------------------------------------------------------------------------
// URL discovery (Agent 4) — urls.json
// ---------------------------------------------------------------------------

export interface URLRecord {
  url: string;
  host: string;
  path: string;
  params?: string[];
  /** Union of the sources that reported this URL: katana|urlfinder|gau|wayback. */
  sources: string[];
}

// ---------------------------------------------------------------------------
// Parameter discovery (Agent 5) — parameters.json
// ---------------------------------------------------------------------------

export interface ParamRecord {
  url: string;
  method: "GET" | "POST";
  params: string[];
}

// ---------------------------------------------------------------------------
// Content discovery (Agent 6) — content.json
// ---------------------------------------------------------------------------

export type ContentCategory =
  | "admin" | "upload" | "backup" | "config" | "api" | "hidden";

export interface ContentRecord {
  url: string;
  status: number;
  length: number;
  words: number;
  category: ContentCategory;
}

// ---------------------------------------------------------------------------
// Findings (Agents 7–9) — findings.jsonl
// ---------------------------------------------------------------------------

export interface OASTEvent {
  correlation_id: string;
  protocol: "dns" | "http" | "smtp";
  remote_addr: string;
  timestamp: string;
  raw_request?: string;
}

export interface Finding {
  id: string;
  template_id?: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  affected_url: string;
  matcher?: string;
  evidence: string;
  reproduction: string;
  remediation: string;
  references?: string[];
  oast_callback?: OASTEvent;
  tags?: string[];
  first_seen: string;
}

// ---------------------------------------------------------------------------
// Report (Agent 10) — report.json
// ---------------------------------------------------------------------------

export interface Summary {
  total: number;
  by_severity: Record<Severity, number>;
  by_confidence: Record<Confidence, number>;
}

export interface Report {
  target: string;
  generated: string;
  summary: Summary;
  findings: Finding[];
}

// ---------------------------------------------------------------------------
// Agent & tool-registry contracts
// ---------------------------------------------------------------------------

/** A registered, vetted external tool. */
export interface Tool {
  capability: Capability;
  binary: string;
  description: string;
  /** The exact set of flag keys this tool may receive. */
  allowed_args: string[];
  license: string;
}

/** A fully-validated, ready-to-exec invocation. Produced ONLY by the registry;
 *  there is no other constructor. */
export interface Invocation {
  capability: Capability;
  binary: string;
  args: string[];
}

/**
 * Every agent implements this contract. A TypeScript agent (e.g. one running in
 * the v86 front-end) would satisfy the same shape as the Go agents.
 */
export interface Agent {
  name(): string;
  stage(): Stage;
  run(ctx: AgentContext): Promise<void>;
}

export interface AgentContext {
  scope: ScopeConfig;
  approved: string[];
  /** Build a validated invocation; throws if the capability/flag is not
   *  registered or a value contains shell metacharacters. */
  buildInvocation(cap: Capability, args: Array<[string, string]>): Invocation;
  /** Run a validated invocation. Never accepts a raw command string. */
  run(inv: Invocation): Promise<ToolResult>;
  /** Read/write artifacts confined to the workspace. */
  readArtifact(name: string): Promise<Uint8Array>;
  writeArtifact(name: string, data: Uint8Array): Promise<void>;
  audit(action: string, target: string, details?: Record<string, string>): void;
}

export interface ToolResult {
  capability: Capability;
  stdout: Uint8Array;
  stderr: Uint8Array;
  exit_code: number;
  duration_ms: number;
}

/** Report-narrative provider. The LLM is confined to this seam: it receives a
 *  finished, validated Report and returns prose. It is never given tool
 *  execution. */
export interface LLMProvider {
  summarize(report: Report): Promise<string>;
}

// ---------------------------------------------------------------------------
// Top-level scan configuration (configs/*.json)
// ---------------------------------------------------------------------------

export interface LLMConfig {
  provider: "none" | "vmllm" | "command" | "local" | "openai" | "anthropic";
  model: string;
  base_url: string;
  /** Env var name holding the API key — the key itself is never stored. */
  api_key_env: string;
  /** CLI invoked for the "vmllm"/"command" providers (default "vmllm"). It
   *  bridges the report prompt (stdin) to a local model — e.g. herdr's vmllm,
   *  which reaches the browser's WebGPU model from inside the v86 guest. */
  command?: string;
  /** Caps the generated executive summary length (default 320). */
  max_tokens?: number;
}

/** Self-hosted out-of-band interaction (interactsh) server configuration. */
export interface OASTConfig {
  /** interactsh base URL, e.g. https://oast.fapstaff.com. Passed to nuclei
   *  (-interactsh-server) and interactsh-client (-server). Empty = OAST off. */
  server: string;
  /** Env var name holding the interactsh auth token — never stored in config. */
  token_env: string;
}

/** Fingerprint backend selection. */
export interface FingerprintConfig {
  /** httpx (default, full Wappalyzer tech DB) | native (built-in prober, no
   *  external tool; header/cookie/body tech detection). */
  backend?: "httpx" | "native";
}

/** Crawl backend selection: the crawl capability has interchangeable backends. */
export interface CrawlConfig {
  /** katana (default, richest) | hakrawler (~11MB) | gospider (~13MB) | native
   *  (built-in BFS crawler, no external tool). */
  backend?: "katana" | "hakrawler" | "gospider" | "native";
}

/** Content-discovery backend selection. */
export interface ContentConfig {
  /** ffuf (default) | native (built-in wordlist brute-forcer, no external tool). */
  backend?: "ffuf" | "native";
}

/** Parameter-discovery backend selection. */
export interface ParamConfig {
  /** ffuf (default) | native (built-in query fuzzing, no external tool). */
  backend?: "ffuf" | "native";
}

/** Vulnerability-scan backend selection. */
export interface ScanBackendConfig {
  /** nuclei (default, broad coverage, ~150MB + templates) | native (built-in
   *  curated checks in the vaptr binary, no external tool/templates). */
  backend?: "nuclei" | "native";
}

export interface ScanConfig {
  target: string;
  targets: string[];
  workspace: string;
  scope: ScopeConfig;
  llm: LLMConfig;
  oast?: OASTConfig;
  fingerprint?: FingerprintConfig;
  crawl?: CrawlConfig;
  content?: ContentConfig;
  params?: ParamConfig;
  scan?: ScanBackendConfig;
}
