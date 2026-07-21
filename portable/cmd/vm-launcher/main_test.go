package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNetworkModes(t *testing.T) {
	for _, mode := range []string{"remote", "userspace", "wintun", "offline"} {
		if !validMode(mode) {
			t.Fatalf("expected %q to be valid", mode)
		}
	}
	if validMode("websockify") {
		t.Fatal("excluded websockify mode was accepted")
	}
}

func TestPortableServerSupportsRangesAndIsolationHeaders(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "disk.img"), []byte("0123456789"), 0600); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(assetHandler(root))
	defer server.Close()
	request, _ := http.NewRequest(http.MethodGet, server.URL+"/disk.img", nil)
	request.Header.Set("Range", "bytes=2-4")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusPartialContent {
		t.Fatalf("range status = %d", response.StatusCode)
	}
	if response.Header.Get("Cross-Origin-Embedder-Policy") != "require-corp" {
		t.Fatal("missing cross-origin isolation")
	}
}

func TestURLFragmentEncodingDoesNotExposeSeparators(t *testing.T) {
	encoded := urlEncode("wss://gateway.example/v1/ethernet?a=b&c=d")
	if strings.ContainsAny(encoded, ":/?&=#") {
		t.Fatalf("unsafe fragment encoding %q", encoded)
	}
}
