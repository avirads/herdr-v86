package agents

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// URLDiscovery is Agent 4. It merges crawl output (katana) with passive sources
// (urlfinder aggregating gau/waybackurls), then normalizes and deduplicates
// into urls.json.
type URLDiscovery struct{}

func (URLDiscovery) Name() string       { return "url_discovery" }
func (URLDiscovery) Stage() model.Stage { return model.StageURLs }

type urlfinderLine struct {
	URL    string `json:"url"`
	Source string `json:"source"`
}

func (a URLDiscovery) Run(ctx context.Context, ac *Context) error {
	// merged maps a normalized URL key to its record (accumulating sources).
	merged := map[string]*model.URLRecord{}

	// 1) Katana results already on disk.
	katana, _ := ac.WS.ReadFile(workspace.FileKatana)
	eachJSONLine(katana, func(it model.CrawlItem) {
		addURL(merged, it.URL, "katana")
	})

	// 2) Passive discovery via the urlfinder capability.
	args := [][2]string{{"-json", ""}, {"-silent", ""}}
	args = append(args, rateArgs(ac.Scope, "-rate-limit", "")...)
	inv, err := ac.Registry.Build(ctx, registry.CapURLDiscover, args)
	if err != nil {
		return fmt.Errorf("url_discovery: build: %w", err)
	}
	inv.Stdin = targetStdin(ac) // feed approved hosts to urlfinder via stdin
	logInvoke(ac, a.Name(), inv)
	if res, rerr := ac.Runner.Run(ctx, inv); rerr == nil {
		eachJSONLine(res.Stdout, func(l urlfinderLine) {
			src := l.Source
			if src == "" {
				src = "urlfinder"
			}
			addURL(merged, l.URL, src)
		})
	} else if !errors.Is(rerr, runner.ErrToolMissing) {
		return fmt.Errorf("url_discovery: run: %w", rerr)
	}

	// Emit a stable, sorted slice.
	out := make([]model.URLRecord, 0, len(merged))
	for _, r := range merged {
		sort.Strings(r.Sources)
		out = append(out, *r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].URL < out[j].URL })
	return ac.WS.WriteJSON(workspace.FileURLs, out)
}

// addURL normalizes u and merges it into the map, unioning sources.
func addURL(m map[string]*model.URLRecord, raw, source string) {
	norm, host, path, params := normalizeURL(raw)
	if norm == "" {
		return
	}
	if rec, ok := m[norm]; ok {
		rec.Sources = appendUnique(rec.Sources, source)
		return
	}
	m[norm] = &model.URLRecord{URL: norm, Host: host, Path: path, Params: params, Sources: []string{source}}
}

// normalizeURL lowercases the host, drops fragments, and sorts query keys so
// that ?a=1&b=2 and ?b=2&a=1 collapse to one record.
func normalizeURL(raw string) (norm, host, path string, params []string) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return "", "", "", nil
	}
	u.Host = strings.ToLower(u.Host)
	u.Fragment = ""
	q := u.Query()
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	rebuilt := url.Values{}
	for _, k := range keys {
		rebuilt[k] = q[k]
	}
	u.RawQuery = rebuilt.Encode()
	return u.String(), u.Host, u.Path, keys
}

func appendUnique(s []string, v string) []string {
	for _, x := range s {
		if x == v {
			return s
		}
	}
	return append(s, v)
}
