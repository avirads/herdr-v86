#!/usr/bin/env sh
# Cross-compile herdr for a 32-bit x86 browser guest (i686, static musl).
# Run on your host machine (needs network access to rust-lang.org + ziglang.org).
set -eu

# 1. Toolchains (herdr pins Rust 1.96.1; Zig builds the vendored libghostty-vt)
rustup toolchain install 1.96.1   # sandbox-verified with 1.91 too
rustup target add i686-unknown-linux-musl --toolchain 1.96.1
# Install Zig if missing: https://ziglang.org/download/ (any recent stable)

# 2. Get herdr and apply the target-map patch
git clone https://github.com/ogulcancelik/herdr.git
cd herdr
git apply ../herdr-i686.patch  # includes build.rs target map + bindings.rs 32-bit layout-test gate (required)

# 3. Build.
#    - VERIFIED: libghostty-vt compiles for x86-linux-musl with Zig 0.15.2,
#      SIMD included (google/highway supports 32-bit SSE). No SIMD fallback needed.
#    - rust-lld as linker: no i686 musl C cross-toolchain needed (deps are pure
#      Rust apart from the Zig-built static lib).
RUSTFLAGS="-C linker=rust-lld -C target-feature=+crt-static" \
cargo +1.96.1 build --release --target i686-unknown-linux-musl

# 4. Verify: should say "ELF 32-bit LSB executable, Intel 80386 ... statically linked"
file target/i686-unknown-linux-musl/release/herdr

# 5. Ship it into the guest rootfs image, e.g.:
#    cp target/i686-unknown-linux-musl/release/herdr rootfs/usr/local/bin/herdr
#
# Guest notes:
# - Static musl binary: runs on any i686 distro (Alpine i686 is a good minimal guest).
# - Default i686 Rust baseline is pentium4 (SSE2), which v86 supports.
# - herdr needs a real PTY layer (/dev/ptmx, devpts mounted) and a writable
#   $HOME + $XDG_RUNTIME_DIR (or /tmp) for its Unix socket. Check with:
#     herdr server && herdr api schema
