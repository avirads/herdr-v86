package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"hash/fnv"
	"io"
	"log"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type handlerRequest struct {
	Method  string              `json:"method"`
	Path    string              `json:"path"`
	Query   string              `json:"query"`
	Headers map[string][]string `json:"headers"`
	Body    string              `json:"body"`
}

type handlerResponse struct {
	Status     int               `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	BodyBase64 string            `json:"bodyBase64"`
}

// Framework describes a scaffoldable project template and how to build/serve it.
type Framework struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Blurb       string `json:"blurb"`
	DefaultFile string `json:"defaultFile"`
	Build       string `json:"build,omitempty"`
	Serve       string `json:"serve"`
}

// WORKSPACE_TOKEN is substituted with the supervised workspace path in build/serve commands.
const WORKSPACE_TOKEN = "$WS"

var frameworks = []Framework{
	{
		ID: "static", Label: "Static site", Blurb: "HTML, CSS and JS served straight from the guest.",
		DefaultFile: "index.html",
		Serve:       "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN,
	},
	{
		ID: "quickjs", Label: "QuickJS server", Blurb: "Dynamic routes in JavaScript, one process per request.",
		DefaultFile: "server.js",
		Serve:       "nc -lk -p $PORT -e qjs --module " + WORKSPACE_TOKEN + "/server.js",
	},
	{
		ID: "chi", Label: "Chi API", Blurb: "Native Go HTTP with editable QuickJS application routes.",
		DefaultFile: "server.js",
		Serve: "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN +
			"/public -handler " + WORKSPACE_TOKEN + "/server.js",
	},
	{
		ID: "astro-hono", Label: "Astro + Hono", Blurb: "Static Astro output with a real Hono TypeScript API.",
		DefaultFile: "src/server.ts",
		Build:       esbuildAstroBuild(WORKSPACE_TOKEN),
		Serve: "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN +
			"/dist -handler " + WORKSPACE_TOKEN + "/server.js",
	},
	{
		ID: "mastra-hono-astro", Label: "Mastra + Hono + Astro", Blurb: "Astro chat with browser-local WebGPU inference.",
		DefaultFile: "src/pages/index.astro",
		Build:       esbuildAstroBuild(WORKSPACE_TOKEN),
		Serve: "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN +
			"/dist -handler " + WORKSPACE_TOKEN + "/server.js",
	},
	{
		ID: "esm", Label: "ES modules app", Blurb: "Components and reactivity with no build step.",
		DefaultFile: "src/app.js",
		Serve:       "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN,
	},
	{
		ID: "typescript", Label: "TypeScript app", Blurb: "TS and TSX bundled by native Go esbuild, without Node.",
		DefaultFile: "src/main.ts",
		Build: "esbuild " + WORKSPACE_TOKEN + "/src/main.ts " + WORKSPACE_TOKEN +
			"/src/styles.css --bundle --format=esm --target=es2020 --outdir=" + WORKSPACE_TOKEN +
			"/dist --entry-names=[name]",
		Serve: "vmbro-httpd -bind 0.0.0.0 -port $PORT -root " + WORKSPACE_TOKEN + "/dist",
	},
}

func esbuildAstroBuild(ws string) string {
	return "mkdir -p " + ws + "/dist " + ws + "/.vmbro && " +
		"esbuild " + ws + "/src/server.ts --bundle --format=esm --platform=neutral --target=es2020 " +
		"--outfile=" + ws + "/dist/server.js && " +
		"esbuild " + ws + "/lib/render-astro.js --bundle --format=esm --platform=neutral --target=es2022 " +
		"--external:std --outfile=" + ws + "/.vmbro/astro-render.js && " +
		"qjs --module " + ws + "/.vmbro/astro-render.js"
}

// supervisor manages the scaffolded app server as a child process.
type supervisor struct {
	mu           sync.Mutex
	workspace    string
	templatesDir string
	appPort      int
	framework    string
	cmd          *exec.Cmd
	logTail      []string
	hub          *eventHub
	lastSnap     string
}

// eventHub fans out a change notification to every connected SSE client.
type eventHub struct {
	mu   sync.Mutex
	subs map[chan struct{}]struct{}
}

func newEventHub() *eventHub {
	return &eventHub{subs: make(map[chan struct{}]struct{})}
}

func (h *eventHub) subscribe() chan struct{} {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan struct{}, 1)
	h.subs[ch] = struct{}{}
	return ch
}

func (h *eventHub) unsubscribe(ch chan struct{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs, ch)
}

func (h *eventHub) notify() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

// workspaceSnapshot fingerprints the workspace files so a polling loop can
// detect edits. Build outputs and supervisor metadata are excluded so they do
// not trigger rebuilds of their own.
func workspaceSnapshot(workspace string) string {
	hash := fnv.New64a()
	_ = filepath.Walk(workspace, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(workspace, path)
		if err != nil || rel == "." {
			return nil
		}
		if info.IsDir() {
			switch filepath.Base(path) {
			case ".vmbro", "dist", ".git", "node_modules":
				return filepath.SkipDir
			}
			return nil
		}
		_, _ = fmt.Fprintf(hash, "%s|%d|%d|", rel, info.Size(), info.ModTime().UnixNano())
		return nil
	})
	return fmt.Sprintf("%x", hash.Sum64())
}

// watchWorkspace polls the workspace for edits and, once the tree is quiet for
// a short interval, rebuilds (if the framework has a build step) and notifies
// the IDE shell so it can reload the preview. Build outputs and supervisor
// metadata are excluded by workspaceSnapshot so the rebuild itself does not
// loop. The baseline is re-established after scaffold/build/restart so those
// explicit actions do not trigger a redundant rebuild.
func (s *supervisor) watchWorkspace() {
	ticker := time.NewTicker(700 * time.Millisecond)
	defer ticker.Stop()
	var lastChange time.Time
	for range ticker.C {
		snap := workspaceSnapshot(s.workspace)
		s.mu.Lock()
		changed := snap != s.lastSnap
		if changed {
			s.lastSnap = snap
			lastChange = time.Now()
		}
		quiet := !lastChange.IsZero() && time.Since(lastChange) >= 1200*time.Millisecond
		if quiet {
			lastChange = time.Time{}
		}
		s.mu.Unlock()
		if changed {
			continue
		}
		if quiet {
			s.handleWorkspaceChange()
		}
	}
}

func (s *supervisor) handleWorkspaceChange() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.addLog("workspace changed — rebuilding")
	if err := s.build(); err != nil {
		s.addLog("rebuild failed: " + err.Error())
		s.hub.notify()
		s.resetWatcher()
		return
	}
	// The static files are read from disk on each request, but the Hono handler
	// is loaded into the long-running QuickJS app server at process start. A
	// rebuild without a restart therefore leaves src/server.ts changes running
	// the old handler even though the IDE reports a successful reload.
	if err := s.startApp(); err != nil {
		s.addLog("rebuild restart failed: " + err.Error())
		s.hub.notify()
		s.resetWatcher()
		return
	}
	s.addLog("rebuild finished — app server restarted")
	s.resetWatcher()
	s.hub.notify()
}

// resetWatcher re-baselines the watcher after an explicit scaffold/build/restart.
func (s *supervisor) resetWatcher() {
	s.lastSnap = workspaceSnapshot(s.workspace)
}

func (s *supervisor) frameworkConfig(id string) *Framework {
	for i := range frameworks {
		if frameworks[i].ID == id {
			return &frameworks[i]
		}
	}
	return nil
}

func (s *supervisor) addLog(lines ...string) {
	for _, line := range lines {
		s.logTail = append(s.logTail, line)
	}
	if len(s.logTail) > 200 {
		s.logTail = s.logTail[len(s.logTail)-200:]
	}
}

// runCommand executes a shell command with a timeout, returning combined output.
func (s *supervisor) runCommand(name string, command string, timeout time.Duration) error {
	s.addLog("$ " + command)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/bin/sh", "-c", command)
	cmd.Dir = s.workspace
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	for _, line := range strings.Split(strings.TrimSpace(output.String()), "\n") {
		if line != "" {
			s.addLog(line)
		}
	}
	if err != nil {
		return fmt.Errorf("%s failed: %v: %s", name, err, strings.TrimSpace(output.String()))
	}
	return nil
}

// expandCommand resolves supervisor placeholders before a command reaches the
// shell. Build and serve commands must use the same expansion path: otherwise
// /bin/sh expands an unresolved $WS to an empty string and turns project paths
// such as $WS/src/main.ts into the invalid absolute path /src/main.ts.
func (s *supervisor) expandCommand(command string) string {
	command = strings.ReplaceAll(command, "$PORT", fmt.Sprint(s.appPort))
	return strings.ReplaceAll(command, WORKSPACE_TOKEN, s.workspace)
}

// stopApp kills any running app server.
func (s *supervisor) stopApp() {
	if s.cmd == nil {
		return
	}
	if s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	_, _ = s.cmd.Process.Wait()
	s.cmd = nil
}

// startApp spawns the app server for the current framework.
func (s *supervisor) startApp() error {
	config := s.frameworkConfig(s.framework)
	if config == nil {
		return fmt.Errorf("unknown framework: %s", s.framework)
	}
	s.stopApp()
	command := s.expandCommand(config.Serve)
	s.addLog("starting app server on 0.0.0.0:" + fmt.Sprint(s.appPort))
	cmd := exec.Command("/bin/sh", "-c", command)
	cmd.Dir = s.workspace
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start app server: %w", err)
	}
	s.cmd = cmd
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}

// build runs the framework's build command if one exists.
func (s *supervisor) build() error {
	config := s.frameworkConfig(s.framework)
	if config == nil {
		return fmt.Errorf("unknown framework: %s", s.framework)
	}
	if config.Build == "" {
		return nil
	}
	if err := s.runCommand("build", s.expandCommand(config.Build), 120*time.Second); err != nil {
		return err
	}
	stamp := filepath.Join(s.workspace, ".vmbro", "build-stamp")
	_ = os.WriteFile(stamp, []byte(s.framework), 0o644)
	return nil
}

// buildFresh reports whether the workspace was already built for this
// framework (a .vmbro/build-stamp written after a successful build, or a
// framework with no build step at all). The image is pre-baked with the
// starter already compiled, so skipping the rebuild makes first boot fast.
func (s *supervisor) buildFresh() bool {
	config := s.frameworkConfig(s.framework)
	if config == nil || config.Build == "" {
		return true
	}
	stamp, err := os.ReadFile(filepath.Join(s.workspace, ".vmbro", "build-stamp"))
	return err == nil && strings.TrimSpace(string(stamp)) == s.framework
}

// loadWorkspace scaffolds the baked-in starter if no framework marker exists yet.
func (s *supervisor) loadWorkspace() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	marker := filepath.Join(s.workspace, ".vmbro", "framework")
	content, err := os.ReadFile(marker)
	if err == nil {
		s.framework = strings.TrimSpace(string(content))
	} else {
		s.framework = "mastra-hono-astro"
		if err := s.scaffoldLocked(s.framework); err != nil {
			return err
		}
	}
	if !s.buildFresh() {
		if err := s.build(); err != nil {
			return err
		}
	}
	return s.startApp()
}

func (s *supervisor) scaffoldLocked(id string) error {
	config := s.frameworkConfig(id)
	if config == nil {
		return fmt.Errorf("unknown framework: %s", id)
	}
	source := filepath.Join(s.templatesDir, id)
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("template %s not found: %w", id, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("template %s is not a directory", id)
	}
	s.addLog("scaffolding " + id)
	if err := clearDir(s.workspace); err != nil {
		return err
	}
	if err := copyTree(source, s.workspace); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(s.workspace, ".vmbro"), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(s.workspace, ".vmbro", "framework"), []byte(id), 0o644); err != nil {
		return err
	}
	// A scaffold replaces the workspace, so the pre-baked build stamp is stale.
	_ = os.Remove(filepath.Join(s.workspace, ".vmbro", "build-stamp"))
	s.framework = id
	return nil
}

func clearDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return os.MkdirAll(dir, 0o755)
		}
		return err
	}
	for _, entry := range entries {
		if entry.Name() == ".vmbro" {
			continue
		}
		if err := os.RemoveAll(filepath.Join(dir, entry.Name())); err != nil {
			return err
		}
	}
	return nil
}

func copyTree(source, target string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if relative == "." {
			return nil
		}
		dest := filepath.Join(target, relative)
		if info.IsDir() {
			return os.MkdirAll(dest, info.Mode())
		}
		return copyFile(path, dest, info.Mode())
	})
}

func copyFile(source, target string, mode os.FileMode) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	output, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer output.Close()
	_, err = io.Copy(output, input)
	return err
}

// safeJoin ensures a relative path stays inside root.
func safeJoin(root, relative string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(relative))
	if clean == "." || clean == "" {
		return root, nil
	}
	if filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") {
		return "", fmt.Errorf("path escapes workspace: %s", relative)
	}
	return filepath.Join(root, clean), nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeText(w http.ResponseWriter, status int, text string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = io.WriteString(w, text)
}

func (s *supervisor) handleFrameworks(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, frameworks)
}

func (s *supervisor) handleFsList(w http.ResponseWriter, r *http.Request) {
	path, err := safeJoin(s.workspace, r.URL.Query().Get("path"))
	if err != nil {
		writeText(w, http.StatusBadRequest, err.Error())
		return
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		writeText(w, http.StatusNotFound, err.Error())
		return
	}
	items := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		info, _ := entry.Info()
		item := map[string]any{"name": entry.Name(), "type": "file"}
		if entry.IsDir() {
			item["type"] = "dir"
		}
		if info != nil {
			item["size"] = info.Size()
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		di := items[i]["type"] == "dir"
		dj := items[j]["type"] == "dir"
		if di != dj {
			return di
		}
		return items[i]["name"].(string) < items[j]["name"].(string)
	})
	writeJSON(w, http.StatusOK, items)
}

func (s *supervisor) handleFsRead(w http.ResponseWriter, r *http.Request) {
	path, err := safeJoin(s.workspace, r.URL.Query().Get("path"))
	if err != nil {
		writeText(w, http.StatusBadRequest, err.Error())
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		writeText(w, http.StatusNotFound, err.Error())
		return
	}
	if info.IsDir() {
		writeText(w, http.StatusBadRequest, "path is a directory")
		return
	}
	if info.Size() > 512*1024 {
		writeText(w, http.StatusRequestEntityTooLarge, "file too large to open in the editor")
		return
	}
	content, err := os.ReadFile(path)
	if err != nil {
		writeText(w, http.StatusInternalServerError, err.Error())
		return
	}
	if bytes.IndexByte(content, 0) >= 0 {
		writeText(w, http.StatusUnsupportedMediaType, "binary files are not editable here")
		return
	}
	writeText(w, http.StatusOK, string(content))
}

func (s *supervisor) handleFsWrite(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<21)).Decode(&payload); err != nil {
		writeText(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	path, err := safeJoin(s.workspace, payload.Path)
	if err != nil {
		writeText(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.HasPrefix(filepath.Base(path), ".") && payload.Path != ".vmbro/framework" {
		writeText(w, http.StatusBadRequest, "hidden files are not editable")
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		writeText(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.WriteFile(path, []byte(payload.Content), 0o644); err != nil {
		writeText(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeText(w, http.StatusNoContent, "")
}

func (s *supervisor) handleScaffold(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Framework string `json:"framework"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&payload); err != nil {
		writeText(w, http.StatusBadRequest, "invalid body: "+err.Error())
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.scaffoldLocked(payload.Framework); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	if err := s.build(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	if err := s.startApp(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	s.resetWatcher()
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true", "framework": s.framework})
}

func (s *supervisor) handleBuild(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.build(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	if err := s.startApp(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	s.resetWatcher()
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (s *supervisor) handleRestart(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.startApp(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"ok": "false", "message": err.Error()})
		return
	}
	s.resetWatcher()
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (s *supervisor) handleStatus(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	running := s.cmd != nil && s.cmd.Process != nil
	writeJSON(w, http.StatusOK, map[string]any{
		"framework": s.framework,
		"running":   running,
		"port":      s.appPort,
		"logTail":   append([]string(nil), s.logTail...),
	})
}

// handleEvents streams Server-Sent Events to the IDE shell so it can live-reload
// the preview when the workspace changes. Keep-alive comments prevent nginx
// from timing out the proxy connection.
func (s *supervisor) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeText(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	ch := s.hub.subscribe()
	defer s.hub.unsubscribe(ch)
	_, _ = fmt.Fprintf(w, "event: ready\ndata: {}\n\n")
	flusher.Flush()
	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ch:
			_, _ = fmt.Fprintf(w, "event: reload\ndata: {}\n\n")
			flusher.Flush()
		case <-keepalive.C:
			_, _ = fmt.Fprint(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

func supervisorRoutes(s *supervisor) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimSuffix(r.URL.Path, "/")
		switch {
		case path == "/api/frameworks" && r.Method == http.MethodGet:
			s.handleFrameworks(w, r)
		case path == "/api/fs/list" && r.Method == http.MethodGet:
			s.handleFsList(w, r)
		case path == "/api/fs/read" && r.Method == http.MethodGet:
			s.handleFsRead(w, r)
		case path == "/api/fs/write" && r.Method == http.MethodPut:
			s.handleFsWrite(w, r)
		case path == "/api/project/scaffold" && r.Method == http.MethodPost:
			s.handleScaffold(w, r)
		case path == "/api/project/build" && r.Method == http.MethodPost:
			s.handleBuild(w, r)
		case path == "/api/project/restart" && r.Method == http.MethodPost:
			s.handleRestart(w, r)
		case path == "/api/project/status" && r.Method == http.MethodGet:
			s.handleStatus(w, r)
		case path == "/api/events" && r.Method == http.MethodGet:
			s.handleEvents(w, r)
		default:
			writeText(w, http.StatusNotFound, "no such IDE API route")
		}
	}
}

func main() {
	var bind, root, handler, runtime, supervise, templates string
	var port, appPort int
	var cgi bool
	flag.StringVar(&bind, "bind", "127.0.0.1", "address to listen on")
	flag.IntVar(&port, "port", 3000, "TCP port to listen on")
	flag.BoolVar(&cgi, "cgi", false, "handle one raw HTTP request on stdin/stdout")
	flag.StringVar(&root, "root", "", "directory of static files")
	flag.StringVar(&handler, "handler", "", "QuickJS module handling dynamic requests")
	flag.StringVar(&runtime, "runtime", "qjs", "QuickJS executable")
	flag.StringVar(&supervise, "supervise", "", "workspace directory to scaffold, build and serve (Dev IDE mode)")
	flag.StringVar(&templates, "templates", "/opt/vmbro/templates", "directory of framework templates")
	flag.IntVar(&appPort, "app-port", 3100, "port for the scaffolded app server")
	flag.Parse()

	if supervise != "" {
		super := &supervisor{
			workspace:    supervise,
			templatesDir: templates,
			appPort:      appPort,
			logTail:      make([]string, 0, 200),
			hub:          newEventHub(),
		}
		router := chi.NewRouter()
		router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer)
		if root != "" {
			router.HandleFunc("/api/*", supervisorRoutes(super))
			router.HandleFunc("/api", supervisorRoutes(super))
			router.Handle("/*", staticHandler(root))
		} else {
			router.NotFound(func(w http.ResponseWriter, _ *http.Request) {
				http.Error(w, "Dev IDE requires --root", http.StatusInternalServerError)
			})
		}
		if cgi {
			if err := serveCGI(router); err != nil {
				log.Fatal(err)
			}
			return
		}
		address := fmt.Sprintf("%s:%d", bind, port)
		log.Printf("vmbro-httpd (Dev IDE) listening on http://%s supervising %s", address, supervise)
		// Scaffold, build and start the app server in the background so the IDE
		// shell (and its port 3000 listener) comes up immediately. In the emulated
		// i386 guest the esbuild/Astro build can take minutes; blocking the bind
		// makes the host boot overlay stall at 98% waiting for a port that does
		// not exist yet. Failures are streamed to the IDE console instead of
		// killing the process.
		go func() {
			if err := super.loadWorkspace(); err != nil {
				super.addLog("supervisor init failed: " + err.Error())
				log.Printf("supervisor init: %v", err)
			}
			super.resetWatcher()
			go super.watchWorkspace()
		}()
		log.Fatal((&http.Server{
			Addr:              address,
			Handler:           router,
			ReadHeaderTimeout: 5 * time.Second,
		}).ListenAndServe())
	}

	if root == "" && handler == "" {
		log.Fatal("at least one of --root or --handler is required")
	}

	router := chi.NewRouter()
	router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer)
	if handler != "" {
		router.HandleFunc("/api/*", quickJSHandler(runtime, handler))
		router.HandleFunc("/api", quickJSHandler(runtime, handler))
	}
	if root != "" {
		router.Handle("/*", staticHandler(root))
	} else {
		router.NotFound(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "not found", http.StatusNotFound)
		})
	}

	if cgi {
		if err := serveCGI(router); err != nil {
			log.Fatal(err)
		}
		return
	}

	address := fmt.Sprintf("%s:%d", bind, port)
	log.Printf("vmbro-httpd listening on http://%s", address)
	server := &http.Server{
		Addr:              address,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}

func serveCGI(handler http.Handler) error {
	request, err := http.ReadRequest(bufio.NewReader(os.Stdin))
	if err != nil {
		return fmt.Errorf("read request: %w", err)
	}
	request.RequestURI = ""
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder.Result().Write(os.Stdout)
}

func quickJSHandler(runtime, script string) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, request.Body, 2<<20))
		if err != nil {
			http.Error(w, "request body is too large", http.StatusRequestEntityTooLarge)
			return
		}
		payload, err := json.Marshal(handlerRequest{
			Method:  request.Method,
			Path:    request.URL.Path,
			Query:   request.URL.RawQuery,
			Headers: request.Header,
			Body:    string(body),
		})
		if err != nil {
			http.Error(w, "could not encode request", http.StatusInternalServerError)
			return
		}

		ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
		defer cancel()
		command := exec.CommandContext(ctx, runtime, "--module", script)
		command.Stdin = bytes.NewReader(payload)
		var stderr bytes.Buffer
		command.Stderr = &stderr
		output, err := command.Output()
		if err != nil {
			log.Printf("handler failed: %v: %s", err, strings.TrimSpace(stderr.String()))
			http.Error(w, "application handler failed", http.StatusInternalServerError)
			return
		}

		var response handlerResponse
		if err := json.Unmarshal(output, &response); err != nil {
			log.Printf("invalid handler response: %v", err)
			http.Error(w, "application returned an invalid response", http.StatusInternalServerError)
			return
		}
		for name, value := range response.Headers {
			w.Header().Set(name, value)
		}
		if response.Status == 0 {
			response.Status = http.StatusOK
		}
		var responseBody []byte
		if response.BodyBase64 != "" {
			responseBody, err = base64.StdEncoding.DecodeString(response.BodyBase64)
			if err != nil {
				http.Error(w, "application returned invalid base64", http.StatusInternalServerError)
				return
			}
		} else {
			responseBody = []byte(response.Body)
		}
		w.WriteHeader(response.Status)
		_, _ = w.Write(responseBody)
	}
}

func staticHandler(root string) http.Handler {
	absolute, err := filepath.Abs(root)
	if err != nil {
		panic(err)
	}
	files := http.FileServer(http.Dir(absolute))
	return http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		clean := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(request.URL.Path, "/")))
		candidate := filepath.Join(absolute, clean)
		if candidate != absolute && !strings.HasPrefix(candidate, absolute+string(os.PathSeparator)) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		info, err := os.Stat(candidate)
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, request)
			return
		}
		if err != nil {
			http.Error(w, "could not read file", http.StatusInternalServerError)
			return
		}
		if info.IsDir() {
			candidate = filepath.Join(candidate, "index.html")
			if _, err := os.Stat(candidate); err != nil {
				http.NotFound(w, request)
				return
			}
		}
		if contentType := mime.TypeByExtension(filepath.Ext(candidate)); contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		w.Header().Set("Cache-Control", "no-store")
		files.ServeHTTP(w, request)
	})
}
