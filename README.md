# herdr-v86 — herdr on 32-bit Linux in the browser

Artifacts for running [herdr](https://herdr.dev) inside a v86 browser VM.

- `herdr-vm-ext4.img` — bootable ext4 root filesystem (Alpine 3.22.5 x86 + herdr 0.7.4,
  static i686-musl). Init mounts proc/sysfs/devpts/tmpfs and spawns shells on ttyS0 + tty1.
- `herdr-alpine-x86-rootfs.tar.gz` — same tree, for 9p setups.
- `herdr-i686` — the standalone static binary.
- `herdr-i686.patch` — patch against herdr v0.7.4: adds i686 targets to the
  libghostty-vt zig target map, and gates 46 bindgen layout-test blocks that
  hardcode 64-bit sizes (the only genuine 32-bit blocker).
- `build-herdr-i686.sh` — cross-compile procedure.

Boot args (disk image route): `root=/dev/sda rw console=ttyS0`
Needs an i686 kernel with 8250 serial + ext4 (or 9p/virtio for the tarball route).
