package main

import (
	"encoding/binary"
	"testing"
)

func TestOpenGatewayDeviceRejectsUnknownBackend(t *testing.T) {
	if _, err := openGatewayDevice("missing", ""); err == nil {
		t.Fatal("unknown backend was accepted")
	}
}

func TestUserspaceDeviceProvidesDHCP(t *testing.T) {
	device, err := openUserspaceDevice()
	if err != nil {
		t.Fatal(err)
	}
	defer device.Close()
	request := testDHCPDiscoverFrame()
	if err := device.WriteFrame(request); err != nil {
		t.Fatal(err)
	}
	buffer := make([]byte, maxEthernetFrame)
	for attempt := 0; attempt < 8; attempt++ {
		n, err := device.ReadFrame(buffer)
		if err != nil {
			t.Fatal(err)
		}
		if n > 42 && buffer[12] == 0x08 && buffer[13] == 0x00 {
			return
		}
	}
	t.Fatal("userspace network did not return a DHCP response")
}

func testDHCPDiscoverFrame() []byte {
	guest := [6]byte{0x00, 0x22, 0x15, 0x01, 0x02, 0x03}
	payload := make([]byte, 240)
	payload[0], payload[1], payload[2] = 1, 1, 6
	copy(payload[4:8], []byte{1, 2, 3, 4})
	copy(payload[28:34], guest[:])
	copy(payload[236:240], []byte{0x63, 0x82, 0x53, 0x63})
	payload = append(payload, 53, 1, 1, 255)
	frame := make([]byte, 14+20+8+len(payload))
	copy(frame[:6], []byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff})
	copy(frame[6:12], guest[:])
	frame[12], frame[13] = 0x08, 0x00
	ip := frame[14:34]
	ip[0], ip[8], ip[9] = 0x45, 64, 17
	binary.BigEndian.PutUint16(ip[2:4], uint16(20+8+len(payload)))
	copy(ip[16:20], []byte{255, 255, 255, 255})
	binary.BigEndian.PutUint16(ip[10:12], testIPv4Checksum(ip))
	udp := frame[34:42]
	binary.BigEndian.PutUint16(udp[0:2], 68)
	binary.BigEndian.PutUint16(udp[2:4], 67)
	binary.BigEndian.PutUint16(udp[4:6], uint16(8+len(payload)))
	copy(frame[42:], payload)
	return frame
}

func testIPv4Checksum(header []byte) uint16 {
	var sum uint32
	for offset := 0; offset < len(header); offset += 2 {
		sum += uint32(binary.BigEndian.Uint16(header[offset : offset+2]))
	}
	for sum>>16 != 0 {
		sum = (sum & 0xffff) + sum>>16
	}
	return ^uint16(sum)
}
