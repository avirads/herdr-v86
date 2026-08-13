package agents

import (
	"context"
	"net/url"
	"regexp"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// The "native" crawl backend: a small in-process BFS crawler (stdlib only, no
// x/net/html dependency — link extraction is regex-based, as lightweight
// crawlers do). It stays on the target host, is depth- and count-bounded, and
// produces the same model.CrawlItem stream as katana/hakrawler/gospider.

const (
	nativeCrawlMaxDepth = 2
	nativeCrawlMaxURLs  = 200
)

var (
	reHref   = regexp.MustCompile(`(?i)href\s*=\s*["']?([^"'\s>]+)`)
	reScript = regexp.MustCompile(`(?i)<script[^>]+src\s*=\s*["']?([^"'\s>]+)`)
	reForm   = regexp.MustCompile(`(?i)<form[^>]+action\s*=\s*["']?([^"'\s>]+)`)
)

// runNativeCrawl crawls the approved hosts and writes the crawl artifact.
func runNativeCrawl(ctx context.Context, ac *Context) error {
	client := nativeClient()
	delay := rateDelay(ac.Scope.RateLimit)

	hosts := map[string]bool{}
	type qitem struct {
		url   string
		depth int
	}
	var queue []qitem
	queued := map[string]bool{}
	enqueue := func(u string, d int) {
		if queued[u] || len(queued) >= nativeCrawlMaxURLs {
			return
		}
		queued[u] = true
		queue = append(queue, qitem{u, d})
	}
	for _, t := range ac.Approved {
		base := ensureScheme(t)
		if u, err := url.Parse(base); err == nil && u.Host != "" {
			hosts[u.Host] = true
			enqueue(base, 0)
		}
	}

	resultSeen := map[string]bool{}
	var items []model.CrawlItem
	record := func(u, tag string) {
		if u == "" || resultSeen[u] {
			return
		}
		resultSeen[u] = true
		items = append(items, model.CrawlItem{URL: u, Method: "GET", Kind: classifyEndpoint(u, tag), Source: "native"})
	}

	for len(queue) > 0 {
		select {
		case <-ctx.Done():
			return writeCrawl(ac, items)
		default:
		}
		cur := queue[0]
		queue = queue[1:]

		status, hdr, body, err := nativeGet(ctx, client, cur.url)
		if err != nil || status == 0 {
			continue
		}
		record(cur.url, "")
		sleep(ctx, delay)
		if cur.depth >= nativeCrawlMaxDepth || !strings.Contains(strings.ToLower(hdr.Get("Content-Type")), "html") {
			continue
		}
		base, err := url.Parse(cur.url)
		if err != nil {
			continue
		}
		for _, m := range reScript.FindAllStringSubmatch(body, -1) {
			if abs := resolveRef(base, m[1]); abs != "" && hosts[hostOf(abs)] {
				record(abs, "script")
			}
		}
		for _, m := range reForm.FindAllStringSubmatch(body, -1) {
			if abs := resolveRef(base, m[1]); abs != "" && hosts[hostOf(abs)] {
				record(abs, "form")
			}
		}
		for _, m := range reHref.FindAllStringSubmatch(body, -1) {
			abs := resolveRef(base, m[1])
			if abs == "" || !hosts[hostOf(abs)] {
				continue
			}
			record(abs, "href")
			enqueue(stripFragment(abs), cur.depth+1)
		}
	}
	return writeCrawl(ac, items)
}

func writeCrawl(ac *Context, items []model.CrawlItem) error {
	var out []byte
	for _, it := range items {
		out = appendJSONL(out, it)
	}
	return ac.WS.WriteFile(workspace.FileKatana, out)
}

// resolveRef resolves a possibly-relative href against the page URL, dropping
// non-HTTP schemes (mailto:, javascript:, tel:, #fragments).
func resolveRef(base *url.URL, ref string) string {
	ref = strings.TrimSpace(ref)
	if ref == "" || strings.HasPrefix(ref, "#") {
		return ""
	}
	low := strings.ToLower(ref)
	for _, bad := range []string{"mailto:", "javascript:", "tel:", "data:"} {
		if strings.HasPrefix(low, bad) {
			return ""
		}
	}
	u, err := url.Parse(ref)
	if err != nil {
		return ""
	}
	abs := base.ResolveReference(u)
	if abs.Scheme != "http" && abs.Scheme != "https" {
		return ""
	}
	abs.Fragment = ""
	return abs.String()
}

func hostOf(rawurl string) string {
	if u, err := url.Parse(rawurl); err == nil {
		return u.Host
	}
	return ""
}

func stripFragment(rawurl string) string {
	if i := strings.IndexByte(rawurl, '#'); i >= 0 {
		return rawurl[:i]
	}
	return rawurl
}
