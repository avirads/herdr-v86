# i686 crash: Zig panic in libghostty-vt on pane creation

Status: **open** — root cause isolated to the vendored libghostty-vt (Zig) in the
i686 build; exact function not yet identified because the shipped binary is stripped.

## Symptom

```
herdr-vm:~# herdr --session test
herdr: lost connection to server: Connection reset by peer (os error 104)
```

Any flow that creates a pane terminal aborts the whole `herdr server` process:

- `herdr --session <name>` with no server running: the auto-spawned daemon gets
  `HERDR_STARTUP_CWD` from the client, creates a startup workspace + pane at boot,
  and dies ~1ms after logging "herdr server started". The connecting client's
  socket is reset → the error above. The daemon's stderr goes to /dev/null, so
  the panic is invisible; the process shows up briefly as a `[herdr]` zombie.
- Attaching to a pre-started server works (full TUI renders), but creating the
  first workspace aborts the server the same way (`[2]+ Aborted herdr server ...`).

## Captured panic

Reproduced with stderr redirected to a file (the auto-spawn path hardcodes
/dev/null; temporarily replacing /dev/null with a regular file captures it):

```
thread 655 panic: attempt to use null value
Unwind information for `exe:0xbf95c1` was not available, trace may be incomplete
???:?:?: 0xb88d33 in ??? (exe)
???:?:?: 0xb94c91 in ??? (exe)
???:?:?: 0xb92cd1 in ??? (exe)
???:?:?: 0xb6b8a7 in ??? (exe)
???:?:?: 0xb6c374 in ??? (exe)
???:?:?: 0x7e56b9 in ??? (exe)
???:?:?: 0x6a69c6 in ??? (exe)
???:?:?: 0xa68294 in ??? (exe)
???:?:?: 0x8bdb14 in ??? (exe)
???:?:?: 0x8b51dd in ??? (exe)
???:?:?: 0xac12b5 in ??? (exe)
???:?:?: 0xac7f28 in ??? (exe)
???:?:?: 0x463683 in ??? (exe)
???:?:?: 0x63b165 in ??? (exe)
???:?:?: 0xa8fc4b in ??? (exe)
???:?:?: 0x465fb7 in ??? (exe)
???:?:?: 0x56fb9c in ??? (exe)
???:?:?: 0x88c5e7 in ??? (exe)
???:?:?: 0xe5c5fc in ??? (exe)
???:?:?: 0xe54477 in ??? (exe)
???:?:?: 0x88c5a9 in ??? (exe)
???:?:?: 0x467164 in ??? (exe)
???:?:?: 0xe8184b in ??? (exe)
```

The addresses are deterministic across runs. "attempt to use null value" is a Zig
safety panic (`.?` on a null optional) → `abort()` → the whole server dies with no
Rust panic hook, no log line, and no dmesg entry.

## Minimal repro (inside the VM)

```sh
# dies with the panic (startup workspace → pane → VT parse):
HERDR_STARTUP_CWD=/root HERDR_SESSION=t1 setsid sh -c 'exec herdr server </dev/null >/tmp/s.log 2>&1'
# survives indefinitely (no startup workspace, no pane):
HERDR_SESSION=t2 setsid sh -c 'exec herdr server </dev/null >/tmp/s2.log 2>&1'
```

## Verified findings

- Not IPC/sockets: unix sockets, protocol handshake, and SemanticFrame rendering
  all work (pre-started server + attach renders the full TUI).
- Not OOM / segfault: nothing in dmesg; /dev/null is a proper char device.
- Not the daemonization mechanics: setsid + null stdio alone is harmless.
- `herdr-i686.patch` is compile-time only (target map + gating 46 bindgen layout
  asserts), so the bug is a genuine 32-bit issue inside (or at the FFI boundary
  of) libghostty-vt. The checked-in `bindings.rs` u64 fields mirror uint64_t in
  the C headers and look width-portable; the mismatch, if FFI-side, is subtler.

## Next steps

1. Rebuild with `LIBGHOSTTY_VT_OPTIMIZE=ReleaseSafe`, `-C debuginfo=1`, unstripped
   (build-herdr-i686.sh now does this), re-run the minimal repro, and symbolize
   the trace: `llvm-addr2line -f -e herdr-i686 0xb88d33 0xb94c91 ...`
   (non-PIE static binary → runtime addresses == link addresses).
2. Once the function is known, fix in the vendored Zig source (or report to
   ghostty upstream with the symbolized trace — they likely never test 32-bit).
3. Consider regenerating `src/ghostty/bindings.rs` with bindgen targeting
   i686-unknown-linux-musl and deriving real 32-bit layout asserts, instead of
   gating the 64-bit ones — that either rules the FFI boundary out or fails
   loudly at the culprit struct.

## Interim workaround (inside the VM)

```sh
stty rows 32 cols 100                          # serial console reports 0x0 winsize
herdr server --session work >/tmp/w.log 2>&1 &
sleep 10
herdr --session work                           # attaches, TUI renders
```

Usable until the first workspace/pane is created.
