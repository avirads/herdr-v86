package llm

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/operator/vmvapt/internal/model"
)

func sampleReport() model.Report {
	return model.Report{
		Target: "demo",
		Summary: model.Summary{
			Total:      2,
			BySeverity: map[model.Severity]int{model.SeverityHigh: 1, model.SeverityMedium: 1},
		},
	}
}

// TestCommandProvider_Summarize exercises the real exec path against a fake
// `vmllm` implemented by re-execing this test binary (TestHelperProcess). It
// verifies the prompt reaches stdin and the VMLLM_* controls reach the env.
func TestCommandProvider_Summarize(t *testing.T) {
	os.Setenv("GO_WANT_HELPER_PROCESS", "1")
	defer os.Unsetenv("GO_WANT_HELPER_PROCESS")

	p := CommandProvider{
		Bin:       os.Args[0],
		Args:      []string{"-test.run=TestHelperProcess", "--", "ok"},
		System:    "be concise",
		MaxTokens: 128,
		Timeout:   10 * time.Second,
	}
	got, err := p.Summarize(context.Background(), sampleReport())
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}
	if !strings.Contains(got, "FAKE_SUMMARY") {
		t.Errorf("expected model output, got %q", got)
	}
	if !strings.Contains(got, "sys=be concise") {
		t.Errorf("VMLLM_SYSTEM not passed to command: %q", got)
	}
	if !strings.Contains(got, "max=128") {
		t.Errorf("VMLLM_MAX_TOKENS not passed to command: %q", got)
	}
	if !strings.Contains(got, "promptBytes=") {
		t.Errorf("prompt not delivered on stdin: %q", got)
	}
}

// TestCommandProvider_EmptyOutputIsError ensures the report agent will fall back
// to the offline template when the model returns nothing.
func TestCommandProvider_EmptyOutputIsError(t *testing.T) {
	os.Setenv("GO_WANT_HELPER_PROCESS", "1")
	defer os.Unsetenv("GO_WANT_HELPER_PROCESS")

	p := CommandProvider{
		Bin:     os.Args[0],
		Args:    []string{"-test.run=TestHelperProcess", "--", "empty"},
		Timeout: 10 * time.Second,
	}
	if _, err := p.Summarize(context.Background(), sampleReport()); err == nil {
		t.Fatal("expected error on empty model output")
	}
}

func TestCommandProvider_FailureIsError(t *testing.T) {
	os.Setenv("GO_WANT_HELPER_PROCESS", "1")
	defer os.Unsetenv("GO_WANT_HELPER_PROCESS")

	p := CommandProvider{
		Bin:     os.Args[0],
		Args:    []string{"-test.run=TestHelperProcess", "--", "fail"},
		Timeout: 10 * time.Second,
	}
	if _, err := p.Summarize(context.Background(), sampleReport()); err == nil {
		t.Fatal("expected error when command exits non-zero")
	}
}

// TestHelperProcess is not a real test: when GO_WANT_HELPER_PROCESS=1 it acts as
// a stand-in for `vmllm`, reading the prompt from stdin and echoing a summary.
func TestHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}
	// After "--": first is the mode, last is the prompt (appended by the
	// provider as the final argv element).
	mode, prompt := "ok", ""
	args := os.Args
	for i, a := range args {
		if a == "--" {
			if i+1 < len(args) {
				mode = args[i+1]
			}
			if len(args) > 0 {
				prompt = args[len(args)-1]
			}
			break
		}
	}
	switch mode {
	case "empty":
		os.Exit(0) // no output
	case "fail":
		fmt.Fprintln(os.Stderr, "simulated model error")
		os.Exit(2)
	default:
		fmt.Printf("FAKE_SUMMARY promptBytes=%d sys=%s max=%s",
			len(prompt), os.Getenv("VMLLM_SYSTEM"), os.Getenv("VMLLM_MAX_TOKENS"))
		os.Exit(0)
	}
}
