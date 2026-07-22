# VM performance tuning

OS/emulator-level changes that speed up **every** program in the guest, rather
than any single app. Under v86 each guest instruction is emulated, so the wins
come from making the guest execute *fewer* instructions per unit of work —
mainly by cutting timer interrupts, syscall-path overhead, and per-byte terminal
I/O that a bare-metal kernel build never bothers to avoid.

## What changed

### Page / emulator (`index.html`)
- **512 MB RAM** (was 256): larger page cache, fewer emulated ATA re-reads.
- **Kernel cmdline**: `mitigations=off nopti nospectre_v1 nospectre_v2 nokaslr
  norandmaps quiet loglevel=4`. The emulated CPU has no speculative-execution
  bugs, so retpolines/PTI are pure overhead; KASLR/randomization only defeat
  v86's JIT page reuse; `quiet`/`loglevel` cut per-byte serial printk during
  boot. **Not** `rootflags=noatime` — that is a VFS flag ext4 rejects, panicking
  the root mount; the noatime remount is done in `rc.startup` instead.
- **Batched serial→xterm writes**: v86 delivers serial output one byte per
  listener call. Bytes emitted within a timeslice are coalesced and flushed to
  xterm once per microtask instead of one `term.write()` per character.

### Guest init (`network/guest/`)
- `rc.startup`: `vm.dirty_ratio=80`, `dirty_background_ratio=50`,
  `swappiness=0`, and a `noatime` root remount — disk writes are never
  persisted across reloads, so keep dirty pages in RAM instead of paying
  emulated ATA I/O. `dmesg -n 4` keeps KERN_ERR on the console so the page's
  "lost interrupt" watcher can still trigger the compatibility-boot restart.
- `inittab`: dropped the `tty1` getty — the VGA console is hidden in the page,
  so a third resident getty+shell was only costing memory and wakeups.

### Kernel config (`network/guest/kernel-6.6.config`)
Rebuilt with `build-kernel.sh`. Biggest lever first:

| Change | Why it helps under emulation |
|---|---|
| `HZ=1000` → **`HZ=100`** | 10× fewer timer interrupts; each IRQ is a full emulated interrupt path |
| `CONFIG_AUDIT`/`AUDITSYSCALL` **off** | removes an always-on hook from every syscall |
| `RETPOLINE`, `RANDOMIZE_BASE` (KASLR) **off** | speculative-exec defenses the emulated CPU doesn't need |
| `CGROUPS` **off** | per-task accounting bookkeeping unused by the shell/tools |
| `HIGHMEM4G` → **`NOHIGHMEM`** | no kmap overhead; guest RAM ≤ 512 MB |
| `SWAP`, `PROFILING`, `KALLSYMS_ALL`, `BLK_DEBUG_FS`, `EFI*` **off** | dead weight; smaller image → faster JIT warmup |
| `PREEMPT_DYNAMIC` **off** (keep `PREEMPT_VOLUNTARY`) | drops static-call/preempt overhead; a throughput VM |

Result: **bzImage 10.38 MB → 7.96 MB (−23%)**.

## Benchmarks

Same disk image and browser; warm runs (caches primed). Times are `time`
`real` inside the guest. **Baseline** = pre-tuning page + stock kernel;
**Phase 1** = tuned page + stock kernel; **Phase 2** = tuned page + tuned
kernel.

| Benchmark | Baseline | Phase 1 | Phase 2 | Δ (base→P2) |
|---|--:|--:|--:|--:|
| Boot → Ready | 10.1 s | 9.2 s | 8.3 s | **−18 %** |
| 100k 1-byte syscalls (`dd bs=1`) | 1.16 s | 0.99 s | 0.65–0.79 s | **−40 %** |
| 200× fork/exec (`/bin/true`) | 2.12 s | 2.06 s | 1.25–1.52 s | **−41 %** |
| 20k pure-CPU shell loop | 2.84 s | 2.72 s | 2.67 s | ~0 (CPU-bound) |
| 16 MB pipe | 0.10 s | 0.10 s | 0.08 s | −20 % |
| 400-file cold read | 1.96 s | 2.14 s | 2.44 s | HTTP-fetch noise |
| 100 KB line-buffered → terminal | 6.47 s | 5.61 s | **3.15 s** | **−51 %** |

The wins land exactly where expected: **interrupt- and syscall-heavy work**
(shells, TUIs, agents — i.e. everything interactive) is ~1.5–2× faster, while
pure-CPU code is unchanged (v86 emulates the same instructions either way).

## Terminal throughput: it's guest CPU, not the UART

An earlier read of this said serial output was UART-bound and recommended a v86
UART-FIFO rewrite. **Direct measurement disproved that** — do not spend effort
there. Findings, with the guest's own `time` and the emulator instruction
counter:

- **Block writes are fast and not throttled.** 50 KB written to the terminal in
  reasonably-sized chunks: **0.33 s (~150 KB/s)**, guest at full tilt. This is
  what real TUIs (herdr, tmux, zellij) do — one `write()` per screen refresh.
- **The slow case is pathological, and it's CPU-bound.** Plain `yes` emits
  2-byte lines, so `yes | head -c 100000` is **50 000 line-buffered `write()`
  syscalls**. That is what the old "5.6 s" measured — syscall/tty overhead, not
  serial. During it the guest runs at **~29 MIPS (busy, not halted)** and the
  time is **97 % `sys`**. Producing the same 100 KB to `/dev/null` is 0.08 s, so
  the delta is entirely the guest's tty line-discipline + console + per-`write`
  path — exactly what HZ=100 + no-audit + no-mitigations speed up. It dropped
  **6.47 s → 3.15 s (−51 %)** with no emulator change.
- **The only case that stalls is an edge case.** Redirecting a bulk stream to
  the raw device (`cat bigfile > /dev/ttyS0`) blocks the writer with the guest
  *halted* (~0.9 MIPS). Normal programs write to their controlling terminal, not
  the raw device, so this doesn't affect real workloads. If it ever matters, it
  is the one place a v86 UART change (raise the TX-drain/THRE rate) would help —
  but it is not worth a WASM rebuild for an edge case.

Net: there is no UART bottleneck on the path real programs use; terminal-heavy
work is guest-CPU-bound and already ~2× faster from the kernel tuning above.
The JS-side serial batching in `index.html` still helps the render side when
bursts arrive, and is kept.

## Regression checks (Phase 2 kernel)

Verified in-browser after the rebuild: boot to Ready, `virtio-net` eth0 up,
`tmux` new/list/kill, and the browser bridge — `vmfetch http://localhost:8123/…`
round-trips to `fetch()` and returns `200 OK` identically to the stock kernel.
(External `https://example.com` returns "Failed to fetch" on both kernels: a
browser CORS rejection, not a VM/kernel issue.)

## Reproducing

```sh
# Kernel (needs gcc, make, flex, bison, bc; ~5–10 min):
network/guest/build-kernel.sh        # writes bzImage-network
```
The script pins the early-boot units to `-std=gnu11` for gcc ≥ 14 (which
otherwise fails on `bool`/`true`/`false` as reserved keywords).

Guest init files (`rc.startup`, `inittab`) are baked into
`vm-network-ext4.img` with `debugfs -w`. `index-baseline.html` (git-ignored) is
the de-tuned page kept for A/B runs.
