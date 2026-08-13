// CheerpX implementation of the VM-provider guest contract.
//
// The contract is whatever `network/guest/vmagent-rpc` does on the v86 guest —
// `agent/` consumes only these nine methods and parses their output by shape, so
// this file deliberately mirrors that script's exact commands and flags rather
// than reimplementing the behaviour. Same `find -maxdepth 2`, same
// `stat -c '%F\t%n\t%s'`, same `grep -R -n -F`, same 64 KiB cap, same
// `__V86AGENT_EXIT__` framing. Differences would surface as subtly wrong agent
// behaviour, not as a clean failure.
//
// What is NOT mirrored is the transport. v86 tunnels this over a 115200-baud
// UART with base64 framing, chunking and ACK retries; CheerpX runs the command
// as its own process and moves bytes through mounted devices. Spike S-1 proved
// `cx.run()` is genuinely parallel (three concurrent 2s sleeps finish in 2.07s),
// so there is no mutex and no console contention here.

import { GUEST_IN, GUEST_OUT } from './runtime.js';

/** Matches vmagent-rpc's MAX_BYTES: every result is capped at 64 KiB. */
export const MAX_BYTES = 65536;
/** Matches vmagent-rpc's `timeout 120` around executed commands. */
export const EXECUTE_TIMEOUT_SECONDS = 120;
const DEFAULT_WORKSPACE = '/root/project';

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

/**
 * Guest-side prelude shared by every operation that addresses a path.
 * Reproduces vmagent-rpc's resolve_existing: resolve the real path, then refuse
 * anything that escapes the workspace. Done in the guest, not in JS, because a
 * symlink inside the workspace can only be resolved there.
 */
function preludeExisting(workspace, relative) {
  return [
    `WS=$(readlink -f ${shellQuote(workspace)}) || { echo 'workspace unavailable' >&2; exit 1; }`,
    `T=$(readlink -f "$WS/${relative.replace(/"/g, '\\"')}") || { echo 'path not found: ${relative.replace(/'/g, '')}' >&2; exit 1; }`,
    `case "$T" in "$WS"|"$WS"/*) ;; *) echo 'path escapes workspace' >&2; exit 1;; esac`,
  ].join('\n');
}

