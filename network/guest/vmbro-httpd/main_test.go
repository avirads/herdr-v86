package main

import (
	"strings"
	"testing"
)

func TestFrameworkCommandsExpandWorkspaceBeforeShell(t *testing.T) {
	s := &supervisor{workspace: "/root/project", appPort: 3100}
	for _, framework := range frameworks {
		for kind, command := range map[string]string{"build": framework.Build, "serve": framework.Serve} {
			if command == "" {
				continue
			}
			expanded := s.expandCommand(command)
			if strings.Contains(expanded, WORKSPACE_TOKEN) {
				t.Fatalf("%s %s retained %s: %s", framework.ID, kind, WORKSPACE_TOKEN, expanded)
			}
			if strings.Contains(expanded, "$PORT") {
				t.Fatalf("%s %s retained $PORT: %s", framework.ID, kind, expanded)
			}
			if !strings.Contains(expanded, "/root/project") {
				t.Fatalf("%s %s lost workspace path: %s", framework.ID, kind, expanded)
			}
		}
	}
}

func TestAffectedBuildsNeverResolveFromFilesystemRoot(t *testing.T) {
	s := &supervisor{workspace: "/root/project", appPort: 3100}
	for _, id := range []string{"typescript", "astro-hono", "mastra-hono-astro"} {
		config := s.frameworkConfig(id)
		if config == nil {
			t.Fatalf("missing framework %s", id)
		}
		expanded := s.expandCommand(config.Build)
		for _, invalid := range []string{" /src/", "=/src/", " /lib/", "=/lib/"} {
			if strings.Contains(expanded, invalid) {
				t.Fatalf("%s build contains root-relative path %q: %s", id, invalid, expanded)
			}
		}
	}
}
