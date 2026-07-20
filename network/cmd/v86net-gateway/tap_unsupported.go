//go:build !linux

package main

import (
	"fmt"
	"os"
)

func openTAP(_ string) (*os.File, error) {
	return nil, fmt.Errorf("TAP is only implemented on Linux")
}
