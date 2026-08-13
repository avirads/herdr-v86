// Package audit provides an append-only, tamper-evident event log. Every
// scope decision, tool invocation, and stage transition is recorded here so a
// completed engagement has a defensible record of exactly what was probed.
//
// The log is newline-delimited JSON (audit.jsonl). Each entry carries a
// running hash chain (PrevHash -> Hash) so truncation or edits are detectable.
package audit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

// Entry is one immutable audit record.
type Entry struct {
	Seq      int               `json:"seq"`
	Time     time.Time         `json:"time"`
	Actor    string            `json:"actor"`  // "controller" | "agent:<name>" | "operator"
	Action   string            `json:"action"` // e.g. "scope.approve", "tool.invoke"
	Target   string            `json:"target,omitempty"`
	Details  map[string]string `json:"details,omitempty"`
	PrevHash string            `json:"prev_hash"`
	Hash     string            `json:"hash"`
}

// Log is a concurrency-safe append-only audit log writer.
type Log struct {
	mu       sync.Mutex
	w        io.Writer
	seq      int
	prevHash string
	nowFn    func() time.Time // injectable clock for deterministic tests
}

// New returns a Log that appends entries to w.
func New(w io.Writer) *Log {
	return &Log{w: w, prevHash: "genesis", nowFn: time.Now}
}

// WithClock overrides the clock (test hook).
func (l *Log) WithClock(fn func() time.Time) *Log {
	l.nowFn = fn
	return l
}

// Record appends an entry, computing and chaining its hash. It returns the
// written entry so callers can assert in tests.
func (l *Log) Record(actor, action, target string, details map[string]string) (Entry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.seq++
	e := Entry{
		Seq:      l.seq,
		Time:     l.nowFn().UTC(),
		Actor:    actor,
		Action:   action,
		Target:   target,
		Details:  details,
		PrevHash: l.prevHash,
	}
	e.Hash = hashEntry(e)
	l.prevHash = e.Hash

	line, err := json.Marshal(e)
	if err != nil {
		return Entry{}, fmt.Errorf("marshal audit entry: %w", err)
	}
	if _, err := l.w.Write(append(line, '\n')); err != nil {
		return Entry{}, fmt.Errorf("write audit entry: %w", err)
	}
	return e, nil
}

// hashEntry hashes the identity-bearing fields plus the previous hash.
func hashEntry(e Entry) string {
	h := sha256.New()
	fmt.Fprintf(h, "%d|%s|%s|%s|%s|%v|%s",
		e.Seq, e.Time.Format(time.RFC3339Nano), e.Actor, e.Action, e.Target, e.Details, e.PrevHash)
	return hex.EncodeToString(h.Sum(nil))
}

// Verify replays a slice of entries and confirms the hash chain is intact.
// It is used by tooling that audits a completed engagement.
func Verify(entries []Entry) error {
	prev := "genesis"
	for i, e := range entries {
		if e.PrevHash != prev {
			return fmt.Errorf("entry %d: broken chain (prev_hash mismatch)", e.Seq)
		}
		want := hashEntry(Entry{
			Seq: e.Seq, Time: e.Time, Actor: e.Actor, Action: e.Action,
			Target: e.Target, Details: e.Details, PrevHash: e.PrevHash,
		})
		if want != e.Hash {
			return fmt.Errorf("entry %d (index %d): hash mismatch, record altered", e.Seq, i)
		}
		prev = e.Hash
	}
	return nil
}
