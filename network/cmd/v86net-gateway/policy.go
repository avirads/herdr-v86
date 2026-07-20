package main

import (
	"encoding/binary"
	"net/netip"
)

type packetPolicy struct {
	allowPrivate bool
	guestNetwork netip.Prefix
}

func (p packetPolicy) allowGuestFrame(frame []byte) bool {
	if len(frame) < 14 {
		return false
	}
	etherType := binary.BigEndian.Uint16(frame[12:14])
	if etherType == 0x0806 { // ARP
		return true
	}
	if etherType != 0x0800 || len(frame) < 34 { // IPv4 only for this gateway
		return false
	}
	destination := netip.AddrFrom4([4]byte{frame[30], frame[31], frame[32], frame[33]})
	if destination == netip.IPv4Unspecified() || destination == netip.AddrFrom4([4]byte{255, 255, 255, 255}) {
		return true
	}
	if p.allowPrivate || destination.IsGlobalUnicast() && !isPrivateOrSpecial(destination) {
		return true
	}
	return p.guestNetwork.IsValid() && p.guestNetwork.Contains(destination)
}

func isPrivateOrSpecial(address netip.Addr) bool {
	blocked := [...]netip.Prefix{
		netip.MustParsePrefix("10.0.0.0/8"),
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("127.0.0.0/8"),
		netip.MustParsePrefix("169.254.0.0/16"),
		netip.MustParsePrefix("172.16.0.0/12"),
		netip.MustParsePrefix("192.168.0.0/16"),
		netip.MustParsePrefix("224.0.0.0/4"),
	}
	for _, prefix := range blocked {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}
