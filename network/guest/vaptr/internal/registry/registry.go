// Package registry implements the Tool Registry — the only path through which
// any external program may run. The LLM (and every agent) can name a
// *capability* ("fingerprint", "scan"); it can never name a binary, a flag, or
// a shell string. The registry maps a capability to a vetted binary, validates
// arguments against a per-tool allowlist, and refuses anything else.
//
// A capability may have several interchangeable *backends* (e.g. crawl →
// katana | hakrawler | gospider). Each backend is an independently-vetted
// (binary, allowed-args) pair; the operator selects one via config, and the LLM
// still only ever names the capability. The first backend registered for a
// capability is its default.
//
// Security invariants enforced here:
//   - no shell interpretation: programs are exec'd directly, never via sh -c
//   - argument keys must be in the tool's AllowedArgs set
//   - argument values are checked for shell/format metacharacters
//   - output paths are constrained to the workspace by the caller (Runner)
package registry

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// Capability is a stable, LLM-facing verb. Agents request capabilities, not
// binaries.
type Capability string

const (
	CapFingerprint     Capability = "fingerprint"
	CapCrawl           Capability = "crawl"
	CapURLDiscover     Capability = "url_discover"
	CapParamDiscover   Capability = "param_discover"
	CapContentDiscover Capability = "content_discover"
	CapScan            Capability = "scan"
	CapOAST            Capability = "oast"
)

// Tool is a registered, vetted external program (one backend of a capability).
type Tool struct {
	Capability Capability
	// Backend names this implementation of the capability (e.g. "katana"). For
	// single-backend capabilities it defaults to the binary name.
	Backend     string
	Binary      string // resolved from PATH by the Runner; never user-supplied
	Description string
	// AllowedArgs is the set of flag keys this tool may receive. Any key not
	// present here is rejected before exec.
	AllowedArgs map[string]bool
	// License is recorded for compliance (all defaults are MIT/Apache-2.0).
	License string
	// InProcess marks a backend implemented in Go inside vaptr (no external
	// binary, e.g. the "native" scan checks). It is never exec'd, so BuildBackend
	// refuses to build an Invocation for it; the agent runs it directly.
	InProcess bool
}

// Invocation is a fully-formed, validated request to run a tool. It is produced
// only by Registry.Build/BuildBackend and consumed only by a Runner.
type Invocation struct {
	Capability Capability
	Backend    string
	Binary     string
	Args       []string
	// Stdin is data piped to the tool's standard input — used to feed the
	// scope-approved target list to tools that read targets from stdin
	// (httpx, katana, hakrawler, nuclei, urlfinder). It carries only
	// scope-approved data; it is never a command and is never shell-interpreted.
	Stdin []byte
	// Dir is the working directory for the process. Agents set it to the
	// workspace root so file-based tools (e.g. ffuf) can be given plain
	// relative filenames (e.g. "-w wordlist.txt") — which pass the arg-safety
	// check because they contain no path separators — while still reading and
	// writing only inside the workspace jail.
	Dir string
}

// Registry holds the immutable set of allowed tools, keyed by capability then
// backend.
type Registry struct {
	tools    map[Capability]map[string]Tool
	defaults map[Capability]string
	order    map[Capability][]string // backend registration order (stable listing)
}

