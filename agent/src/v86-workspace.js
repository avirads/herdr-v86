// Mastra Workspace providers backed by the browser VM's guest bridge.
//
// `V86Filesystem` and `V86Sandbox` sit where `E2BSandbox` / `DaytonaSandbox`
// would: they implement the same abstract contracts from
// `@mastra/core/workspace` (Apache-2.0, outside every `ee/` directory), so a
// Mastra agent gets file tools and `execute_command` against the guest with no
// framework patching.
//
// Transport: both take a `guest` object — the same one `V86DeepAgentsBackend`
// already consumes, whose calls ride the `__V86RPC__` serial line protocol:
//
//   guest.list(rel)              -> "type\tpath\tsize" lines
//   guest.glob(pattern, rel)     -> same shape
//   guest.read(rel)              -> string
//   guest.write(rel, content)    -> void
//   guest.delete(rel)            -> void
//   guest.grep(pattern, rel)     -> "path:line:text" lines
//   guest.execute(command)       -> "__V86AGENT_EXIT__<n>\n<output>"
//
// Paths are guest-relative (rooted at /root/project); Mastra passes absolute
// paths, so they are converted at the boundary.
//
// Deliberately NOT here: approval gating. `V86DeepAgentsBackend` hand-rolls a
// `permitted()` check into every method. Mastra does this declaratively via
// `tools: { [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval } }`,
// so the provider stays a plain transport and approval policy lives in config.

import { MastraFilesystem, MastraSandbox } from '@mastra/core/workspace';
import {
  DirectoryNotFoundError,
  FileNotFoundError,
  StaleFileError,
} from '@mastra/core/workspace';

const EXIT_MARKER = /^__V86AGENT_EXIT__(\d+)\n?/;
const STDERR_MARKER = '__V86_STDERR__';

// ---------------------------------------------------------------------------
// path + shell helpers
// ---------------------------------------------------------------------------

export function toGuestPath(path) {
  const value = String(path ?? '/').replace(/\\/g, '/');
  if (!value.startsWith('/')) throw new Error(`workspace path must be absolute: ${value}`);
  const relative = value.replace(/^\/+/, '') || '.';
  if (relative.split('/').includes('..')) throw new Error('path cannot contain ..');
  return relative;
}

export function toWorkspacePath(relative) {
  const value = String(relative ?? '').replace(/\\/g, '/').replace(/^\.\/?/, '');
  return value ? `/${value}` : '/';
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function baseName(path) {
  const parts = String(path).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '/';
}

function parentPath(path) {
  const parts = String(path).split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
}

const MIME_BY_EXTENSION = {
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/typescript',
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',
  md: 'text/markdown',
  sh: 'text/x-shellscript',
  py: 'text/x-python',
  c: 'text/x-c',
  h: 'text/x-c',
  rs: 'text/x-rust',
  toml: 'application/toml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
};

export function mimeType(path) {
  return MIME_BY_EXTENSION[String(path).split('.').pop()?.toLowerCase()] || 'text/plain';
}

export function parseFileEntries(output) {
  return String(output ?? '')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [type, path, size] = line.split('\t');
      return {
        name: baseName(path),
        path: toWorkspacePath(path),
        type: type === 'directory' ? 'directory' : 'file',
        size: Number(size) || 0,
      };
    });
}

/** Split `guest.execute()` output into exit code and payload. */
export function splitExitMarker(response) {
  const text = String(response ?? '');
  const match = text.match(EXIT_MARKER);
  return {
    exitCode: match ? Number(match[1]) : 0,
    output: match ? text.slice(match[0].length) : text,
  };
}

