//go:build !linux && !windows

package main

import (
	"fmt"
	"os"
)

func openTAP(_ string) (*os.File, error) {
	return nil, fmt.Errorf("TAP is only implemented on Linux")
}

func openPacketDevice(_ string) (packetDevice, error) {
	return nil, fmt.Errorf("packet device is unsupported on this platform")
}
