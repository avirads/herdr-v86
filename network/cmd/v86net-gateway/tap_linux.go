//go:build linux

package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"sync/atomic"
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

type linuxPacketDevice struct {
	file   *os.File
	fd     int
	closed atomic.Bool
}

func openPacketDevice(name string) (packetDevice, error) {
	file, err := openTAP(name)
	if err != nil {
		return nil, err
	}
	return &linuxPacketDevice{file: file, fd: int(file.Fd())}, nil
}

func (device *linuxPacketDevice) ReadFrame(buffer []byte) (int, error) {
	pollFDs := []unix.PollFd{{Fd: int32(device.fd), Events: unix.POLLIN}}
	for {
		if device.closed.Load() {
			return 0, io.EOF
		}
		ready, err := unix.Poll(pollFDs, 250)
		if err != nil {
			if errors.Is(err, unix.EINTR) {
				continue
			}
			return 0, err
		}
		if ready == 0 {
			continue
		}
		if pollFDs[0].Revents&(unix.POLLERR|unix.POLLHUP|unix.POLLNVAL) != 0 {
			return 0, io.EOF
		}
		n, err := unix.Read(device.fd, buffer)
		if errors.Is(err, unix.EAGAIN) || errors.Is(err, unix.EWOULDBLOCK) || errors.Is(err, unix.EINTR) {
			continue
		}
		return n, err
	}
}

func (device *linuxPacketDevice) WriteFrame(frame []byte) error {
	_, err := unix.Write(device.fd, frame)
	return err
}

func (device *linuxPacketDevice) Close() error {
	device.closed.Store(true)
	return device.file.Close()
}
