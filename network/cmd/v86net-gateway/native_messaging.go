package main

import (
	"bufio"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"
)

const maxNativeMessage = 1 << 20

type nativeRequest struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
}

type nativeResponse struct {
	Type  string `json:"type"`
	Data  string `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

type nativeMessageWriter struct {
	mu     sync.Mutex
	writer io.Writer
}

func (writer *nativeMessageWriter) write(response nativeResponse) error {
	payload, err := json.Marshal(response)
	if err != nil {
		return err
	}
	if len(payload) > maxNativeMessage {
		return fmt.Errorf("native message exceeds %d bytes", maxNativeMessage)
	}
	writer.mu.Lock()
	defer writer.mu.Unlock()
	var header [4]byte
	binary.LittleEndian.PutUint32(header[:], uint32(len(payload)))
	if _, err = writer.writer.Write(header[:]); err != nil {
		return err
	}
	_, err = writer.writer.Write(payload)
	return err
}

func readNativeRequest(reader *bufio.Reader) (nativeRequest, error) {
	var header [4]byte
	if _, err := io.ReadFull(reader, header[:]); err != nil {
		return nativeRequest{}, err
	}
	length := binary.LittleEndian.Uint32(header[:])
	if length == 0 || length > maxNativeMessage {
		return nativeRequest{}, fmt.Errorf("invalid native message length %d", length)
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(reader, payload); err != nil {
		return nativeRequest{}, err
	}
	var request nativeRequest
	if err := json.Unmarshal(payload, &request); err != nil {
		return nativeRequest{}, fmt.Errorf("decode native message: %w", err)
	}
	return request, nil
}

func runNativeMessaging() error {
	reader := bufio.NewReader(os.Stdin)
	writer := &nativeMessageWriter{writer: os.Stdout}
	var device packetDevice
	var deviceMu sync.Mutex

	closeDevice := func() {
		deviceMu.Lock()
		defer deviceMu.Unlock()
		if device != nil {
			_ = device.Close()
			device = nil
		}
	}
	defer closeDevice()

	for {
		request, err := readNativeRequest(reader)
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return nil
		}
		if err != nil {
			return err
		}
		switch request.Type {
		case "open":
			deviceMu.Lock()
			if device != nil {
				deviceMu.Unlock()
				_ = writer.write(nativeResponse{Type: "ready"})
				continue
			}
			opened, openErr := openUserspaceDevice()
			if openErr == nil {
				device = opened
			}
			deviceMu.Unlock()
			if openErr != nil {
				_ = writer.write(nativeResponse{Type: "error", Error: openErr.Error()})
				continue
			}
			if err := writer.write(nativeResponse{Type: "ready"}); err != nil {
				return err
			}
			go relayNativeFrames(opened, writer)
		case "frame":
			frame, decodeErr := base64.StdEncoding.DecodeString(request.Data)
			if decodeErr != nil || len(frame) < 14 || len(frame) > maxEthernetFrame {
				_ = writer.write(nativeResponse{Type: "error", Error: "invalid Ethernet frame"})
				continue
			}
			deviceMu.Lock()
			current := device
			deviceMu.Unlock()
			if current == nil {
				_ = writer.write(nativeResponse{Type: "error", Error: "network is not open"})
				continue
			}
			if err := current.WriteFrame(frame); err != nil {
				_ = writer.write(nativeResponse{Type: "error", Error: err.Error()})
			}
		case "close":
			closeDevice()
			if err := writer.write(nativeResponse{Type: "closed"}); err != nil {
				return err
			}
		default:
			_ = writer.write(nativeResponse{Type: "error", Error: "unsupported message type"})
		}
	}
}

func relayNativeFrames(device packetDevice, writer *nativeMessageWriter) {
	buffer := make([]byte, maxEthernetFrame)
	for {
		length, err := device.ReadFrame(buffer)
		if err != nil {
			return
		}
		if err := writer.write(nativeResponse{
			Type: "frame",
			Data: base64.StdEncoding.EncodeToString(buffer[:length]),
		}); err != nil {
			return
		}
	}
}
