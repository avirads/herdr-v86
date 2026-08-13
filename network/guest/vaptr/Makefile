# vmvapt — build automation. Pure Go, stdlib-only: no CGO, no external deps.
BINARY      := vaptr
PKG         := ./cmd/vaptr
VERSION     ?= 0.1.0
LDFLAGS     := -s -w -X main.version=$(VERSION)
DIST        := dist

.PHONY: all build test vet demo clean linux386 release fmt tidy

all: vet test build

## build: native build for the host platform
build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) $(PKG)

## linux386: the primary target — static 32-bit ELF for v86
linux386:
	mkdir -p $(DIST)
	CGO_ENABLED=0 GOOS=linux GOARCH=386 \
		go build -trimpath -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-386 $(PKG)
	@echo "built $(DIST)/$(BINARY)-linux-386"

## release: build native + linux/386 + linux/amd64 artifacts
release: linux386
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
		go build -trimpath -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-amd64 $(PKG)

## test: run all unit + integration tests with race detector off (386-friendly)
test:
	go test ./...

## test-race: race-enabled tests (host arch only)
test-race:
	go test -race ./...

## vet: static analysis
vet:
	go vet ./...

## fmt: format the tree
fmt:
	gofmt -w .

## tidy: sync go.mod (no-op today; stdlib-only)
tidy:
	go mod tidy

## demo: run the fully-offline vulnerable-app example scan
demo:
	go run ./examples/demo

## clean: remove build + scan outputs
clean:
	rm -rf $(BINARY) $(BINARY).exe $(DIST) workspace examples/demo/workspace