export class CheerpXGuestClient {
  /**
   * @param {object} runtime  the object returned by createRuntime()
   * @param {string} workspace guest path treated as "/" by the agent stack
   */
  constructor({ cx, dataIn, idbOut }, { workspace = DEFAULT_WORKSPACE, uid = 0, gid = 0, env = [] } = {}) {
    if (!cx) throw new Error('CheerpXGuestClient requires a booted CheerpX runtime');
    this.cx = cx;
    this.dataIn = dataIn;
    this.idbOut = idbOut;
    this.workspace = workspace;
    this.uid = uid;
    this.gid = gid;
    this.env = env.length ? env : ['HOME=/root', 'USER=root', 'LANG=C.UTF-8', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'];
    this.sequence = 0;
  }

  setWorkspace(path) {
    this.workspace = String(path || DEFAULT_WORKSPACE);
    return this.workspace;
  }

  _nextId() {
    this.sequence += 1;
    // No Date.now() in the id: two calls in the same millisecond are routine now
    // that run() is parallel, and a collision would cross-wire two results.
    return `r${this.sequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Read one of this call's output files back from the IDB device. */
  async _readOut(name) {
    try {
      // Device-relative, NOT the guest-absolute mount path: readFileAsBlob
      // addresses the device, so "/r1.out" — never "/vmbro/out/r1.out".
      const blob = await this.idbOut.readFileAsBlob(`/${name}`);
      return await blob.text();
    } catch {
      return '';
    }
  }

  /**
   * Run a guest script, capturing stdout and stderr into the out-device.
   * `allowFailure` is for execute(), which reports a command's exit code in its
   * payload instead of throwing.
   */
  async _script(body, { allowFailure = false } = {}) {
    const id = this._nextId();
    const out = `${GUEST_OUT}/${id}.out`;
    const err = `${GUEST_OUT}/${id}.err`;
    const wrapped = `{\n${body}\n} >${out} 2>${err}`;

    const { status } = await this.cx.run('/bin/sh', ['-c', wrapped], {
      env: this.env,
      cwd: '/',
      uid: this.uid,
      gid: this.gid,
    });

    const stdout = await this._readOut(`${id}.out`);
    // Only pay for the second device read when something actually failed —
    // stderr is empty on the hot path.
    const stderr = status === 0 ? '' : await this._readOut(`${id}.err`);
    this._cleanup(id);

    if (status !== 0 && !allowFailure) {
      throw new Error(stderr.trim() || stdout.trim() || `guest operation failed (exit ${status})`);
    }
    return { status, stdout, stderr };
  }

  /** Best-effort; a leftover temp file must never fail the operation. */
  _cleanup(id) {
    this.cx.run('/bin/sh', ['-c', `rm -f ${GUEST_OUT}/${id}.out ${GUEST_OUT}/${id}.err`], {
      env: this.env, cwd: '/', uid: this.uid, gid: this.gid,
    }).catch(() => {});
  }

  // --- the nine-method contract ---------------------------------------------

  /**
   * "type<sep>path<sep>size" lines, workspace-relative, two levels deep, 500 max.
   *
   * The separator is the two characters backslash-t, not a tab, and that is
   * correct: `stat -c` does NOT interpret backslash escapes (only `--printf`
   * does), so GNU coreutils behaves exactly like the BusyBox stat on the v86
   * guest. Emitting a real tab here would diverge from upstream, so don't
   * "fix" it — `parseFileEntries` accepts both forms precisely because of this.
   */
  async list(path = '.') {
    const { stdout } = await this._script(`
${preludeExisting(this.workspace, path)}
[ -d "$T" ] || { echo 'list target is not a directory' >&2; exit 1; }
find "$T" -mindepth 1 -maxdepth 2 2>/dev/null | head -n 500 \\
  | while IFS= read -r item; do stat -c '%F\\t%n\\t%s' "$item"; done \\
  | sed "s|$WS/||"`);
    return stdout;
  }

  async read(path) {
    const { stdout } = await this._script(`
${preludeExisting(this.workspace, path)}
[ -f "$T" ] || { echo 'read target is not a regular file' >&2; exit 1; }
size=$(wc -c < "$T")
[ "$size" -le ${MAX_BYTES} ] || { echo "file exceeds ${MAX_BYTES} bytes" >&2; exit 1; }
cat "$T"`);
    return stdout;
  }

  /** "path:line:text" lines. Fixed-string match, mirroring grep -F upstream. */
  async grep(pattern, path = '.') {
    if (!String(pattern)) throw new Error('grep pattern is empty');
    const { stdout } = await this._script(`
${preludeExisting(this.workspace, path)}
grep -R -n -F -- ${shellQuote(pattern)} "$T" 2>/dev/null | sed "s|$WS/||" | head -n 300 || true`);
    return stdout;
  }

  /** Same shape as list(); pattern is matched against the full path. */
  async glob(pattern, path = '.') {
    if (!String(pattern)) throw new Error('glob pattern is empty');
    const { stdout } = await this._script(`
${preludeExisting(this.workspace, path)}
[ -d "$T" ] || { echo 'glob target is not a directory' >&2; exit 1; }
find "$T" -mindepth 1 -maxdepth 12 -path "$T/"${shellQuote(pattern)} 2>/dev/null | head -n 1000 \\
  | while IFS= read -r item; do stat -c '%F\\t%n\\t%s' "$item"; done \\
  | sed "s|$WS/||"`);
    return stdout;
  }

  /** Returns "written <relative-path>", matching the upstream RPC. */
  async write(path, content) {
    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
    if (text.length > MAX_BYTES) throw new Error(`content exceeds ${MAX_BYTES} bytes`);

    const id = this._nextId();
    // DataDevice.writeFile takes a string only — there is no binary write — so
    // anything non-textual has to be encoded by the caller.
    await this.dataIn.writeFile(`/${id}.in`, text);

    const relative = String(path).replace(/"/g, '\\"');
    const { stdout } = await this._script(`
WS=$(readlink -f ${shellQuote(this.workspace)}) || { echo 'workspace unavailable' >&2; exit 1; }
rel="${relative}"
parent=$(dirname "$rel")
PR=$(readlink -f "$WS/$parent") || { echo "parent directory not found: $parent" >&2; exit 1; }
case "$PR" in "$WS"|"$WS"/*) ;; *) echo 'path escapes workspace' >&2; exit 1;; esac
T="$PR/$(basename "$rel")"
cat ${GUEST_IN}/${id}.in > "$T"
printf 'written %s\\n' "\${T#"$WS/"}"`);
    this.cx.run('/bin/sh', ['-c', `rm -f ${GUEST_IN}/${id}.in`], {
      env: this.env, cwd: '/', uid: this.uid, gid: this.gid,
    }).catch(() => {});
    return stdout;
  }

  /** Regular files only, matching upstream. Returns "deleted". */
  async delete(path) {
    const { stdout } = await this._script(`
${preludeExisting(this.workspace, path)}
[ -f "$T" ] || { echo 'delete target is not a regular file' >&2; exit 1; }
rm -f "$T"
printf 'deleted\\n'`);
    return stdout;
  }

  /**
   * Returns "__V86AGENT_EXIT__<code>\n<combined output>".
   *
   * stdout and stderr are combined with 2>&1 because upstream does, and callers
   * depend on it: V86Sandbox separates the streams by wrapping the command with
   * its own redirect and a marker, which only works if that marker travels back
   * in the same stream.
   */
  async execute(command) {
    if (!String(command).trim()) throw new Error('command is empty');
    const { stdout } = await this._script(`
WS=$(readlink -f ${shellQuote(this.workspace)}) || { echo 'workspace unavailable' >&2; exit 1; }
cd "$WS" || exit 1
timeout ${EXECUTE_TIMEOUT_SECONDS} sh -c ${shellQuote(command)} > /tmp/vmbro.$$ 2>&1
code=$?
printf '__V86AGENT_EXIT__%s\\n' "$code"
head -c ${MAX_BYTES} /tmp/vmbro.$$
rm -f /tmp/vmbro.$$
exit 0`, { allowFailure: true });
    return stdout;
  }

  /** Fixed recipe set, mirroring upstream. No consumer calls this today. */
  async test(recipe) {
    const recipes = {
      'make-test': 'make test 2>&1',
      'make-check': 'make check 2>&1',
      'shell-tests': 'for file in test/*.sh tests/*.sh; do [ -f "$file" ] && sh "$file"; done 2>&1',
    };
    const script = recipes[String(recipe)];
    if (!script) throw new Error('unsupported test recipe');
    const { status, stdout } = await this._script(`
WS=$(readlink -f ${shellQuote(this.workspace)}) || { echo 'workspace unavailable' >&2; exit 1; }
cd "$WS" || exit 1
${script}`, { allowFailure: true });
    return status === 0 ? stdout : `${stdout}\n[exit ${status}]\n`;
  }
}

export { CheerpXGuestClient as CheerpXGuestAgentClient };
