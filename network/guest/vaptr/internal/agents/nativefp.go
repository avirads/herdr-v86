package agents

import (
	"context"
	"crypto/tls"
	"html"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// The "native" fingerprint backend: an in-process HTTP prober that produces the
// same model.Fingerprint fields the pipeline consumes (status, title, server,
// technologies, TLS, redirects) without httpx (~62MB, mostly an embedded
// Wappalyzer DB). Tech detection is a small header/cookie/body ruleset — far
// less exhaustive than httpx's, but enough for the fingerprint the vuln stage's
// template selection needs, at ~0 added footprint.

// runNativeFingerprint probes every approved target and writes httpx.jsonl.
func runNativeFingerprint(ctx context.Context, ac *Context) error {
	delay := rateDelay(ac.Scope.RateLimit)
	var out []byte
	for _, target := range ac.Approved {
		url := ensureScheme(target)
		if url == "" {
			continue
		}
		if fp, ok := probeOne(ctx, url); ok {
			fp.Input = target
			out = appendJSONL(out, fp)
		}
		sleep(ctx, delay)
	}
	return ac.WS.WriteFile(workspace.FileHTTPX, out)
}

// probeOne performs one probe, following redirects and recording the chain.
func probeOne(ctx context.Context, url string) (model.Fingerprint, bool) {
	var chain []string
	client := &http.Client{
		Timeout:   15 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			chain = append(chain, req.URL.String())
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return model.Fingerprint{}, false
	}
	req.Header.Set("User-Agent", "vmvapt-native/0.1")
	resp, err := client.Do(req)
	if err != nil {
		return model.Fingerprint{}, false
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	bodyStr := string(body)

	fp := model.Fingerprint{
		URL:          resp.Request.URL.String(),
		StatusCode:   resp.StatusCode,
		Title:        extractTitle(bodyStr),
		Server:       resp.Header.Get("Server"),
		ContentType:  resp.Header.Get("Content-Type"),
		Technologies: detectTech(resp, bodyStr),
		Redirects:    chain,
	}
	if resp.TLS != nil {
		fp.TLS = tlsInfo(resp.TLS)
	}
	return fp, true
}

func tlsInfo(cs *tls.ConnectionState) *model.TLSInfo {
	info := &model.TLSInfo{Version: tlsVersionName(cs.Version)}
	if len(cs.PeerCertificates) > 0 {
		leaf := cs.PeerCertificates[0]
		info.SubjectCN = leaf.Subject.CommonName
		info.Issuer = leaf.Issuer.CommonName
		info.NotBefore = leaf.NotBefore.UTC()
		info.NotAfter = leaf.NotAfter.UTC()
		if info.Host == "" && len(leaf.DNSNames) > 0 {
			info.Host = leaf.DNSNames[0]
		}
	}
	return info
}

func tlsVersionName(v uint16) string {
	switch v {
	case tls.VersionTLS13:
		return "tls13"
	case tls.VersionTLS12:
		return "tls12"
	case tls.VersionTLS11:
		return "tls11"
	case tls.VersionTLS10:
		return "tls10"
	default:
		return "unknown"
	}
}

// extractTitle pulls the <title> text from an HTML body.
func extractTitle(body string) string {
	lb := strings.ToLower(body)
	i := strings.Index(lb, "<title")
	if i < 0 {
		return ""
	}
	gt := strings.IndexByte(body[i:], '>')
	if gt < 0 {
		return ""
	}
	start := i + gt + 1
	end := strings.Index(strings.ToLower(body[start:]), "</title>")
	if end < 0 {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(body[start : start+end]))
}

// detectTech applies a small header/cookie/body ruleset to infer technologies.
func detectTech(resp *http.Response, body string) []string {
	set := map[string]bool{}
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s != "" {
			set[s] = true
		}
	}
	h := resp.Header
	if xp := h.Get("X-Powered-By"); xp != "" {
		add(xp)
	}
	if srv := h.Get("Server"); srv != "" {
		add(beforeSlash(srv))
	}
	if h.Get("X-AspNet-Version") != "" {
		add("ASP.NET")
	}
	if h.Get("X-Generator") != "" {
		add(h.Get("X-Generator"))
	}
	for _, c := range resp.Cookies() {
		switch {
		case c.Name == "PHPSESSID":
			add("PHP")
		case c.Name == "JSESSIONID":
			add("Java")
		case c.Name == "connect.sid":
			add("Node.js")
		case strings.HasPrefix(c.Name, "laravel"):
			add("Laravel")
		case c.Name == "ASP.NET_SessionId":
			add("ASP.NET")
		}
	}
	lb := strings.ToLower(body)
	for marker, tech := range map[string]string{
		"wp-content": "WordPress", "wp-includes": "WordPress",
		"/_next/": "Next.js", "ng-version": "Angular",
		"__nuxt__": "Nuxt.js", "drupal-settings-json": "Drupal",
		"joomla": "Joomla", "content=\"shopify\"": "Shopify",
	} {
		if strings.Contains(lb, marker) {
			add(tech)
		}
	}
	if g := metaGenerator(body); g != "" {
		add(g)
	}
	out := make([]string, 0, len(set))
	for s := range set {
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

func metaGenerator(body string) string {
	lb := strings.ToLower(body)
	i := strings.Index(lb, `name="generator"`)
	if i < 0 {
		return ""
	}
	seg := body[i:]
	c := strings.Index(strings.ToLower(seg), `content="`)
	if c < 0 {
		return ""
	}
	seg = seg[c+len(`content="`):]
	if end := strings.IndexByte(seg, '"'); end >= 0 {
		return strings.TrimSpace(seg[:end])
	}
	return ""
}

func beforeSlash(s string) string {
	if i := strings.IndexByte(s, '/'); i > 0 {
		return s[:i]
	}
	return s
}