// Default returns the registry described in the framework spec. Binaries are
// referenced by name; the Runner resolves them from PATH at execution time.
func Default() *Registry {
	r := &Registry{
		tools:    map[Capability]map[string]Tool{},
		defaults: map[Capability]string{},
		order:    map[Capability][]string{},
	}
	// fingerprint — selectable backends (first = default).
	r.mustRegister(Tool{
		Capability: CapFingerprint, Backend: "httpx", Binary: "httpx", License: "MIT",
		Description: "HTTP probe (default): status, title, tech, TLS",
		AllowedArgs: set("-l", "-json", "-o", "-rate-limit", "-threads", "-td", "-tls-grab", "-title", "-status-code", "-server", "-follow-redirects", "-silent"),
	})
	r.mustRegister(Tool{
		Capability: CapFingerprint, Backend: "native", InProcess: true, License: "MIT",
		Description: "Built-in HTTP prober (no external tool; header/cookie/body tech detection)",
	})

	// crawl — selectable backends (first = default).
	r.mustRegister(Tool{
		Capability: CapCrawl, Backend: "katana", Binary: "katana", License: "MIT",
		Description: "Crawler (default): pages, forms, JS, API/OpenAPI/GraphQL",
		AllowedArgs: set("-list", "-u", "-jsonl", "-o", "-rate-limit", "-c", "-depth", "-jc", "-field", "-silent"),
	})
	r.mustRegister(Tool{
		Capability: CapCrawl, Backend: "hakrawler", Binary: "hakrawler", License: "MIT",
		Description: "Crawler (lightweight, ~11MB): links/JS/forms from stdin",
		AllowedArgs: set("-json", "-s", "-d", "-t", "-u", "-subs", "-insecure", "-timeout", "-size", "-dr"),
	})
	r.mustRegister(Tool{
		Capability: CapCrawl, Backend: "gospider", Binary: "gospider", License: "MIT",
		Description: "Crawler (lightweight, ~13MB): -s <url>, robots/sitemap/JS",
		AllowedArgs: set("-s", "--json", "-d", "-c", "-t", "-q", "-k", "-m", "--sitemap", "--robots", "-a", "-o"),
	})
	r.mustRegister(Tool{
		Capability: CapCrawl, Backend: "native", InProcess: true, License: "MIT",
		Description: "Built-in BFS crawler (no external tool; regex link extraction)",
	})

	r.mustRegister(Tool{
		Capability: CapURLDiscover, Binary: "urlfinder", License: "MIT",
		Description: "Passive URL discovery (urlfinder/gau/wayback aggregation)",
		AllowedArgs: set("-d", "-list", "-o", "-json", "-silent", "-rate-limit"),
	})
	r.mustRegister(Tool{
		Capability: CapParamDiscover, Backend: "ffuf", Binary: "ffuf", License: "MIT",
		Description: "HTTP parameter discovery via ffuf query/body fuzzing (GET/POST)",
		AllowedArgs: set("-u", "-w", "-o", "-of", "-mc", "-fc", "-fs", "-ac", "-mr", "-X", "-d", "-t", "-rate", "-s"),
	})
	r.mustRegister(Tool{
		Capability: CapParamDiscover, Backend: "native", InProcess: true, License: "MIT",
		Description: "Built-in parameter discovery (query fuzzing, no external tool)",
	})
	r.mustRegister(Tool{
		Capability: CapContentDiscover, Backend: "ffuf", Binary: "ffuf", License: "MIT",
		Description: "Content/dir discovery",
		AllowedArgs: set("-u", "-w", "-o", "-of", "-mc", "-fc", "-t", "-rate", "-recursion", "-s"),
	})
	r.mustRegister(Tool{
		Capability: CapContentDiscover, Backend: "native", InProcess: true, License: "MIT",
		Description: "Built-in content/dir discovery (embedded wordlist, no external tool)",
	})
	// scan — selectable backends (first = default).
	r.mustRegister(Tool{
		Capability: CapScan, Backend: "nuclei", Binary: "nuclei", License: "MIT",
		Description: "Template-based vulnerability scanner (default; broad coverage)",
		AllowedArgs: set("-l", "-jsonl", "-o", "-rate-limit", "-c", "-t", "-tags", "-severity", "-etags", "-interactsh-server", "-interactsh-token", "-silent", "-duc"),
	})
	r.mustRegister(Tool{
		Capability: CapScan, Backend: "native", InProcess: true, License: "MIT",
		Description: "Built-in curated checks (no external tool/templates; low footprint)",
	})
	r.mustRegister(Tool{
		Capability: CapOAST, Binary: "interactsh-client", License: "MIT",
		Description: "Out-of-band interaction listener",
		AllowedArgs: set("-json", "-o", "-server", "-token", "-n", "-poll-interval", "-silent"),
	})
	return r
}

