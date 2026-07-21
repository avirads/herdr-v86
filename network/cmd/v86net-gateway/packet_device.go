package main

type packetDevice interface {
	ReadFrame([]byte) (int, error)
	WriteFrame([]byte) error
	Close() error
}
