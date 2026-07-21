//go:build windows

package main

import (
	"encoding/binary"
	"errors"
	"io"
	"sync"

	"golang.org/x/sys/windows"
	"golang.zx2c4.com/wireguard/tun"
)

var (
	gatewayMAC = [6]byte{0x52, 0x54, 0x00, 0x12, 0x34, 0x56}
	gatewayIP  = [4]byte{10, 77, 0, 1}
	guestIP    = [4]byte{10, 77, 0, 15}
	dnsIP      = [4]byte{1, 1, 1, 1}
)

type windowsPacketDevice struct {
	device   tun.Device
	frames   chan []byte
	closed   chan struct{}
	closeOne sync.Once
	guestMAC [6]byte
}

func openPacketDevice(name string) (packetDevice, error) {
	tun.WintunTunnelType = "VM"
	tun.WintunStaticRequestedGUID = &windows.GUID{
		Data1: 0x78f19425, Data2: 0x8d1a, Data3: 0x4c58,
		Data4: [8]byte{0x9a, 0x7e, 0x55, 0x56, 0x38, 0xe2, 0x12, 0x41},
	}
	device, err := tun.CreateTUN(name, 1500)
	if err != nil {
		return nil, err
	}
	result := &windowsPacketDevice{device: device, frames: make(chan []byte, 128), closed: make(chan struct{})}
	go result.readIPPackets()
	return result, nil
}

func (device *windowsPacketDevice) Close() error {
	var err error
	device.closeOne.Do(func() {
		close(device.closed)
		err = device.device.Close()
	})
	return err
}

func (device *windowsPacketDevice) ReadFrame(buffer []byte) (int, error) {
	select {
	case frame := <-device.frames:
		if len(frame) > len(buffer) {
			return 0, io.ErrShortBuffer
		}
		return copy(buffer, frame), nil
	case <-device.closed:
		return 0, io.EOF
	}
}

func (device *windowsPacketDevice) WriteFrame(frame []byte) error {
	if len(frame) < 14 {
		return errors.New("short Ethernet frame")
	}
	copy(device.guestMAC[:], frame[6:12])
	switch binary.BigEndian.Uint16(frame[12:14]) {
	case 0x0806:
		if response := device.arpResponse(frame); response != nil {
			return device.enqueue(response)
		}
		return nil
	case 0x0800:
		if response := device.dhcpResponse(frame); response != nil {
			return device.enqueue(response)
		}
		packet := append([]byte(nil), frame[14:]...)
		_, err := device.device.Write([][]byte{packet}, 0)
		return err
	default:
		return nil
	}
}

func (device *windowsPacketDevice) enqueue(frame []byte) error {
	select {
	case device.frames <- frame:
		return nil
	case <-device.closed:
		return io.EOF
	}
}

func (device *windowsPacketDevice) readIPPackets() {
	batch := device.device.BatchSize()
	if batch < 1 {
		batch = 1
	}
	buffers := make([][]byte, batch)
	sizes := make([]int, batch)
	for index := range buffers {
		buffers[index] = make([]byte, 65535)
	}
	for {
		count, err := device.device.Read(buffers, sizes, 0)
		if err != nil {
			return
		}
		for index := 0; index < count; index++ {
			packet := buffers[index][:sizes[index]]
			if len(packet) < 20 || packet[0]>>4 != 4 {
				continue
			}
			frame := make([]byte, 14+len(packet))
			copy(frame[0:6], device.guestMAC[:])
			copy(frame[6:12], gatewayMAC[:])
			frame[12], frame[13] = 0x08, 0x00
			copy(frame[14:], packet)
			if device.enqueue(frame) != nil {
				return
			}
		}
	}
}

func (device *windowsPacketDevice) arpResponse(frame []byte) []byte {
	if len(frame) < 42 || binary.BigEndian.Uint16(frame[20:22]) != 1 || string(frame[38:42]) != string(gatewayIP[:]) {
		return nil
	}
	response := make([]byte, 42)
	copy(response[0:6], frame[6:12])
	copy(response[6:12], gatewayMAC[:])
	response[12], response[13] = 0x08, 0x06
	copy(response[14:22], []byte{0, 1, 8, 0, 6, 4, 0, 2})
	copy(response[22:28], gatewayMAC[:])
	copy(response[28:32], gatewayIP[:])
	copy(response[32:38], frame[22:28])
	copy(response[38:42], frame[28:32])
	return response
}

