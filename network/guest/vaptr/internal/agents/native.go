package agents

import (
	"context"
	"crypto/sha1"
	"crypto/tls"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// The "native" scan backend: a curated set of high-signal vulnerability checks
// implemented directly in Go, so the scan stage needs no external tool and no
// template corpus (nuclei is ~150MB + ~250MB of templates; this is built into
// the vaptr binary). It trades breadth for footprint — it catches the common,
// low-false-positive cases, not nuclei's 10k-template coverage.
//
// It is an IN-PROCESS backend: it makes its own HTTP requests, but only against
// scope-approved targets and at the operator's rate limit, so it stays inside
// the framework's trust boundary (deterministic controller code, never the LLM).

// nativeCheck is one path-based probe. match reports whether the response is a
// finding and returns the supporting evidence.
type nativeCheck struct {
	name        string
	path        string
	severity    model.Severity
	tag         string
	title       string
	remediation string
	references  []string
	match       func(status int, body string) (bool, string)
}

var nativeChecks = []nativeCheck{
	{
		name: "git-config-exposure", path: "/.git/config", severity: model.SeverityMedium, tag: "exposure",
		title:       "Exposed .git/config (source repository leak)",
		remediation: "Block web access to the .git directory; deploy from a build artifact, not a working tree.",
		references:  []string{"https://owasp.org/www-community/vulnerabilities/Information_exposure_through_source_code_repository"},
		match: func(status int, body string) (bool, string) {
			return status == 200 && strings.Contains(body, "[core]"), firstLine(body)
		},
	},
	{
		name: "git-head-exposure", path: "/.git/HEAD", severity: model.SeverityMedium, tag: "exposure",
		title:       "Exposed .git/HEAD (source repository leak)",
		remediation: "Block web access to the .git directory.",
		match: func(status int, body string) (bool, string) {
			return status == 200 && strings.HasPrefix(strings.TrimSpace(body), "ref:"), strings.TrimSpace(firstLine(body))
		},
	},
	{
		name: "env-exposure", path: "/.env", severity: model.SeverityHigh, tag: "exposure",
		title:       "Exposed .env file (secrets leak)",
		remediation: "Never serve .env from the web root; move secrets out of the document root and rotate any exposed values.",
		references:  []string{"https://owasp.org/www-project-web-security-testing-guide/"},
		match: func(status int, body string) (bool, string) {
			if status != 200 || strings.Contains(strings.ToLower(body), "<html") {
				return false, ""
			}
			return looksLikeEnv(body), firstLine(body)
		},
	},
	{
		name: "phpinfo-exposure", path: "/phpinfo.php", severity: model.SeverityMedium, tag: "exposure",
		title:       "Exposed phpinfo() (environment disclosure)",
		remediation: "Remove phpinfo() pages from production.",
		match: func(status int, body string) (bool, string) {
			return status == 200 && strings.Contains(body, "phpinfo()"), "phpinfo() output present"
		},
	},
	{
		name: "directory-listing", path: "/", severity: model.SeverityLow, tag: "misconfig",
		title:       "Directory listing enabled",
		remediation: "Disable automatic directory indexing (e.g. autoindex off / Options -Indexes).",
		match: func(status int, body string) (bool, string) {
			return strings.Contains(body, "Index of /"), "response contains an autoindex listing"
		},
	},
}

// securityHeaders are the headers whose ABSENCE the native scan reports.
var securityHeaders = []string{
	"Content-Security-Policy",
	"X-Frame-Options",
	"X-Content-Type-Options",
	"Strict-Transport-Security",
}

// runNativeScan executes the curated checks against every approved target and
// writes findings.jsonl. now is injectable for deterministic tests.
func runNativeScan(ctx context.Context, ac *Context, now func() time.Time) error {
	client := nativeClient()
	delay := rateDelay(ac.Scope.RateLimit)

	findings := []model.Finding{}
	for _, target := range ac.Approved {
		base := strings.TrimRight(ensureScheme(target), "/")
		if base == "" {
			continue
		}
		findings = append(findings, nativeScanTarget(ctx, client, base, delay, now)...)
	}

	var out []byte
	for _, f := range findings {
		out = appendJSONL(out, f)
	}
	return ac.WS.WriteFile(workspace.FileFindings, out)
}

// nativeScanTarget runs the header check + every path check against one base URL.
func nativeScanTarget(ctx context.Context, client *http.Client, base string, delay time.Duration, now func() time.Time) []model.Finding {
	var out []model.Finding

	// Missing-security-headers check on the base URL.
	if status, hdr, _, err := nativeGet(ctx, client, base); err == nil && status > 0 {
		if missing := missingHeaders(hdr); len(missing) >= 2 {
			out = append(out, nativeFinding("missing-security-headers", base,
				"Missing security headers", model.SeverityInfo, "misconfig",
				"Absent: "+strings.Join(missing, ", "),
				"Set the missing response headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS).",
				nil, now))
		}
	}
	sleep(ctx, delay)

	// Path-based checks.
	for _, c := range nativeChecks {
		select {
		case <-ctx.Done():
			return out
		default:
		}
		url := base + c.path
		status, _, body, err := nativeGet(ctx, client, url)
		if err != nil {
			continue
		}
		if matched, evidence := c.match(status, body); matched {
			out = append(out, nativeFinding(c.name, url, c.title, c.severity, c.tag,
				evidence, c.remediation, c.references, now))
		}
		sleep(ctx, delay)
	}
	return out
}

// nativeClient is the shared HTTP client for the native backends: it follows
// redirects, skips TLS verification (pentest targets often use self-signed
// certs), and bounds each request's time.
func nativeClient() *http.Client {
	return &http.Client{
		Timeout:   15 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
	}
}

// nativeGet performs a bounded GET (body capped at 128KB) with context.
func nativeGet(ctx context.Context, client *http.Client, url string) (int, http.Header, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, "", err
	}
	req.Header.Set("User-Agent", "vmvapt-native/0.1")
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 128*1024))
	return resp.StatusCode, resp.Header, string(body), nil
}

