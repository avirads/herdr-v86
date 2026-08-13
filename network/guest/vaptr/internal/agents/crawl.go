package agents

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// Crawl is Agent 3. It crawls the approved targets and classifies each
// discovered endpoint (page/form/js/api/swagger/graphql) into the crawl
// artifact. The crawl backend is selectable — katana (default, richest),
// hakrawler (~11MB, stdin), or gospider (~13MB, per-target) — all writing the
// same model.CrawlItem stream regardless of tool.
type Crawl struct{}

func (Crawl) Name() string       { return "crawl" }
func (Crawl) Stage() model.Stage { return model.StageCrawl }

func (a Crawl) Run(ctx context.Context, ac *Context) error {
	switch ac.CrawlBackend {
	case "native":
		return runNativeCrawl(ctx, ac)
	case "hakrawler":
		// hakrawler reads target URLs from stdin; -s emits the source tag.
		args := [][2]string{{"-json", ""}, {"-s", ""}, {"-d", "2"}}
		args = append(args, rateArgs(ac.Scope, "", "-t")...)
		return a.runStdin(ctx, ac, "hakrawler", args, parseHakrawler)
	case "gospider":
		return a.runGospider(ctx, ac)
	default: // "" or "katana"
		args := [][2]string{{"-jsonl", ""}, {"-jc", ""}, {"-silent", ""}}
		args = append(args, rateArgs(ac.Scope, "-rate-limit", "-c")...)
		return a.runStdin(ctx, ac, "katana", args, parseKatana)
	}
}

// runStdin handles the stdin-fed backends (katana, hakrawler): feed the
// approved target list on stdin, run, and parse with the backend's parser.
func (a Crawl) runStdin(ctx context.Context, ac *Context, backend string, args [][2]string, parse func([]byte) []model.CrawlItem) error {
	inv, err := ac.Registry.BuildBackend(ctx, registry.CapCrawl, backend, args)
	if err != nil {
		return fmt.Errorf("crawl: build: %w", err)
	}
	inv.Stdin = targetStdin(ac)
	logInvoke(ac, a.Name(), inv)

	res, err := ac.Runner.Run(ctx, inv)
	if errors.Is(err, runner.ErrToolMissing) {
		return writeEmpty(ac.WS, workspace.FileKatana)
	}
	if err != nil {
		return fmt.Errorf("crawl: run: %w", err)
	}
	var out []byte
	for _, item := range parse(res.Stdout) {
		out = appendJSONL(out, item)
	}
	return ac.WS.WriteFile(workspace.FileKatana, out)
}

// runGospider handles gospider, which takes a single site via -s (not stdin),
// so it is looped per approved target and deduplicated.
func (a Crawl) runGospider(ctx context.Context, ac *Context) error {
	seen := map[string]bool{}
	var out []byte
	for _, target := range ac.Approved {
		base := ensureScheme(target)
		if base == "" {
			continue
		}
		args := [][2]string{{"-s", base}, {"--json", ""}, {"-d", "2"}, {"-q", ""}}
		args = append(args, rateArgs(ac.Scope, "", "-c")...)
		inv, err := ac.Registry.BuildBackend(ctx, registry.CapCrawl, "gospider", args)
		if err != nil {
			return fmt.Errorf("crawl: build: %w", err)
		}
		logInvoke(ac, a.Name(), inv)
		res, rerr := ac.Runner.Run(ctx, inv)
		if errors.Is(rerr, runner.ErrToolMissing) {
			return writeEmpty(ac.WS, workspace.FileKatana)
		}
		if rerr != nil {
			return fmt.Errorf("crawl: run: %w", rerr)
		}
		for _, item := range parseGospider(res.Stdout) {
			if item.URL == "" || seen[item.URL] {
				continue
			}
			seen[item.URL] = true
			out = appendJSONL(out, item)
		}
	}
	return ac.WS.WriteFile(workspace.FileKatana, out)
}

// --- backend output parsers (each validated against testdata/*.real.jsonl) ---

// katanaLine matches katana -jsonl output.
type katanaLine struct {
	Request struct {
		Method   string `json:"method"`
		Endpoint string `json:"endpoint"`
		Tag      string `json:"tag"`
		Source   string `json:"source"`
	} `json:"request"`
}

func parseKatana(data []byte) []model.CrawlItem {
	var out []model.CrawlItem
	eachJSONLine(data, func(l katanaLine) {
		out = append(out, model.CrawlItem{
			URL:    l.Request.Endpoint,
			Method: l.Request.Method,
			Kind:   classifyEndpoint(l.Request.Endpoint, l.Request.Tag),
			Source: l.Request.Source,
		})
	})
	return out
}

// hakrawlerLine matches hakrawler -json -s output ({Source, URL, Where}).
type hakrawlerLine struct {
	Source string `json:"Source"`
	URL    string `json:"URL"`
}

func parseHakrawler(data []byte) []model.CrawlItem {
	var out []model.CrawlItem
	eachJSONLine(data, func(l hakrawlerLine) {
		if l.URL == "" {
			return
		}
		out = append(out, model.CrawlItem{
			URL: l.URL, Method: "GET", Kind: classifyEndpoint(l.URL, l.Source), Source: l.Source,
		})
	})
	return out
}

// gospiderLine matches gospider --json output ({type, output, source, ...}).
type gospiderLine struct {
	Type   string `json:"type"`
	Output string `json:"output"`
	Source string `json:"source"`
}

func parseGospider(data []byte) []model.CrawlItem {
	var out []model.CrawlItem
	eachJSONLine(data, func(l gospiderLine) {
		if !strings.HasPrefix(l.Output, "http") {
			return // skip non-URL findings (aws keys, etc.)
		}
		out = append(out, model.CrawlItem{
			URL: l.Output, Method: "GET", Kind: classifyEndpoint(l.Output, l.Type), Source: l.Source,
		})
	})
	return out
}

// classifyEndpoint buckets a URL into the crawl kinds the spec calls out. The
// tag is the backend's own source/type label (katana tag, hakrawler Source,
// gospider type) and is used as a fallback signal for forms and scripts.
func classifyEndpoint(u, tag string) string {
	lu := strings.ToLower(u)
	switch {
	case strings.Contains(lu, "graphql"):
		return "graphql"
	case strings.Contains(lu, "swagger") || strings.Contains(lu, "openapi") || strings.HasSuffix(lu, "openapi.json"):
		return "swagger"
	case strings.HasSuffix(lu, ".js") || strings.Contains(lu, ".js?"):
		return "js"
	case strings.EqualFold(tag, "script") || strings.EqualFold(tag, "javascript"):
		return "js"
	case strings.Contains(lu, "/api/") || strings.Contains(lu, "/v1/") || strings.Contains(lu, "/v2/"):
		return "api"
	case strings.EqualFold(tag, "form"):
		return "form"
	default:
		return "page"
	}
}
