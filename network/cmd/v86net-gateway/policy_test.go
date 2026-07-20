package main

import (
	"net/netip"
	"testing"
)

func ipv4Frame(destination [4]byte) []byte {
	frame := make([]byte, 34)
	frame[12], frame[13] = 0x08, 0x00
	copy(frame[30:34], destination[:])
	return frame
}

func TestPacketPolicy(t *testing.T) {
	policy := packetPolicy{guestNetwork: netip.MustParsePrefix("10.77.0.0/24")}
	for _, allowed := range [][4]byte{{1, 1, 1, 1}, {10, 77, 0, 1}, {255, 255, 255, 255}} {
		if !policy.allowGuestFrame(ipv4Frame(allowed)) {
			t.Fatalf("expected %v to be allowed", allowed)
		}
	}
	for _, denied := range [][4]byte{{127, 0, 0, 1}, {169, 254, 169, 254}, {192, 168, 1, 1}, {10, 1, 2, 3}} {
		if policy.allowGuestFrame(ipv4Frame(denied)) {
			t.Fatalf("expected %v to be denied", denied)
		}
	}
}