func nativeFinding(name, url, title string, sev model.Severity, tag, evidence, remediation string, refs []string, now func() time.Time) model.Finding {
	h := sha1.Sum([]byte("native-" + name + "|" + url))
	return model.Finding{
		ID:           hex.EncodeToString(h[:8]),
		TemplateID:   "native-" + name,
		Title:        title,
		Severity:     sev,
		Confidence:   model.ConfCandidate,
		AffectedURL:  url,
		Evidence:     evidence,
		Reproduction: "Send: GET " + url,
		Remediation:  remediation,
		References:   refs,
		Tags:         []string{tag, "native"},
		FirstSeen:    now().UTC(),
	}
}

func missingHeaders(h http.Header) []string {
	var missing []string
	for _, name := range securityHeaders {
		if h.Get(name) == "" {
			missing = append(missing, name)
		}
	}
	return missing
}

// looksLikeEnv heuristically detects a dotenv file: at least two KEY=value lines
// with uppercase keys.
func looksLikeEnv(body string) bool {
	n := 0
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		eq := strings.IndexByte(line, '=')
		if eq <= 0 {
			continue
		}
		key := line[:eq]
		if key == strings.ToUpper(key) && !strings.ContainsAny(key, " <>\"") {
			n++
		}
	}
	return n >= 2
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return strings.TrimSpace(s)
}

// rateDelay converts a requests-per-second limit into an inter-request delay.
func rateDelay(ratePerSec int) time.Duration {
	if ratePerSec <= 0 {
		return 0
	}
	return time.Second / time.Duration(ratePerSec)
}

func sleep(ctx context.Context, d time.Duration) {
	if d <= 0 {
		return
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}