/** Split payload at the stderr delimiter injected by the command wrapper. */
export function splitStderr(output) {
  const index = output.indexOf(`\n${STDERR_MARKER}\n`);
  if (index < 0) return { stdout: output, stderr: '' };
  return {
    stdout: output.slice(0, index),
    stderr: output.slice(index + STDERR_MARKER.length + 2),
  };
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

export class V86Filesystem extends MastraFilesystem {
  constructor({ guest, id = 'v86-guest-fs', name = 'v86-guest', readOnly = false, ...options } = {}) {
    super({ name, ...options });
    if (!guest) throw new Error('V86Filesystem requires a guest bridge');
    this.id = id;
    this.name = name;
    this.provider = 'v86';
    this.status = 'pending';
    this.guest = guest;
    this.readOnly = readOnly;
  }

  async init() {
    this.status = 'ready';
  }

  async destroy() {
    this.status = 'destroyed';
  }

  _assertWritable(operation) {
    if (this.readOnly) {
      const error = new Error(`filesystem is read-only: ${operation}`);
      error.code = 'WORKSPACE_READ_ONLY';
      throw error;
    }
  }

  /** Run a shell command in the guest, throwing on a non-zero exit. */
  async _sh(command, { allowFailure = false } = {}) {
    const { exitCode, output } = splitExitMarker(await this.guest.execute(command));
    if (exitCode !== 0 && !allowFailure) {
      throw new Error(`guest command failed (${exitCode}): ${output.trim() || command}`);
    }
    return { exitCode, output };
  }

  async readFile(path, options = {}) {
    const content = await this.guest.read(toGuestPath(path)).catch(error => {
      throw /not found|No such file/i.test(error?.message ?? '')
        ? new FileNotFoundError(path)
        : error;
    });
    if (options.encoding) return content;
    // The serial bridge is text-only; Buffer is produced for contract parity.
    return typeof Buffer !== 'undefined' ? Buffer.from(content, 'utf8') : content;
  }

  async writeFile(path, content, options = {}) {
    this._assertWritable('writeFile');
    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);

    if (options.expectedMtime) {
      // Optimistic concurrency: the guest is also driven by a human at the
      // terminal, so external edits between read and write are routine.
      const current = await this.stat(path).catch(() => null);
      if (current && current.modifiedAt.getTime() !== new Date(options.expectedMtime).getTime()) {
        throw new StaleFileError(path, new Date(options.expectedMtime), current.modifiedAt);
      }
    }
    if (options.overwrite === false && (await this.exists(path))) {
      const error = new Error(`file exists: ${path}`);
      error.code = 'FILE_EXISTS';
      throw error;
    }
    if (options.recursive) await this.mkdir(parentPath(path), { recursive: true });

    await this.guest.write(toGuestPath(path), text);
  }

  async appendFile(path, content) {
    this._assertWritable('appendFile');
    const existing = (await this.exists(path)) ? await this.guest.read(toGuestPath(path)) : '';
    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
    await this.guest.write(toGuestPath(path), existing + text);
  }

  async deleteFile(path, options = {}) {
    this._assertWritable('deleteFile');
    if (options.force && !(await this.exists(path))) return;
    await this.guest.delete(toGuestPath(path));
  }

  async copyFile(src, dest, options = {}) {
    this._assertWritable('copyFile');
    if (options.overwrite === false && (await this.exists(dest))) {
      const error = new Error(`file exists: ${dest}`);
      error.code = 'FILE_EXISTS';
      throw error;
    }
    const flag = options.recursive ? '-r ' : '';
    await this._sh(`cp ${flag}-- ${shellQuote(toGuestPath(src))} ${shellQuote(toGuestPath(dest))}`);
  }

  async moveFile(src, dest, options = {}) {
    this._assertWritable('moveFile');
    if (options.overwrite === false && (await this.exists(dest))) {
      const error = new Error(`file exists: ${dest}`);
      error.code = 'FILE_EXISTS';
      throw error;
    }
    await this._sh(`mv -- ${shellQuote(toGuestPath(src))} ${shellQuote(toGuestPath(dest))}`);
  }

  async mkdir(path, options = {}) {
    this._assertWritable('mkdir');
    const flag = options.recursive ? '-p ' : '';
    await this._sh(`mkdir ${flag}-- ${shellQuote(toGuestPath(path))}`);
  }

  async rmdir(path, options = {}) {
    this._assertWritable('rmdir');
    const command = options.recursive
      ? `rm -rf -- ${shellQuote(toGuestPath(path))}`
      : `rmdir -- ${shellQuote(toGuestPath(path))}`;
    await this._sh(command, { allowFailure: Boolean(options.force) });
  }

  async readdir(path = '/', options = {}) {
    const relative = toGuestPath(path);
    const raw = options.recursive
      ? await this.guest.glob('**/*', relative)
      : await this.guest.list(relative);
    let entries = parseFileEntries(raw);

    if (options.maxDepth != null) {
      const base = relative === '.' ? 0 : relative.split('/').length;
      entries = entries.filter(
        entry => entry.path.split('/').filter(Boolean).length - base <= options.maxDepth,
      );
    }
    if (options.extension) {
      const wanted = (Array.isArray(options.extension) ? options.extension : [options.extension]).map(
        value => (value.startsWith('.') ? value : `.${value}`).toLowerCase(),
      );
      entries = entries.filter(
        entry => entry.type === 'directory' || wanted.some(ext => entry.name.toLowerCase().endsWith(ext)),
      );
    }
    return entries.map(({ name, type, size }) => ({ name, type, size }));
  }

  async exists(path) {
    const { exitCode } = await this._sh(`[ -e ${shellQuote(toGuestPath(path))} ]`, {
      allowFailure: true,
    });
    return exitCode === 0;
  }

  async stat(path) {
    // busybox stat: %F human-readable type, %s size, %Y mtime as epoch seconds.
    const { exitCode, output } = await this._sh(
      `stat -c '%F|%s|%Y' -- ${shellQuote(toGuestPath(path))}`,
      { allowFailure: true },
    );
    if (exitCode !== 0) throw new FileNotFoundError(path);

    const [kind, size, mtime] = output.trim().split('|');
    const isDirectory = /directory/i.test(kind ?? '');
    const modifiedAt = new Date(Number(mtime || 0) * 1000);
    return {
      name: baseName(path),
      path: toWorkspacePath(toGuestPath(path)),
      type: isDirectory ? 'directory' : 'file',
      size: isDirectory ? 0 : Number(size) || 0,
      createdAt: modifiedAt, // no birth time on the guest's ext4 via busybox
      modifiedAt,
      ...(isDirectory ? {} : { mimeType: mimeType(path) }),
    };
  }

  /** Not part of the abstract contract, but Workspace search uses it when present. */
  async grep(pattern, path = '/') {
    const output = await this.guest.grep(pattern, toGuestPath(path));
    return String(output ?? '')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        return match
          ? { path: toWorkspacePath(match[1]), line: Number(match[2]), text: match[3] }
          : null;
      })
      .filter(Boolean);
  }
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