func (r *Registry) mustRegister(t Tool) {
	if t.Backend == "" {
		t.Backend = t.Binary
	}
	if r.tools[t.Capability] == nil {
		r.tools[t.Capability] = map[string]Tool{}
	}
	if _, dup := r.tools[t.Capability][t.Backend]; dup {
		panic(fmt.Sprintf("duplicate backend %q for capability %q", t.Backend, t.Capability))
	}
	r.tools[t.Capability][t.Backend] = t
	if r.defaults[t.Capability] == "" {
		r.defaults[t.Capability] = t.Backend
	}
	r.order[t.Capability] = append(r.order[t.Capability], t.Backend)
}

// Lookup returns the default backend's tool for a capability.
func (r *Registry) Lookup(c Capability) (Tool, bool) {
	return r.LookupBackend(c, r.defaults[c])
}

// LookupBackend returns a specific backend's tool.
func (r *Registry) LookupBackend(c Capability, backend string) (Tool, bool) {
	backends, ok := r.tools[c]
	if !ok {
		return Tool{}, false
	}
	if backend == "" {
		backend = r.defaults[c]
	}
	t, ok := backends[backend]
	return t, ok
}

// Backends returns the registered backend names for a capability, in
// registration order (default first).
func (r *Registry) Backends(c Capability) []string {
	return append([]string(nil), r.order[c]...)
}

// Capabilities returns the sorted list of registered capabilities — the exact
// menu exposed to the LLM. It can request nothing outside this list.
func (r *Registry) Capabilities() []Capability {
	out := make([]Capability, 0, len(r.tools))
	for c := range r.tools {
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// Build validates args for a capability's default backend.
func (r *Registry) Build(ctx context.Context, c Capability, args [][2]string) (Invocation, error) {
	return r.BuildBackend(ctx, c, r.defaults[c], args)
}

// BuildBackend validates a capability+backend+args triple and returns a
// ready-to-exec Invocation. It is the choke point: the ONLY way to obtain an
// Invocation, and it rejects unknown backends, unknown flags, and dangerous
// values.
func (r *Registry) BuildBackend(_ context.Context, c Capability, backend string, args [][2]string) (Invocation, error) {
	t, ok := r.LookupBackend(c, backend)
	if !ok {
		return Invocation{}, fmt.Errorf("registry: unknown capability/backend %q/%q", c, backend)
	}
	if t.InProcess {
		return Invocation{}, fmt.Errorf("registry: backend %q/%q is in-process and cannot be exec'd", c, t.Backend)
	}
	out := Invocation{Capability: c, Backend: t.Backend, Binary: t.Binary}
	for _, kv := range args {
		flag, val := kv[0], kv[1]
		if !t.AllowedArgs[flag] {
			return Invocation{}, fmt.Errorf("registry: flag %q not allowed for %q/%q", flag, c, t.Backend)
		}
		if err := safeValue(val); err != nil {
			return Invocation{}, fmt.Errorf("registry: unsafe value for %q: %w", flag, err)
		}
		out.Args = append(out.Args, flag)
		if val != "" {
			out.Args = append(out.Args, val)
		}
	}
	return out, nil
}

// safeValue rejects values containing shell/format metacharacters. Because we
// never invoke a shell this is defense-in-depth, but it also blocks a malicious
// LLM from smuggling a second flag or a path traversal through a value.
func safeValue(v string) error {
	if v == "" {
		return nil
	}
	const bad = "`$;&|<>\n\r\"'\\"
	if strings.ContainsAny(v, bad) {
		return fmt.Errorf("contains shell metacharacter")
	}
	if strings.Contains(v, "..") {
		return fmt.Errorf("contains path traversal (..)")
	}
	return nil
}

func set(keys ...string) map[string]bool {
	m := make(map[string]bool, len(keys))
	for _, k := range keys {
		m[k] = true
	}
	return m
}
