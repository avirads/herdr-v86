package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"testing"
)

func TestNativeMessageRoundTrip(t *testing.T) {
	payload, err := json.Marshal(nativeRequest{Type: "frame", Data: "AQID"})
	if err != nil {
		t.Fatal(err)
	}
	var input bytes.Buffer
	var header [4]byte
	binary.LittleEndian.PutUint32(header[:], uint32(len(payload)))
	input.Write(header[:])
	input.Write(payload)
	request, err := readNativeRequest(bufio.NewReader(&input))
	if err != nil {
		t.Fatal(err)
	}
	if request.Type != "frame" || request.Data != "AQID" {
		t.Fatalf("unexpected request: %#v", request)
	}
}

func TestNativeMessageWriterUsesLittleEndianLength(t *testing.T) {
	var output bytes.Buffer
	writer := nativeMessageWriter{writer: &output}
	if err := writer.write(nativeResponse{Type: "ready"}); err != nil {
		t.Fatal(err)
	}
	if output.Len() < 5 {
		t.Fatal("native response was too short")
	}
	if got := int(binary.LittleEndian.Uint32(output.Bytes()[:4])); got != output.Len()-4 {
		t.Fatalf("length prefix = %d, payload = %d", got, output.Len()-4)
	}
}
