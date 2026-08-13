package agents

import (
	"context"
	"sort"
	"strings"

	"github.com/operator/vmvapt/internal/model"
	"github.com/operator/vmvapt/internal/workspace"
)

// Native content + parameter discovery: in-process replacements for the ffuf
// backends, using the same embedded wordlists. They add a baseline probe to
// suppress false positives on catch-all servers.

const nativeProbe = "vmvaptprobe7391"

var contentMatchCodes = map[int]bool{200: true, 204: true, 301: true, 302: true, 307: true, 401: true, 403: true}

// runNativeContent brute-forces the built-in wordlist against each approved host.
func runNativeContent(ctx context.Context, ac *Context) error {
	client := nativeClient()
	delay := rateDelay(ac.Scope.RateLimit)
	words := wordlistEntries(defaultWordlist)

	seen := map[string]bool{}
	out := []model.ContentRecord{}
	for _, target := range ac.Approved {
		base := strings.TrimRight(ensureScheme(target), "/")
		if base == "" {
			continue
		}
		// Baseline: a definitely-absent path. If the server answers it with a
		// match code (catch-all), require a differing body length to count a hit.
		baseStatus, _, baseBody, _ := nativeGet(ctx, client, base+"/vmvapt-404-probe-zzq")
		catchAll := contentMatchCodes[baseStatus]
		baseLen := len(baseBody)
		sleep(ctx, delay)

		for _, w := range words {
			select {
			case <-ctx.Done():
				return ac.WS.WriteJSON(workspace.FileContent, out)
			default:
			}
			u := base + "/" + strings.TrimPrefix(w, "/")
			status, _, body, err := nativeGet(ctx, client, u)
			sleep(ctx, delay)
			if err != nil || !contentMatchCodes[status] {
				continue
			}
			if catchAll && abs(len(body)-baseLen) < 16 {
				continue // indistinguishable from the catch-all baseline
			}
			if seen[u] {
				continue
			}
			seen[u] = true
			out = append(out, model.ContentRecord{
				URL: u, Status: status, Length: len(body), Words: countWords(body), Category: categorize(u),
			})
		}
	}
	return ac.WS.WriteJSON(workspace.FileContent, out)
}

// runNativeParams fuzzes GET parameter names against candidate endpoints,
// detecting a parameter by reflection of a probe token or a response-length
// change versus a control request.
func runNativeParams(ctx context.Context, ac *Context) error {
	client := nativeClient()
	delay := rateDelay(ac.Scope.RateLimit)
	params := wordlistEntries(defaultParamlist)
	targets := paramCandidates(ac)

	out := []model.ParamRecord{}
	for _, target := range targets {
		endpoint := stripQuery(ensureScheme(target))
		if endpoint == "" {
			continue
		}
		// control request with an unlikely param name.
		_, _, ctrlBody, err := nativeGet(ctx, client, endpoint+"?vmvaptctrl=1")
		if err != nil {
			continue
		}
		ctrlLen := len(ctrlBody)
		sleep(ctx, delay)

		var found []string
		for _, p := range params {
			select {
			case <-ctx.Done():
				return ac.WS.WriteJSON(workspace.FileParams, out)
			default:
			}
			_, _, body, err := nativeGet(ctx, client, endpoint+"?"+p+"="+nativeProbe)
			sleep(ctx, delay)
			if err != nil {
				continue
			}
			if strings.Contains(body, nativeProbe) || abs(len(body)-ctrlLen) > 48 {
				found = append(found, p)
			}
		}
		if len(found) > 0 {
			sort.Strings(found)
			out = append(out, model.ParamRecord{URL: endpoint, Method: "GET", Params: found})
		}
	}
	return ac.WS.WriteJSON(workspace.FileParams, out)
}

// wordlistEntries splits an embedded wordlist into trimmed, comment-free lines.
func wordlistEntries(data []byte) []string {
	var out []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, line)
	}
	return out
}

func countWords(body string) int {
	return len(strings.Fields(body))
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
