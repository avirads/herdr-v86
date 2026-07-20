package main

import "testing"

func TestDecodeTunnelMessage(t *testing.T) {
	first, second := make([]byte, 14), make([]byte, 20)
	message := append([]byte{'V', 'N', '2', 0, 0, 2, 0, 14}, first...)
	message = append(message, 0, 20)
	message = append(message, second...)
	frames, err := decodeTunnelMessage(message)
	if err != nil || len(frames) != 2 || len(frames[0]) != 14 || len(frames[1]) != 20 {
		t.Fatalf("unexpected decode: frames=%v err=%v", frames, err)
	}
	if _, err := decodeTunnelMessage(message[:len(message)-1]); err == nil {
		t.Fatal("truncated batch was accepted")
	}
}
