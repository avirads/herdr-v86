//go:build linux

package main

import (
	"fmt"
	"os"
	"syscall"
	"unsafe"
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
	file, err := os.OpenFile("/dev/net/tun", os.O_RDWR, 0)
	if err != nil {
		return nil, err
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
