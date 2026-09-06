#!/usr/bin/env bash
# Build vibium, the browser-automation CLI the ai-tools tier ships.
#
#   ./network/guest/build-vibium-x86.sh
#
# Output: network/guest/bin/vibium
#
# Upstream ships linux/amd64, linux/arm64, darwin and windows only, so the 32-bit
# guest binary does not exist as a release asset and has to be cross-compiled.
# The Go module is pure Go with three direct dependencies and no CGO, so
# GOARCH=386 builds cleanly with no patch -- unlike k6, which needs one.
#
# READ THIS BEFORE ASSUMING THE GUEST CAN DRIVE A BROWSER.
#
# vibium automates Chrome. There is no 32-bit Linux Chrome, and there has not
# been one for years. `vibium install` does not fail on i386, which is worse than
# failing: it downloads the linux64 Chrome for Testing build -- a 290 MB x86-64
# ELF that a 32-bit guest cannot exec, against a tier that has 64 MiB of
# headroom. Every browser-driving subcommand is therefore unusable in the guest.
#
# What does work in-guest, with no browser: `version`, `paths`, `completion`,
# `help`, and `add-skill`, which writes the vibe-check SKILL.md this binary
# embeds. In-guest browser automation goes through AutoBro and the vm* bridge
# commands, which drive the parent browser; that is unchanged and unrelated.
#
# The binary is committed at network/guest/bin/vibium. This script exists to
# make it reproducible, not because the image build runs it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VIBIUM_VERSION:-v26.8.21}"
REPOSITORY="${VIBIUM_REPOSITORY:-https://github.com/VibiumDev/vibium.git}"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"
OUTPUT="${OUTPUT:-$SCRIPT_DIR/bin/vibium}"

cleanup() {
  if [[ -z "${KEEP_WORK_DIR:-}" ]]; then rm -rf "$WORK_DIR"; fi
}
trap cleanup EXIT

git clone --depth 1 --branch "$VERSION" "$REPOSITORY" "$WORK_DIR/vibium"

# The version is carried in two symbols, not one: `vibium version` reads
# main.version, and the MCP/API layer reports internal/api.Version separately.
# Setting only the first leaves `vibium mcp` announcing the wrong version.
stamp="${VERSION#v}"

mkdir -p "$(dirname "$OUTPUT")"
(
  cd "$WORK_DIR/vibium"
  # cmd/clicker embeds SKILL.md via //go:embed, and the file lives outside that
  # package in the source tree. Upstream's Makefile copies it in before every
  # build; without this the build fails with "pattern SKILL.md: no matching
  # files found".
  cp skills/vibe-check/SKILL.md clicker/cmd/clicker/SKILL.md
  cd clicker
  CGO_ENABLED=0 GOOS=linux GOARCH=386 \
    go build -trimpath \
      -ldflags "-s -w -X main.version=$stamp -X github.com/vibium/clicker/internal/api.Version=$stamp" \
      -o "$OUTPUT" ./cmd/clicker
)
chmod 0755 "$OUTPUT"

file "$OUTPUT" | grep -q "ELF 32-bit.*80386" || {
  echo "built binary is not i386: $(file "$OUTPUT")" >&2
  exit 1
}
file "$OUTPUT"
sha256sum "$OUTPUT"

# Do not expect the sha256 to match across hosts. Go stamps a build ID derived
# from the build action graph, which includes toolchain paths, so identical
# source produces different bytes on different machines -- the same caveat
# recorded for vaptr. Size and `go version -m` are the stable identity.