func (device *windowsPacketDevice) dhcpResponse(frame []byte) []byte {
	if len(frame) < 14+20+8+240 || frame[23] != 17 {
		return nil
	}
	ipStart := 14
	headerLength := int(frame[ipStart]&0x0f) * 4
	udpStart := ipStart + headerLength
	if headerLength < 20 || len(frame) < udpStart+8+240 || binary.BigEndian.Uint16(frame[udpStart:udpStart+2]) != 68 || binary.BigEndian.Uint16(frame[udpStart+2:udpStart+4]) != 67 {
		return nil
	}
	request := frame[udpStart+8:]
	if len(request) < 240 || string(request[236:240]) != "\x63\x82\x53\x63" {
		return nil
	}
	messageType := byte(0)
	for offset := 240; offset < len(request); {
		option := request[offset]
		offset++
		if option == 255 {
			break
		}
		if option == 0 {
			continue
		}
		if offset >= len(request) {
			break
		}
		length := int(request[offset])
		offset++
		if offset+length > len(request) {
			break
		}
		if option == 53 && length == 1 {
			messageType = request[offset]
		}
		offset += length
	}
	replyType := byte(0)
	if messageType == 1 {
		replyType = 2
	}
	if messageType == 3 {
		replyType = 5
	}
	if replyType == 0 {
		return nil
	}

	bootp := make([]byte, 240)
	bootp[0], bootp[1], bootp[2] = 2, 1, 6
	copy(bootp[4:8], request[4:8])
	copy(bootp[10:12], request[10:12])
	copy(bootp[16:20], guestIP[:])
	copy(bootp[20:24], gatewayIP[:])
	copy(bootp[28:44], request[28:44])
	copy(bootp[236:240], []byte{0x63, 0x82, 0x53, 0x63})
	lease := []byte{0, 1, 0x51, 0x80}
	options := []byte{53, 1, replyType, 54, 4}
	options = append(options, gatewayIP[:]...)
	options = append(options, 1, 4, 255, 255, 255, 0, 3, 4)
	options = append(options, gatewayIP[:]...)
	options = append(options, 6, 4)
	options = append(options, dnsIP[:]...)
	options = append(options, 51, 4)
	options = append(options, lease...)
	options = append(options, 255)
	payload := append(bootp, options...)
	return buildIPv4UDPFrame(device.guestMAC, gatewayMAC, gatewayIP, [4]byte{255, 255, 255, 255}, 67, 68, payload)
}

func buildIPv4UDPFrame(destinationMAC, sourceMAC [6]byte, sourceIP, destinationIP [4]byte, sourcePort, destinationPort uint16, payload []byte) []byte {
	frame := make([]byte, 14+20+8+len(payload))
	copy(frame[0:6], destinationMAC[:])
	copy(frame[6:12], sourceMAC[:])
	frame[12], frame[13] = 0x08, 0x00
	ip := frame[14:34]
	ip[0], ip[8], ip[9] = 0x45, 64, 17
	binary.BigEndian.PutUint16(ip[2:4], uint16(20+8+len(payload)))
	binary.BigEndian.PutUint16(ip[4:6], 1)
	binary.BigEndian.PutUint16(ip[6:8], 0x4000)
	copy(ip[12:16], sourceIP[:])
	copy(ip[16:20], destinationIP[:])
	binary.BigEndian.PutUint16(ip[10:12], ipv4Checksum(ip))
	udp := frame[34:42]
	binary.BigEndian.PutUint16(udp[0:2], sourcePort)
	binary.BigEndian.PutUint16(udp[2:4], destinationPort)
	binary.BigEndian.PutUint16(udp[4:6], uint16(8+len(payload)))
	copy(frame[42:], payload)
	return frame
}

func ipv4Checksum(header []byte) uint16 {
	var sum uint32
	for index := 0; index+1 < len(header); index += 2 {
		sum += uint32(binary.BigEndian.Uint16(header[index : index+2]))
	}
	for sum>>16 != 0 {
		sum = (sum & 0xffff) + sum>>16
	}
	return ^uint16(sum)
}