export class V86Sandbox extends MastraSandbox {
  constructor({
    guest,
    id = 'v86-guest',
    name = 'v86-guest',
    workingDirectory = '/',
    env = {},
    captureStderr = true,
    defaultTimeout = 120_000,
    ...options
  } = {}) {
    super({ name, ...options });
    if (!guest) throw new Error('V86Sandbox requires a guest bridge');
    this.id = id;
    this.name = name;
    this.provider = 'v86';
    this.status = 'pending';
    this.guest = guest;
    this.workingDirectory = workingDirectory;
    this.env = env;
    this.captureStderr = captureStderr;
    this.defaultTimeout = defaultTimeout;
    this.createdAt = new Date();
  }

  async start() {
    this.status = 'running';
  }

  async stop() {
    this.status = 'stopped';
  }

  async destroy() {
    this.status = 'destroyed';
  }

  /**
   * Wrap a command so one bridge round-trip yields cwd, env, and split
   * streams. The guest's own `__V86AGENT_EXIT__` marker still carries the
   * exit code, so it is not duplicated here.
   */
  _wrap(command, { cwd, env } = {}) {
    const directory = cwd ?? this.workingDirectory;
    const parts = [];
    const relative = toGuestPath(directory);
    if (relative !== '.') parts.push(`cd ${shellQuote(relative)}`);
    for (const [key, value] of Object.entries({ ...this.env, ...(env || {}) })) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) parts.push(`export ${key}=${shellQuote(value)}`);
    }
    if (!this.captureStderr) {
      parts.push(command);
      return parts.join('; ');
    }
    const errFile = `/tmp/v86sbx.$$`;
    parts.push(
      `{ ${command}; } 2>${errFile}`,
      `__rc=$?`,
      `printf '\\n${STDERR_MARKER}\\n'`,
      `cat ${errFile} 2>/dev/null`,
      `rm -f ${errFile}`,
      `exit $__rc`,
    );
    return parts.join('; ');
  }

  async executeCommand(command, args = [], options = {}) {
    await this.ensureRunning();
    const full = args.length
      ? `${command} ${args.map(shellQuote).join(' ')}`
      : command;
    const wrapped = this._wrap(full, options);
    const startedAt = Date.now();
    const timeout = options.timeout ?? this.defaultTimeout;

    let response;
    let timedOut = false;
    try {
      response = await this._withTimeout(this.guest.execute(wrapped), timeout, options.abortSignal);
    } catch (error) {
      if (error?.name === 'TimeoutError') timedOut = true;
      else throw error;
    }

    if (timedOut) {
      return {
        success: false,
        exitCode: 124,
        stdout: '',
        stderr: `command timed out after ${timeout} ms`,
        executionTimeMs: Date.now() - startedAt,
        timedOut: true,
        killed: true,
        command,
        args,
      };
    }

    const { exitCode, output } = splitExitMarker(response);
    const { stdout, stderr } = this.captureStderr
      ? splitStderr(output)
      : { stdout: output, stderr: '' };

    options.onStdout?.(stdout);
    if (stderr) options.onStderr?.(stderr);

    return {
      success: exitCode === 0,
      exitCode,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startedAt,
      command,
      args,
    };
  }

  _withTimeout(promise, timeout, abortSignal) {
    if (!timeout && !abortSignal) return promise;
    // A signal aborted before we attach never emits 'abort'; check it first.
    if (abortSignal?.aborted) {
      return Promise.reject(abortSignal.reason ?? new Error('aborted'));
    }
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            const error = new Error('timed out');
            error.name = 'TimeoutError';
            reject(error);
          }, timeout)
        : null;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        reject(abortSignal.reason ?? new Error('aborted'));
      };
      abortSignal?.addEventListener('abort', onAbort, { once: true });
      promise.then(
        value => {
          if (timer) clearTimeout(timer);
          abortSignal?.removeEventListener('abort', onAbort);
          resolve(value);
        },
        error => {
          if (timer) clearTimeout(timer);
          abortSignal?.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  async writeFiles(files = []) {
    for (const file of files) {
      const content =
        typeof file.content === 'string' ? file.content : new TextDecoder().decode(file.content);
      await this.guest.write(toGuestPath(file.path), content);
    }
  }

  // Surfaced to the model as part of the workspace instructions. Mirrors the
  // constraints AGENTS.md states for guest agents.
  getInstructions() {
    return [
      'Commands run inside an emulated Linux guest in the browser tab.',
      'The shell is BusyBox sh; GNU-only flags are frequently unavailable.',
      'Without the WebSocket gateway there is no IP address, DNS, or general',
      'TCP/UDP. Use the browser-backed commands (vmfetch, vmclip, vmexport,',
      'vmgithub) instead of curl, git clone, or ssh when `ip route` shows no',
      'default route. These are host RPC operations, not normal networking.',
      'Emulated CPU throughput is limited; prefer few, batched commands over',
      'many small round-trips.',
    ].join(' ');
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      metadata: { transport: 'v86-serial-bridge', workingDirectory: this.workingDirectory },
    };
  }
}

/** Convenience: both providers over one bridge, pointed at the same root. */
export function createV86Workspace({ guest, workingDirectory = '/', readOnly = false } = {}) {
  return {
    filesystem: new V86Filesystem({ guest, readOnly }),
    sandbox: new V86Sandbox({ guest, workingDirectory }),
  };
}
