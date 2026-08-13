package audit

import (
	"bufio"
	"bytes"
	"encoding/json"
	"testing"
	"time"
)

func TestChain_VerifiesIntactLog(t *testing.T) {
	var buf bytes.Buffer
	clk := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	l := New(&buf).WithClock(func() time.Time { return clk })

	_, _ = l.Record("controller", "scan.start", "example.com", nil)
	_, _ = l.Record("agent:scope", "scope.approve", "example.com", map[string]string{"reason": "ok"})
	_, _ = l.Record("agent:fingerprint", "tool.invoke", "fingerprint", nil)

	entries := parse(t, buf.Bytes())
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	if err := Verify(entries); err != nil {
		t.Fatalf("Verify on intact log: %v", err)
	}
}

func TestChain_DetectsTampering(t *testing.T) {
	var buf bytes.Buffer
	l := New(&buf).WithClock(func() time.Time { return time.Unix(0, 0).UTC() })
	_, _ = l.Record("controller", "scan.start", "example.com", nil)
	_, _ = l.Record("agent:scope", "scope.reject", "evil.com", nil)

	entries := parse(t, buf.Bytes())
	// Tamper: flip a rejected target into an approval.
	entries[1].Action = "scope.approve"
	entries[1].Target = "evil.com"
	if err := Verify(entries); err == nil {
		t.Fatal("expected Verify to detect tampering")
	}
}

func TestChain_DetectsTruncation(t *testing.T) {
	var buf bytes.Buffer
	l := New(&buf).WithClock(func() time.Time { return time.Unix(0, 0).UTC() })
	_, _ = l.Record("controller", "scan.start", "a", nil)
	_, _ = l.Record("controller", "stage.start", "b", nil)
	_, _ = l.Record("controller", "stage.done", "c", nil)

	entries := parse(t, buf.Bytes())
	// Remove the middle entry: the chain's prev_hash linkage must break.
	truncated := []Entry{entries[0], entries[2]}
	if err := Verify(truncated); err == nil {
		t.Fatal("expected Verify to detect a removed entry")
	}
}

func parse(t *testing.T, b []byte) []Entry {
	t.Helper()
	var out []Entry
	sc := bufio.NewScanner(bytes.NewReader(b))
	for sc.Scan() {
		var e Entry
		if err := json.Unmarshal(sc.Bytes(), &e); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		out = append(out, e)
	}
	return out
}
