// Bind a CheerpX guest console to an xterm.js terminal.
//
// CheerpX's console API is deliberately low level:
//
//   setCustomConsole(write(buffer, vt), columns, rows) -> send(keyCode)
//
// Output arrives as raw bytes tagged with a virtual-terminal number, and input
// goes back one byte at a time. This module is the whole adapter between that
// and xterm — everything else in the provider stays terminal-agnostic.
//
// Two details worth keeping in mind:
//
//   - Decoding must be STREAMING. A multi-byte UTF-8 character can be split
//     across two callbacks, and a fresh TextDecoder per call renders the halves
//     as replacement characters.
//   - `send` takes bytes, not characters. Anything non-ASCII typed or pasted has
//     to be encoded first or the guest receives mojibake.

const DEFAULT_COLUMNS = 120;
const DEFAULT_ROWS = 40;

export class CheerpXTerminal {
  /**
   * @param {object} runtime  the object returned by createRuntime()
   * @param {object} terminal an xterm.js Terminal (already opened)
   */
  constructor({ cx }, terminal, {
    columns, rows, onVt = () => {}, onActivity = () => {},
    // Lines to drop from the guest's first output. See _filter.
    suppress = [/^bash: initialize_job_control:[^\r\n]*\r?\n/m],
    suppressForMs = 8000,
  } = {}) {
    if (!cx) throw new Error('CheerpXTerminal requires a booted CheerpX runtime');
    if (!terminal) throw new Error('CheerpXTerminal requires an xterm terminal');
    this.cx = cx;
    this.terminal = terminal;
    this.decoder = new TextDecoder('utf-8');
    this.encoder = new TextEncoder();
    this.vtsSeen = new Set();
    this.onVt = onVt;
    // Called on every byte in or out, so the host can keep whatever drives the
    // guest on its fast cadence while the terminal is in use. See markActive on
    // CheerpXHostBridge: shell latency tracks the host's poll interval, not the
    // guest's speed.
    this.onActivity = onActivity;
    this.suppress = suppress;
    this.suppressUntil = Date.now() + suppressForMs;
    this.disposables = [];

    this.send = cx.setCustomConsole(
      (buffer, vt) => this._write(buffer, vt),
      columns ?? terminal.cols ?? DEFAULT_COLUMNS,
      rows ?? terminal.rows ?? DEFAULT_ROWS,
    );

    this.disposables.push(terminal.onData(data => this.write(data)));
  }

  _write(buffer, vt) {
    this.onActivity();
    if (!this.vtsSeen.has(vt)) {
      this.vtsSeen.add(vt);
      this.onVt(vt);
    }
    // stream: true so a character split across callbacks survives.
    this.terminal.write(this._filter(this.decoder.decode(buffer, { stream: true })));
  }

  /**
   * Drop known-noise lines from the guest's startup output.
   *
   * bash prints
   *
   *   bash: initialize_job_control: no job control in background: Bad file descriptor
   *
   * as its very first line, because CheerpX's console is not a controlling
   * terminal: bash sees its process group as not owning the tty and gives up on
   * job control. The shell works fine afterwards -- this is a notice, not an
   * error -- but it is the first thing a new visitor reads.
   *
   * It cannot be fixed at the source. `+m` parses but does not stick, since bash
   * turns job control back on for interactive shells, and the warning is emitted
   * during early init before any profile or rc file could run. So it is dropped
   * here, deliberately narrowly: complete lines only, matched patterns only, and
   * only during the first few seconds, after which this is a no-op and normal
   * output is never inspected again.
   */
  _filter(text) {
    if (!this.suppress.length) return text;
    if (Date.now() > this.suppressUntil) { this.suppress = []; return text; }
    let out = text;
    for (const pattern of this.suppress) {
      if (!pattern.test(out)) continue;
      out = out.replace(pattern, '');
      // One match is all there is; stop inspecting every later chunk.
      this.suppress = [];
      break;
    }
    return out;
  }

  /** Send a string to the guest as UTF-8 bytes. */
  write(text) {
    this.onActivity();
    for (const byte of this.encoder.encode(String(text))) this.send(byte);
  }

  /** Start a login shell. The returned promise settles only when it exits. */
  startShell({
    shell = '/bin/bash',
    args = ['--login'],
    cwd = '/root/project',
    uid = 0,
    gid = 0,
    env = ['HOME=/root', 'USER=root', 'TERM=xterm-256color', 'LANG=C.UTF-8'],
  } = {}) {
    return this.cx.run(shell, args, { env, cwd, uid, gid });
  }

  dispose() {
    for (const disposable of this.disposables) disposable?.dispose?.();
    this.disposables = [];
  }
}
