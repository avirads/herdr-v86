package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"

	"github.com/containers/gvisor-tap-vsock/pkg/types"
	"github.com/containers/gvisor-tap-vsock/pkg/virtualnetwork"
)

// userspaceDevice connects the gateway's raw Ethernet stream to the pure-Go
// gVisor user-mode network stack. It uses ordinary host TCP/UDP sockets and
// therefore needs neither a Windows packet adapter nor Administrator rights.
type userspaceDevice struct {
	connection net.Conn
	cancel     context.CancelFunc
	closeOnce  sync.Once
	writeMu    sync.Mutex
}

func openUserspaceDevice() (packetDevice, error) {
	configuration := &types.Configuration{
		MTU:               1500,
		Subnet:            "10.77.0.0/24",
		GatewayIP:         "10.77.0.1",
		GatewayMacAddress: "52:54:00:12:34:56",
		Forwards:          map[string]string{},
		NAT:               map[string]string{},
		DHCPStaticLeases:  map[string]string{},
	}
	network, err := virtualnetwork.New(configuration)
	if err != nil {
		return nil, fmt.Errorf("create userspace network: %w", err)
	}
	gatewaySide, stackSide := net.Pipe()
	ctx, cancel := context.WithCancel(context.Background())
	device := &userspaceDevice{connection: gatewaySide, cancel: cancel}
	go func() {
		_ = network.AcceptQemu(ctx, stackSide)
		_ = stackSide.Close()
	}()
	return device, nil
}

func (device *userspaceDevice) ReadFrame(buffer []byte) (int, error) {
	var header [4]byte
	if _, err := io.ReadFull(device.connection, header[:]); err != nil {
		return 0, err
	}
	length := int(binary.BigEndian.Uint32(header[:]))
	if length < 14 || length > len(buffer) {
		return 0, fmt.Errorf("invalid userspace Ethernet frame length %d", length)
	}
	_, err := io.ReadFull(device.connection, buffer[:length])
	return length, err
}

func (device *userspaceDevice) WriteFrame(frame []byte) error {
	if len(frame) < 14 || len(frame) > maxEthernetFrame {
		return fmt.Errorf("invalid Ethernet frame length %d", len(frame))
	}
	device.writeMu.Lock()
	defer device.writeMu.Unlock()
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(frame)))
	if _, err := device.connection.Write(header[:]); err != nil {
		return err
	}
	_, err := device.connection.Write(frame)
	return err
}

func (device *userspaceDevice) Close() error {
	var err error
	device.closeOnce.Do(func() {
		device.cancel()
		err = device.connection.Close()
	})
	return err
}
