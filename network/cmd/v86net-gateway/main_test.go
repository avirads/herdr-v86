package main

import "testing"

func TestSecureEqual(t *testing.T) {
	if !secureEqual("correct-token", "correct-token") {
		t.Fatal("equal tokens did not match")
	}
	for _, got := range []string{"", "correct", "correct-token-extra", "wrong-token00"} {
		if secureEqual(got, "correct-token") {
			t.Fatalf("unexpected match for %q", got)
		}
	}
}
