package workspace

import (
	"testing"

	"github.com/operator/vmvapt/internal/model"
)

// TestWorkspace_JailRejectsEscapes verifies security invariant I5: artifact
// names cannot traverse out of the scan directory.
func TestWorkspace_JailRejectsEscapes(t *testing.T) {
	ws, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"../evil", "..\\evil", "sub/dir", "a/../b", "/etc/passwd"} {
		if err := ws.WriteFile(bad, []byte("x")); err == nil {
			t.Errorf("WriteFile(%q) should be rejected by the workspace jail", bad)
		}
		if _, err := ws.ReadFile(bad); err == nil {
			t.Errorf("ReadFile(%q) should be rejected by the workspace jail", bad)
		}
	}
}

func TestWorkspace_RoundTripJSON(t *testing.T) {
	ws, _ := Open(t.TempDir())
	in := []model.URLRecord{{URL: "https://a/", Host: "a", Path: "/", Sources: []string{"katana"}}}
	if err := ws.WriteJSON(FileURLs, in); err != nil {
		t.Fatal(err)
	}
	var out []model.URLRecord
	if err := ws.ReadJSON(FileURLs, &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0].URL != "https://a/" {
		t.Errorf("round-trip mismatch: %+v", out)
	}
}

func TestWorkspace_StateResume(t *testing.T) {
	ws, _ := Open(t.TempDir())
	s, err := ws.LoadState("example.com")
	if err != nil {
		t.Fatal(err)
	}
	if s.Target != "example.com" || len(s.Completed) != 0 {
		t.Fatalf("fresh state wrong: %+v", s)
	}
	s.Completed[model.StageScope] = true
	if err := ws.SaveState(s); err != nil {
		t.Fatal(err)
	}
	reloaded, err := ws.LoadState("example.com")
	if err != nil {
		t.Fatal(err)
	}
	if !reloaded.Completed[model.StageScope] {
		t.Error("state did not persist across load")
	}
}
