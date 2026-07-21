package main

import "fmt"

type packetDevice interface {
	ReadFrame([]byte) (int, error)
	WriteFrame([]byte) error
	Close() error
}

func openGatewayDevice(backend, name string) (packetDevice, error) {
	switch backend {
	case "native":
		return openPacketDevice(name)
	case "userspace":
		return openUserspaceDevice()
	default:
		return nil, fmt.Errorf("unknown packet backend %q", backend)
	}
}
