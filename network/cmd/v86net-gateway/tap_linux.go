//go:build linux

package main

import (
	"fmt"
	"os"
	"syscall"
	"unsafe"

	"golang.org/x/sys/unix"
)

const (
	tunSetIFF = 0x400454ca
	iffTAP    = 0x0002
	iffNoPI   = 0x1000
	ifNameLen = 16
)

type ifRequest struct {
	Name  [ifNameLen]byte
	Flags uint16
	_     [22]byte
}

func openTAP(name string) (*os.File, error) {
	if name == "" || len(name) >= ifNameLen {
		return nil, fmt.Errorf("invalid interface name %q", name)
	}
	fd, err := unix.Open("/dev/net/tun", unix.O_RDWR|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(fd), "/dev/net/tun")
	if file == nil {
		_ = unix.Close(fd)
		return nil, fmt.Errorf("wrap /dev/net/tun descriptor")
	}
	request := ifRequest{Flags: iffTAP | iffNoPI}
	copy(request.Name[:], name)
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, file.Fd(), tunSetIFF, uintptr(unsafe.Pointer(&request)))
	if errno != 0 {
		file.Close()
		return nil, errno
	}
	return file, nil
}

type linuxPacketDevice struct{ file *os.File }

func openPacketDevice(name string) (packetDevice, error) {
	file, err := openTAP(name)
	if err != nil {
		return nil, err
	}
	return &linuxPacketDevice{file: file}, nil
}

func (device *linuxPacketDevice) ReadFrame(buffer []byte) (int, error) {
	return device.file.Read(buffer)
}

func (device *linuxPacketDevice) WriteFrame(frame []byte) error {
	_, err := device.file.Write(frame)
	return err
}

func (device *linuxPacketDevice) Close() error { return device.file.Close() }
