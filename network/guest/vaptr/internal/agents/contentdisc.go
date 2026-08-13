package agents

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// ContentDiscovery is Agent 6. It runs FFUF against each approved host with a
// built-in wordlist to find admin panels, uploads, backups, configs, APIs and
// other hidden paths, then categorizes each hit into content.json.
//
// FFUF is a per-target, file-driven tool: it needs a URL with a FUZZ keyword, a
// wordlist file, and an output file. All three live inside the workspace and are
// passed as plain relative names — the runner sets the process working
// directory to the workspace root, so nothing escapes the jail.
type ContentDiscovery struct{}

func (ContentDiscovery) Name() string       { return "content_discovery" }
func (ContentDiscovery) Stage() model.Stage { return model.StageContent }

const wordlistFile = "content-wordlist.txt"

// ffufResult matches ffuf -of json output (validated against real output in
// testdata/ffuf.real.json).
type ffufResult struct {
	Results []struct {
		URL    string            `json:"url"`
		Status int               `json:"status"`
		Length int               `json:"length"`
		Words  int               `json:"words"`
		Input  map[string]string `json:"input"`
	} `json:"results"`
}

func (a ContentDiscovery) Run(ctx context.Context, ac *Context) error {
	if len(ac.Approved) == 0 {
		return ac.WS.WriteJSON(workspace.FileContent, []model.ContentRecord{})
	}
	if ac.ContentBackend == "native" {
		return runNativeContent(ctx, ac)
	}
	// Provide the built-in wordlist unless the operator already staged one.
	if _, err := ac.WS.ReadFile(wordlistFile); err != nil {
		if werr := ac.WS.WriteFile(wordlistFile, defaultWordlist); werr != nil {
			return fmt.Errorf("content_discovery: write wordlist: %w", werr)
		}
	}

	// Dedup discovered content across all hosts by URL.
	seen := map[string]bool{}
	out := []model.ContentRecord{}

	for i, target := range ac.Approved {
		base := ensureScheme(target)
		if base == "" {
			continue
		}
		outFile := "content-ffuf-" + strconv.Itoa(i) + ".json"
		args := [][2]string{
			{"-u", base + "/FUZZ"},
			{"-w", wordlistFile},
			{"-of", "json"},
			{"-o", outFile},
			{"-mc", "200,204,301,302,307,401,403"},
			{"-s", ""},
		}
		args = append(args, rateArgs(ac.Scope, "-rate", "-t")...)
		inv, err := ac.Registry.Build(ctx, registry.CapContentDiscover, args)
		if err != nil {
			return fmt.Errorf("content_discovery: build: %w", err)
		}
		inv.Dir = ac.WS.Root() // run ffuf inside the workspace jail
		logInvoke(ac, a.Name(), inv)

		_, err = ac.Runner.Run(ctx, inv)
		if errors.Is(err, runner.ErrToolMissing) {
			return ac.WS.WriteJSON(workspace.FileContent, []model.ContentRecord{})
		}
		if err != nil {
			return fmt.Errorf("content_discovery: run: %w", err)
		}

		data, rerr := ac.WS.ReadFile(outFile)
		if rerr != nil {
			continue // no hits for this host (ffuf wrote nothing)
		}
		for _, rec := range parseFFUF(data) {
			if seen[rec.URL] {
				continue
			}
			seen[rec.URL] = true
			out = append(out, rec)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].URL < out[j].URL })
	return ac.WS.WriteJSON(workspace.FileContent, out)
}

// parseFFUF converts a ffuf JSON output document into categorized content
// records. Pure function for regression testing against testdata/ffuf.real.json.
func parseFFUF(data []byte) []model.ContentRecord {
	out := []model.ContentRecord{}
	var doc ffufResult
	if len(data) == 0 || unmarshalLenient(data, &doc) != nil {
		return out
	}
	for _, r := range doc.Results {
		out = append(out, model.ContentRecord{
			URL: r.URL, Status: r.Status, Length: r.Length, Words: r.Words,
			Category: categorize(r.URL),
		})
	}
	return out
}

// categorize labels a discovered path by the sensitive-area keyword it matches.
func categorize(u string) string {
	lu := strings.ToLower(u)
	switch {
	case containsAny(lu, "admin", "administrator", "manage", "dashboard"):
		return "admin"
	case containsAny(lu, "upload", "files", "media"):
		return "upload"
	case containsAny(lu, ".bak", ".old", "backup", ".zip", ".tar", ".sql"):
		return "backup"
	case containsAny(lu, "config", ".env", "settings", ".yml", ".yaml", ".ini"):
		return "config"
	case containsAny(lu, "/api", "graphql", "swagger", "openapi"):
		return "api"
	default:
		return "hidden"
	}
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
