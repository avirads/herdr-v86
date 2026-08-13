package registry

import (
	"context"
	"strings"
	"testing"
)

func TestBuild_RejectsUnknownCapability(t *testing.T) {
	r := Default()
	if _, err := r.Build(context.Background(), Capability("rm-rf"), nil); err == nil {
		t.Fatal("expected error for unknown capability")
	}
}

func TestBuild_RejectsUnknownFlag(t *testing.T) {
	r := Default()
	_, err := r.Build(context.Background(), CapFingerprint, [][2]string{{"-exec", "/bin/sh"}})
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected 'not allowed' error, got %v", err)
	}
}

func TestBuild_RejectsShellMetacharacters(t *testing.T) {
	r := Default()
	bad := []string{"a; rm -rf /", "`whoami`", "$(id)", "x|y", "a && b", "../../etc/passwd", "a\nb"}
	for _, v := range bad {
		if _, err := r.Build(context.Background(), CapScan, [][2]string{{"-tags", v}}); err == nil {
			t.Errorf("value %q should be rejected", v)
		}
	}
}

func TestBuild_AllowsValidInvocation(t *testing.T) {
	r := Default()
	inv, err := r.Build(context.Background(), CapScan, [][2]string{
		{"-jsonl", ""}, {"-tags", "cve,exposure"}, {"-rate-limit", "50"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inv.Binary != "nuclei" {
		t.Errorf("Binary = %q, want nuclei", inv.Binary)
	}
	want := []string{"-jsonl", "-tags", "cve,exposure", "-rate-limit", "50"}
	if strings.Join(inv.Args, " ") != strings.Join(want, " ") {
		t.Errorf("Args = %v, want %v", inv.Args, want)
	}
}

func TestCapabilities_StableAndComplete(t *testing.T) {
	r := Default()
	caps := r.Capabilities()
	if len(caps) != 7 {
		t.Fatalf("expected 7 capabilities, got %d: %v", len(caps), caps)
	}
	// Sorted?
	for i := 1; i < len(caps); i++ {
		if caps[i-1] > caps[i] {
			t.Errorf("capabilities not sorted at %d: %v", i, caps)
		}
	}
}

func TestCrawlBackends(t *testing.T) {
	r := Default()
	backends := r.Backends(CapCrawl)
	if len(backends) != 4 || backends[0] != "katana" {
		t.Fatalf("crawl backends = %v, want [katana hakrawler gospider native]", backends)
	}
	// the native crawl backend is in-process
	if nb, ok := r.LookupBackend(CapCrawl, "native"); !ok || !nb.InProcess {
		t.Errorf("native crawl backend should be in-process")
	}
	// default (Lookup) resolves to katana
	if tl, _ := r.Lookup(CapCrawl); tl.Binary != "katana" {
		t.Errorf("default crawl backend = %q, want katana", tl.Binary)
	}
	// each backend resolves to its own binary + arg allowlist
	for backend, wantBin := range map[string]string{"katana": "katana", "hakrawler": "hakrawler", "gospider": "gospider"} {
		tl, ok := r.LookupBackend(CapCrawl, backend)
		if !ok || tl.Binary != wantBin {
			t.Errorf("LookupBackend(crawl,%q) = %q,%v; want %q", backend, tl.Binary, ok, wantBin)
		}
	}
	// unknown backend is rejected
	if _, err := r.BuildBackend(context.Background(), CapCrawl, "nope", nil); err == nil {
		t.Error("expected error for unknown crawl backend")
	}
	// hakrawler's -json is allowed; katana's -jsonl is NOT allowed for hakrawler
	if _, err := r.BuildBackend(context.Background(), CapCrawl, "hakrawler", [][2]string{{"-json", ""}}); err != nil {
		t.Errorf("hakrawler -json should be allowed: %v", err)
	}
	if _, err := r.BuildBackend(context.Background(), CapCrawl, "hakrawler", [][2]string{{"-jsonl", ""}}); err == nil {
		t.Error("hakrawler should reject katana's -jsonl flag (per-backend allowlist)")
	}
}

func TestScanBackends_NativeIsInProcess(t *testing.T) {
	r := Default()
	backends := r.Backends(CapScan)
	if len(backends) != 2 || backends[0] != "nuclei" {
		t.Fatalf("scan backends = %v, want [nuclei native]", backends)
	}
	native, ok := r.LookupBackend(CapScan, "native")
	if !ok || !native.InProcess {
		t.Fatalf("native backend should exist and be InProcess: %+v ok=%v", native, ok)
	}
	// an in-process backend must NOT be exec-buildable
	if _, err := r.BuildBackend(context.Background(), CapScan, "native", nil); err == nil {
		t.Error("BuildBackend on the in-process native backend should error")
	}
	// nuclei (default) still builds fine
	if _, err := r.Build(context.Background(), CapScan, [][2]string{{"-jsonl", ""}}); err != nil {
		t.Errorf("default nuclei backend should build: %v", err)
	}
}

func TestLicenses_AreRecorded(t *testing.T) {
	r := Default()
	for _, c := range r.Capabilities() {
		tl, _ := r.Lookup(c)
		if tl.License == "" {
			t.Errorf("capability %q missing license", c)
		}
	}
}
