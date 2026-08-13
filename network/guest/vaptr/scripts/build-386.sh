#!/usr/bin/env sh
# Build the static 32-bit ELF for v86. POSIX sh; works on Linux/macOS/Git-Bash.
set -eu

VERSION="${VERSION:-0.1.0}"
OUT="${OUT:-dist/vaptr-linux-386}"

mkdir -p "$(dirname "$OUT")"

echo "Building vaptr $VERSION for linux/386 (static, CGO off)..."
CGO_ENABLED=0 GOOS=linux GOARCH=386 \
  go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$OUT" ./cmd/vaptr

echo "Done: $OUT"
if command -v file >/dev/null 2>&1; then
  file "$OUT"
fi
if command -v du >/dev/null 2>&1; then
  echo "Size: $(du -h "$OUT" | cut -f1)"
fi
