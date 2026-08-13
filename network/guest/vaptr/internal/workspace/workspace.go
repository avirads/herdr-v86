// Package workspace owns all on-disk state for a scan. It confines every read
// and write to a single scan directory (the "workspace"), which is the only
// place the framework — and by extension the LLM — may touch the filesystem.
//
// It also persists a checkpoint (state.json) recording which stages have
// completed, enabling resumable scans: on restart the controller skips any
// stage already marked done and reloads its artifact.
package workspace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/operator/vmvapt/internal/model"
)

// Artifact filenames, fixed so a workspace is self-describing.
const (
	FileScope      = "scope.json"
	FileHTTPX      = "httpx.jsonl"
	FileKatana     = "katana.jsonl"
	FileURLs       = "urls.json"
	FileParams     = "parameters.json"
	FileContent    = "content.json"
	FileFindings   = "findings.jsonl"
	FileInteractsh = "interactsh.jsonl"
	FileReportJSON = "report.json"
	FileReportMD   = "report.md"
	FileReportHTML = "report.html"
	FileAudit      = "audit.jsonl"
	FileState      = "state.json"
)

// State is the resumable checkpoint document.
type State struct {
	Target    string               `json:"target"`
	Started   time.Time            `json:"started"`
	Updated   time.Time            `json:"updated"`
	Completed map[model.Stage]bool `json:"completed"`
}

// Workspace is a filesystem-confined scan directory.
type Workspace struct {
	root  string
	mu    sync.Mutex
	nowFn func() time.Time
}

// Open creates (if needed) and returns a workspace rooted at dir.
func Open(dir string) (*Workspace, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o750); err != nil {
		return nil, fmt.Errorf("create workspace: %w", err)
	}
	return &Workspace{root: abs, nowFn: time.Now}, nil
}

// Root returns the absolute workspace directory.
func (w *Workspace) Root() string { return w.root }

// path resolves name within the workspace and refuses to escape it. This is the
// enforcement point for "no file access outside the workspace".
func (w *Workspace) path(name string) (string, error) {
	if strings.ContainsAny(name, `/\`) || strings.Contains(name, "..") {
		return "", fmt.Errorf("workspace: illegal artifact name %q", name)
	}
	return filepath.Join(w.root, name), nil
}

// Append writes raw bytes to a JSONL artifact (used to stream tool output).
func (w *Workspace) Append(name string, data []byte) error {
	p, err := w.path(name)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return err
	}
	defer f.Close()
	if len(data) > 0 && data[len(data)-1] != '\n' {
		data = append(data, '\n')
	}
	_, err = f.Write(data)
	return err
}

// WriteJSON marshals v (indented) into a workspace artifact.
func (w *Workspace) WriteJSON(name string, v any) error {
	p, err := w.path(name)
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0o640)
}

// WriteFile writes raw bytes (used for report.md / report.html).
func (w *Workspace) WriteFile(name string, data []byte) error {
	p, err := w.path(name)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o640)
}

// ReadFile returns the raw bytes of a workspace artifact.
func (w *Workspace) ReadFile(name string) ([]byte, error) {
	p, err := w.path(name)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(p)
}

// ReadJSON loads a JSON artifact into v.
func (w *Workspace) ReadJSON(name string, v any) error {
	p, err := w.path(name)
	if err != nil {
		return err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// OpenAppend returns an *os.File opened for append within the workspace. The
// audit log holds this for the scan's lifetime.
func (w *Workspace) OpenAppend(name string) (*os.File, error) {
	p, err := w.path(name)
	if err != nil {
		return nil, err
	}
	return os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
}

// LoadState reads state.json, returning a fresh State if none exists yet.
func (w *Workspace) LoadState(target string) (*State, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	var s State
	if err := w.ReadJSON(FileState, &s); err != nil {
		if os.IsNotExist(err) {
			return &State{Target: target, Started: w.nowFn().UTC(), Completed: map[model.Stage]bool{}}, nil
		}
		return nil, err
	}
	if s.Completed == nil {
		s.Completed = map[model.Stage]bool{}
	}
	return &s, nil
}

// SaveState persists the checkpoint.
func (w *Workspace) SaveState(s *State) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	s.Updated = w.nowFn().UTC()
	return w.WriteJSON(FileState, s)
}
