package main

import (
	"encoding/binary"
	"errors"
)

var batchMagic = [4]byte{'V', 'N', '2', 0}

func decodeTunnelMessage(message []byte) ([][]byte, error) {
	if len(message) >= 4 && [4]byte(message[:4]) == batchMagic {
		if len(message) < 6 {
			return nil, errors.New("short batch header")
		}
		count := int(binary.BigEndian.Uint16(message[4:6]))
		offset := 6
		frames := make([][]byte, 0, count)
		for range count {
			if offset+2 > len(message) {
				return nil, errors.New("truncated batch length")
			}
			length := int(binary.BigEndian.Uint16(message[offset : offset+2]))
			offset += 2
			if length < 14 || offset+length > len(message) {
				return nil, errors.New("invalid batched Ethernet frame")
			}
			frames = append(frames, message[offset:offset+length])
			offset += length
		}
		if offset != len(message) {
			return nil, errors.New("trailing batch data")
		}
		return frames, nil
	}
	if len(message) < 14 {
		return nil, errors.New("short Ethernet frame")
	}
	return [][]byte{message}, nil
}
