//go:build windows

package main

import (
	"encoding/binary"
	"testing"
)

func TestARPResponseForGateway(t *testing.T) {
	guestMAC := [6]byte{0x02, 0, 0, 0, 0, 15}
	request := make([]byte, 42)
	copy(request[6:12], guestMAC[:])
	request[12], request[13] = 0x08, 0x06
	copy(request[14:22], []byte{0, 1, 8, 0, 6, 4, 0, 1})
	copy(request[22:28], guestMAC[:])
	copy(request[28:32], []byte{10, 77, 0, 15})
	copy(request[38:42], gatewayIP[:])

	response := (&windowsPacketDevice{}).arpResponse(request)
	if response == nil || binary.BigEndian.Uint16(response[20:22]) != 2 {
		t.Fatal("expected an ARP reply")
	}
	if string(response[22:28]) != string(gatewayMAC[:]) || string(response[28:32]) != string(gatewayIP[:]) {
		t.Fatal("ARP reply did not identify the VM gateway")
	}
}

func TestDHCPDiscoverGetsOffer(t *testing.T) {
	guestMAC := [6]byte{0x02, 0, 0, 0, 0, 15}
	bootp := make([]byte, 240)
	bootp[0], bootp[1], bootp[2] = 1, 1, 6
	copy(bootp[4:8], []byte{1, 2, 3, 4})
	copy(bootp[28:34], guestMAC[:])
	copy(bootp[236:240], []byte{0x63, 0x82, 0x53, 0x63})
	payload := append(bootp, 53, 1, 1, 255)
	request := buildIPv4UDPFrame(gatewayMAC, guestMAC, [4]byte{}, [4]byte{255, 255, 255, 255}, 68, 67, payload)

	device := &windowsPacketDevice{guestMAC: guestMAC}
	response := device.dhcpResponse(request)
	if response == nil {
		t.Fatal("expected a DHCP offer")
	}
	dhcp := response[42:]
	if string(dhcp[16:20]) != string(guestIP[:]) {
		t.Fatalf("offered address %v, want %v", dhcp[16:20], guestIP)
	}
	if dhcp[242] != 2 {
		t.Fatalf("DHCP message type %d, want offer (2)", dhcp[242])
	}
}
