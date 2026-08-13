package agents

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/registry"
	"github.com/operator/vmvapt/internal/runner"
	"github.com/operator/vmvapt/internal/workspace"
)

// ParamDiscovery is Agent 5. It discovers hidden GET/POST parameters using
// ffuf in query/body fuzzing mode — a Go, MIT-licensed, statically-linkable
// tool, keeping the whole default toolset Go-only and v86-friendly (no Python
// runtime required, unlike Arjun).
//
// For each candidate endpoint it fuzzes a parameter-name wordlist and uses
// ffuf autocalibration (-ac) to report only names that measurably change the
// response — the discovered names come from each result's input.FUZZ.
//
// ffuf is file-driven (wordlist + output file); both files are plain relative
// names inside the workspace, and the runner sets the process working directory
// to the workspace root, so nothing escapes the jail.
type ParamDiscovery struct{}

func (ParamDiscovery) Name() string       { return "param_discovery" }
func (ParamDiscovery) Stage() model.Stage { return model.StageParams }

const (
	paramWordlistFile = "param-wordlist.txt"
	// probe is a fixed, unlikely token substituted as the parameter value so
	// runs are deterministic.
	paramProbe = "vaptprobe7391"
	// maxParamTargets bounds how many endpoints are fuzzed (ffuf issues one
	// request per wordlist entry per endpoint), keeping wall-clock sane.
	maxParamTargets = 20
)

func (a ParamDiscovery) Run(ctx context.Context, ac *Context) error {
	if ac.ParamBackend == "native" {
		return runNativeParams(ctx, ac)
	}
	targets := paramCandidates(ac)
	if len(targets) == 0 {
		return ac.WS.WriteJSON(workspace.FileParams, []model.ParamRecord{})
	}
	if _, err := ac.WS.ReadFile(paramWordlistFile); err != nil {
		if werr := ac.WS.WriteFile(paramWordlistFile, defaultParamlist); werr != nil {
			return fmt.Errorf("param_discovery: write wordlist: %w", werr)
		}
	}

	out := []model.ParamRecord{}
	for i, target := range targets {
		endpoint := stripQuery(ensureScheme(target))
		if endpoint == "" {
			continue
		}
		for _, method := range []string{"GET", "POST"} {
			names, err := a.fuzz(ctx, ac, i, method, endpoint)
			if errors.Is(err, runner.ErrToolMissing) {
				// ffuf absent: skip the whole stage gracefully with an empty
				// artifact, matching every other agent's degradation contract.
				return ac.WS.WriteJSON(workspace.FileParams, out)
			}
			if err != nil {
				return err
			}
			if len(names) > 0 {
				out = append(out, model.ParamRecord{URL: endpoint, Method: method, Params: names})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].URL != out[j].URL {
			return out[i].URL < out[j].URL
		}
		return out[i].Method < out[j].Method
	})
	return ac.WS.WriteJSON(workspace.FileParams, out)
}

// fuzz runs one ffuf parameter-fuzzing invocation and returns the discovered
// parameter names. method is GET (query fuzz) or POST (body fuzz).
func (a ParamDiscovery) fuzz(ctx context.Context, ac *Context, idx int, method, endpoint string) ([]string, error) {
	outFile := "param-ffuf-" + strconv.Itoa(idx) + "-" + strings.ToLower(method) + ".json"
	args := [][2]string{
		{"-w", paramWordlistFile},
		{"-ac", ""},
		{"-of", "json"},
		{"-o", outFile},
		{"-s", ""},
	}
	if method == "POST" {
		args = append(args,
			[2]string{"-u", endpoint},
			[2]string{"-X", "POST"},
			[2]string{"-d", "FUZZ=" + paramProbe},
		)
	} else {
		args = append(args, [2]string{"-u", endpoint + "?FUZZ=" + paramProbe})
	}
	args = append(args, rateArgs(ac.Scope, "-rate", "-t")...)

	inv, err := ac.Registry.Build(ctx, registry.CapParamDiscover, args)
	if err != nil {
		return nil, fmt.Errorf("param_discovery: build: %w", err)
	}
	inv.Dir = ac.WS.Root()
	logInvoke(ac, a.Name(), inv)

	_, rerr := ac.Runner.Run(ctx, inv)
	if errors.Is(rerr, runner.ErrToolMissing) {
		return nil, runner.ErrToolMissing
	}
	if rerr != nil {
		return nil, fmt.Errorf("param_discovery: run: %w", rerr)
	}
	data, readErr := ac.WS.ReadFile(outFile)
	if readErr != nil {
		return nil, nil // ffuf wrote nothing → no params for this endpoint/method
	}
	return parseFFUFParamNames(data), nil
}

// parseFFUFParamNames extracts the discovered parameter names (input.FUZZ) from
// a ffuf JSON output document. Pure function for regression testing against
// testdata/param-ffuf.real.json.
func parseFFUFParamNames(data []byte) []string {
	var doc ffufResult
	if len(data) == 0 || unmarshalLenient(data, &doc) != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	for _, r := range doc.Results {
		name := r.Input["FUZZ"]
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// paramCandidates selects endpoints worth fuzzing from urls.json: it excludes
// static assets and collapses to distinct host+path, capped at maxParamTargets.
func paramCandidates(ac *Context) []string {
	var urls []model.URLRecord
	if err := ac.WS.ReadJSON(workspace.FileURLs, &urls); err != nil {
		return trimTargets(ac.Approved)
	}
	seenPath := map[string]bool{}
	var out []string
	for _, u := range urls {
		if isStaticAsset(u.Path) {
			continue
		}
		key := u.Host + u.Path
		if seenPath[key] {
			continue
		}
		seenPath[key] = true
		out = append(out, u.URL)
		if len(out) >= maxParamTargets {
			break
		}
	}
	if len(out) == 0 {
		return trimTargets(ac.Approved)
	}
	return out
}

func trimTargets(targets []string) []string {
	var out []string
	for _, t := range targets {
		out = append(out, ensureScheme(t))
		if len(out) >= maxParamTargets {
			break
		}
	}
	return out
}

func isStaticAsset(path string) bool {
	lp := strings.ToLower(path)
	for _, ext := range []string{".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf"} {
		if strings.HasSuffix(lp, ext) {
			return true
		}
	}
	return false
}

// stripQuery removes any existing query string so we can append ?FUZZ=.
func stripQuery(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/")
}
