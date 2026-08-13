// Package runner executes validated registry.Invocations. It NEVER uses a
// shell: it calls exec directly with an explicit argv, so no value can be
// re-interpreted as a command. Binaries are resolved from PATH; if a tool is
// missing the runner returns ErrToolMissing so the controller can skip a stage
// gracefully rather than crash.
package runner

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"time"

	"github.com/operator/vmvapt/internal/registry"
)

// ErrToolMissing indicates the binary is not installed on PATH.
var ErrToolMissing = errors.New("tool binary not found on PATH")

// Result is the captured outcome of one execution.
type Result struct {
	Capability registry.Capability
	Stdout     []byte
	Stderr     []byte
	ExitCode   int
	Duration   time.Duration
}

// Runner runs invocations. It is an interface so agents can be unit-tested
// against a deterministic fake (see runner.Fake).
type Runner interface {
	Run(ctx context.Context, inv registry.Invocation) (Result, error)
}

// Exec is the production Runner backed by os/exec.
type Exec struct {
	// Timeout bounds each individual tool run.
	Timeout time.Duration
}

// Run resolves the binary and executes it with the pre-validated argv.
func (e Exec) Run(ctx context.Context, inv registry.Invocation) (Result, error) {
	bin, err := exec.LookPath(inv.Binary)
	if err != nil {
		return Result{Capability: inv.Capability}, fmt.Errorf("%w: %s", ErrToolMissing, inv.Binary)
	}
	if e.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, e.Timeout)
		defer cancel()
	}
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, bin, inv.Args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if len(inv.Stdin) > 0 {
		cmd.Stdin = bytes.NewReader(inv.Stdin)
	}
	if inv.Dir != "" {
		cmd.Dir = inv.Dir
	}

	start := time.Now()
	runErr := cmd.Run()
	res := Result{
		Capability: inv.Capability,
		Stdout:     stdout.Bytes(),
		Stderr:     stderr.Bytes(),
		Duration:   time.Since(start),
	}
	if runErr != nil {
		var ee *exec.ExitError
		if errors.As(runErr, &ee) {
			res.ExitCode = ee.ExitCode()
			return res, nil // non-zero exit is a tool result, not an infra error
		}
		return res, runErr
	}
	return res, nil
}

// Fake is a deterministic Runner for tests: it returns canned output keyed by
// capability. Unknown capabilities return ErrToolMissing.
type Fake struct {
	Outputs map[registry.Capability][]byte
	Calls   []registry.Invocation
}

// Run records the call and returns the canned stdout.
func (f *Fake) Run(_ context.Context, inv registry.Invocation) (Result, error) {
	f.Calls = append(f.Calls, inv)
	out, ok := f.Outputs[inv.Capability]
	if !ok {
		return Result{Capability: inv.Capability}, ErrToolMissing
	}
	return Result{Capability: inv.Capability, Stdout: out}, nil
}
