import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import {
  V86Filesystem,
  V86Sandbox,
  createV86Workspace,
  parseFileEntries,
  shellQuote,
  splitExitMarker,
  splitStderr,
  toGuestPath,
} from '../src/v86-workspace.js';

// ---------------------------------------------------------------------------
// A fake guest bridge: in-memory files plus just enough busybox to serve the
// shell commands the providers actually issue.
// ---------------------------------------------------------------------------

function fakeGuest(initial = {}) {
  const files = new Map(Object.entries(initial));
  const mtimes = new Map([...files.keys()].map(k => [k, 1_700_000_000]));
  const dirs = new Set(['.']);
  const log = [];

  const unquote = s => s.replace(/^'(.*)'$/s, '$1').replace(/'"'"'/g, "'");
  const exit = (code, out = '') => `__V86AGENT_EXIT__${code}\n${out}`;

  const guest = {
    log,
    files,
    mtimes,
    async list(rel) {
      const prefix = rel === '.' ? '' : `${rel}/`;
      const rows = [];
      for (const dir of dirs) {
        if (dir !== '.' && dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/')) {
          rows.push(`directory\t${dir}\t0`);
        }
      }
      for (const [path, content] of files) {
        if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
          rows.push(`file\t${path}\t${content.length}`);
        }
      }
      return rows.join('\n');
    },
    async glob(_pattern, rel) {
      const prefix = rel === '.' ? '' : `${rel}/`;
      return [...files]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, content]) => `file\t${path}\t${content.length}`)
        .join('\n');
    },
    async read(rel) {
      if (!files.has(rel)) throw new Error(`not found: ${rel}`);
      return files.get(rel);
    },
    async write(rel, content) {
      files.set(rel, content);
      mtimes.set(rel, Math.floor(Date.now() / 1000));
    },
    async delete(rel) {
      files.delete(rel);
    },
    async grep(pattern, rel) {
      const prefix = rel === '.' ? '' : `${rel}/`;
      const rows = [];
      for (const [path, content] of files) {
        if (!path.startsWith(prefix)) continue;
        content.split('\n').forEach((line, i) => {
          if (line.includes(pattern)) rows.push(`${path}:${i + 1}:${line}`);
        });
      }
      return rows.join('\n');
    },
    async execute(command) {
      log.push(command);
      // the wrapper appends a stderr section; run only the inner command
      const inner = command.includes('__V86_STDERR__')
        ? command.match(/\{ ([\s\S]*?); \} 2>/)?.[1] ?? command
        : command;

      let m;
      if ((m = inner.match(/^\[ -e (.+) \]$/))) {
        const p = unquote(m[1]);
        return exit(files.has(p) || dirs.has(p) ? 0 : 1);
      }
      if ((m = inner.match(/^stat -c '%F\|%s\|%Y' -- (.+)$/))) {
        const p = unquote(m[1]);
        if (dirs.has(p)) return exit(0, `directory|0|${mtimes.get(p) ?? 1_700_000_000}\n`);
        if (!files.has(p)) return exit(1, 'stat: No such file or directory\n');
        return exit(0, `regular file|${files.get(p).length}|${mtimes.get(p)}\n`);
      }
      if ((m = inner.match(/^mkdir (-p )?-- (.+)$/))) {
        dirs.add(unquote(m[2]));
        return exit(0);
      }
      if ((m = inner.match(/^cp (-r )?-- (.+) (.+)$/))) {
        const [src, dest] = [unquote(m[2]), unquote(m[3])];
        if (!files.has(src)) return exit(1, 'cp: no such file\n');
        files.set(dest, files.get(src));
        mtimes.set(dest, Math.floor(Date.now() / 1000));
        return exit(0);
      }
      if ((m = inner.match(/^mv -- (.+) (.+)$/))) {
        const [src, dest] = [unquote(m[1]), unquote(m[2])];
        if (!files.has(src)) return exit(1, 'mv: no such file\n');
        files.set(dest, files.get(src));
        files.delete(src);
        return exit(0);
      }
      if ((m = inner.match(/^rm -rf -- (.+)$/))) {
        const p = unquote(m[1]);
        for (const key of [...files.keys()]) if (key === p || key.startsWith(`${p}/`)) files.delete(key);
        dirs.delete(p);
        return exit(0);
      }
      if (inner.includes('FAIL_ME')) return exit(3, 'boom on stdout\n');
      if (inner.includes('WRITE_STDERR')) {
        // the wrapper redirects stderr to a file, so emulate the split output
        return exit(0, `out-line\n__V86_STDERR__\nerr-line\n`);
      }
      if (inner.includes('SLOW')) {
        // settles late (not never) so no promise dangles past the test run
        await new Promise(resolve => setTimeout(resolve, 250));
        return exit(0, 'slow done\n');
      }
      return exit(0, `ran: ${inner}\n`);
    },
  };
  return guest;
}

const fsFor = (init, options = {}) => new V86Filesystem({ guest: fakeGuest(init), ...options });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

test('path conversion is absolute-in, relative-out, and rejects traversal', () => {
  assert.equal(toGuestPath('/src/main.rs'), 'src/main.rs');
  assert.equal(toGuestPath('/'), '.');
  assert.throws(() => toGuestPath('relative/path'), /must be absolute/);
  assert.throws(() => toGuestPath('/a/../../etc/passwd'), /cannot contain \.\./);
});

test('shellQuote survives embedded single quotes', () => {
  assert.equal(shellQuote("it's"), `'it'"'"'s'`);
});

test('exit marker and stderr delimiter parse correctly', () => {
  assert.deepEqual(splitExitMarker('__V86AGENT_EXIT__7\nhello'), { exitCode: 7, output: 'hello' });
  assert.deepEqual(splitExitMarker('no marker'), { exitCode: 0, output: 'no marker' });
  assert.deepEqual(splitStderr('out\n__V86_STDERR__\nerr'), { stdout: 'out', stderr: 'err' });
  assert.deepEqual(splitStderr('just stdout'), { stdout: 'just stdout', stderr: '' });
});

test('list output parses into FileEntry shape', () => {
  const [file] = parseFileEntries('file\tsrc/main.rs\t42');
  assert.deepEqual(file, { name: 'main.rs', path: '/src/main.rs', type: 'file', size: 42 });
});

// ---------------------------------------------------------------------------
// Filesystem contract
// ---------------------------------------------------------------------------

test('implements every MastraFilesystem abstract method', () => {
  const filesystem = fsFor({});
  for (const method of [
    'readFile', 'writeFile', 'appendFile', 'deleteFile', 'copyFile', 'moveFile',
    'mkdir', 'rmdir', 'readdir', 'exists', 'stat',
  ]) {
    assert.equal(typeof filesystem[method], 'function', `missing ${method}`);
  }
  assert.equal(filesystem.provider, 'v86');
  assert.equal(filesystem.status, 'pending');
});

test('lifecycle wrapper from the base class drives status', async () => {
  const filesystem = fsFor({});
  await filesystem._init();
  assert.equal(filesystem.status, 'ready');
  await filesystem._destroy();
  assert.equal(filesystem.status, 'destroyed');
});

test('readFile returns Buffer by default and string with an encoding', async () => {
  const filesystem = fsFor({ 'a.txt': 'hello' });
  assert.ok(Buffer.isBuffer(await filesystem.readFile('/a.txt')));
  assert.equal(await filesystem.readFile('/a.txt', { encoding: 'utf8' }), 'hello');
});

test('readFile maps a missing file to FileNotFoundError', async () => {
  await assert.rejects(fsFor({}).readFile('/nope.txt'), err => err.constructor.name === 'FileNotFoundError');
});

test('writeFile round-trips and appendFile concatenates', async () => {
  const filesystem = fsFor({});
  await filesystem.writeFile('/notes.md', '# title\n');
  await filesystem.appendFile('/notes.md', 'body\n');
  assert.equal(await filesystem.readFile('/notes.md', { encoding: 'utf8' }), '# title\nbody\n');
});

test('stat reports type, size and mtime from busybox output', async () => {
  const filesystem = fsFor({ 'a.txt': '12345' });
  const stat = await filesystem.stat('/a.txt');
  assert.equal(stat.type, 'file');
  assert.equal(stat.size, 5);
  assert.equal(stat.name, 'a.txt');
  assert.equal(stat.path, '/a.txt');
  assert.ok(stat.modifiedAt instanceof Date);
  assert.equal(stat.mimeType, 'text/plain');
});

test('stat on a missing path throws FileNotFoundError', async () => {
  await assert.rejects(fsFor({}).stat('/gone'), err => err.constructor.name === 'FileNotFoundError');
});

test('expectedMtime mismatch raises StaleFileError', async () => {
  const filesystem = fsFor({ 'a.txt': 'v1' });
  const stale = new Date(1_600_000_000_000);
  await assert.rejects(
    filesystem.writeFile('/a.txt', 'v2', { expectedMtime: stale }),
    err => err.constructor.name === 'StaleFileError',
  );
});

test('expectedMtime match allows the write', async () => {
  const filesystem = fsFor({ 'a.txt': 'v1' });
  const { modifiedAt } = await filesystem.stat('/a.txt');
  await filesystem.writeFile('/a.txt', 'v2', { expectedMtime: modifiedAt });
  assert.equal(await filesystem.readFile('/a.txt', { encoding: 'utf8' }), 'v2');
});

test('readdir lists a directory and filters by extension', async () => {
  const filesystem = fsFor({ 'a.rs': 'x', 'b.md': 'y', 'c.rs': 'z' });
  assert.equal((await filesystem.readdir('/')).length, 3);
  const rust = await filesystem.readdir('/', { extension: '.rs' });
  assert.deepEqual(rust.map(e => e.name).sort(), ['a.rs', 'c.rs']);
});

test('copy, move and delete go through the shell with quoted paths', async () => {
  const guest = fakeGuest({ "it's.txt": 'data' });
  const filesystem = new V86Filesystem({ guest });
  await filesystem.copyFile("/it's.txt", '/copy.txt');
  assert.equal(guest.files.get('copy.txt'), 'data');
  await filesystem.moveFile('/copy.txt', '/moved.txt');
  assert.equal(guest.files.has('copy.txt'), false);
  await filesystem.deleteFile('/moved.txt');
  assert.equal(guest.files.has('moved.txt'), false);
  assert.ok(guest.log.some(c => c.includes(`'it'"'"'s.txt'`)), 'path was not shell-quoted');
});

test('readOnly blocks every mutation', async () => {
  const filesystem = fsFor({ 'a.txt': 'x' }, { readOnly: true });
  for (const call of [
    () => filesystem.writeFile('/a.txt', 'y'),
    () => filesystem.appendFile('/a.txt', 'y'),
    () => filesystem.deleteFile('/a.txt'),
    () => filesystem.mkdir('/d'),
  ]) {
    await assert.rejects(call, /read-only/);
  }
  // reads still work
  assert.equal(await filesystem.readFile('/a.txt', { encoding: 'utf8' }), 'x');
});

test('grep returns path/line/text triples', async () => {
  const filesystem = fsFor({ 'a.txt': 'alpha\nbeta\n' });
  assert.deepEqual(await filesystem.grep('beta', '/'), [{ path: '/a.txt', line: 2, text: 'beta' }]);
});

// ---------------------------------------------------------------------------
// Sandbox contract
// ---------------------------------------------------------------------------

test('sandbox exposes the optional contract members Mastra probes for', () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  assert.equal(sandbox.provider, 'v86');
  for (const method of ['executeCommand', 'writeFiles', 'getInstructions', 'getInfo', 'start', 'stop']) {
    assert.equal(typeof sandbox[method], 'function', `missing ${method}`);
  }
  assert.equal(sandbox.getInfo().id, 'v86-guest');
  assert.match(sandbox.getInstructions(), /BusyBox/);
});

test('executeCommand returns a spec-shaped CommandResult', async () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  const result = await sandbox.executeCommand('echo', ['hi']);
  assert.equal(result.success, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /echo 'hi'/);
  assert.equal(typeof result.executionTimeMs, 'number');
  assert.deepEqual(result.args, ['hi']);
});

test('non-zero exit is reported, not thrown', async () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  const result = await sandbox.executeCommand('FAIL_ME');
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 3);
});

test('stdout and stderr arrive separated', async () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  const chunks = { out: [], err: [] };
  const result = await sandbox.executeCommand('WRITE_STDERR', [], {
    onStdout: d => chunks.out.push(d),
    onStderr: d => chunks.err.push(d),
  });
  assert.equal(result.stdout.trim(), 'out-line');
  assert.equal(result.stderr.trim(), 'err-line');
  assert.equal(chunks.out.length, 1);
  assert.equal(chunks.err.length, 1);
});

test('cwd and env are applied in one round-trip', async () => {
  const guest = fakeGuest();
  const sandbox = new V86Sandbox({ guest, workingDirectory: '/project', env: { BASE: '1' } });
  await sandbox.executeCommand('ls', [], { cwd: '/other', env: { EXTRA: "a'b" } });
  const [command] = guest.log;
  assert.match(command, /^cd 'other'/);
  assert.match(command, /export BASE='1'/);
  assert.match(command, /export EXTRA='a'"'"'b'/);
  assert.equal(guest.log.length, 1, 'cwd/env must not cost extra round-trips');
});

test('a hostile env var name is dropped rather than injected', async () => {
  const guest = fakeGuest();
  const sandbox = new V86Sandbox({ guest, env: { 'X; rm -rf /': 'bad' } });
  await sandbox.executeCommand('true');
  assert.equal(guest.log[0].includes('rm -rf /'), false);
});

test('timeout produces exit 124 rather than hanging', async () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  const result = await sandbox.executeCommand('SLOW', [], { timeout: 30 });
  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, 124);
  assert.equal(result.success, false);
});

test('abortSignal rejects an in-flight command', async () => {
  const sandbox = new V86Sandbox({ guest: fakeGuest() });
  const controller = new AbortController();
  const pending = sandbox.executeCommand('SLOW', [], { abortSignal: controller.signal, timeout: 0 });
  controller.abort();
  await assert.rejects(pending);
});

test('writeFiles seeds several guest files', async () => {
  const guest = fakeGuest();
  const sandbox = new V86Sandbox({ guest });
  await sandbox.writeFiles([
    { path: '/a.txt', content: 'one' },
    { path: '/b.txt', content: 'two' },
  ]);
  assert.equal(guest.files.get('a.txt'), 'one');
  assert.equal(guest.files.get('b.txt'), 'two');
});

// ---------------------------------------------------------------------------
// Real Workspace integration
// ---------------------------------------------------------------------------

test('a real Mastra Workspace accepts both providers and exposes tools', async () => {
  const guest = fakeGuest({ 'README.md': 'hello world\n' });
  const workspace = new Workspace(createV86Workspace({ guest }));
  await workspace.init();

  const tools = await createWorkspaceTools(workspace);
  const names = Object.keys(tools);
  assert.ok(names.length > 0, 'workspace produced no tools');
  assert.ok(
    names.some(n => /read_file/.test(n)),
    `expected a read_file tool, got: ${names.join(', ')}`,
  );
  assert.ok(
    names.some(n => /execute_command/.test(n)),
    `expected an execute_command tool, got: ${names.join(', ')}`,
  );
});

test('workspace file tools reach the guest end to end', async () => {
  const guest = fakeGuest({ 'README.md': 'hello world\n' });
  const workspace = new Workspace(createV86Workspace({ guest }));
  await workspace.init();

  const filesystem = workspace.filesystem ?? workspace.getFilesystem?.();
  assert.ok(filesystem, 'workspace exposed no filesystem');
  const content = await filesystem.readFile('/README.md', { encoding: 'utf8' });
  assert.equal(content, 'hello world\n');
});

test('the tool names Mastra generates for this workspace', async () => {
  const guest = fakeGuest({ 'README.md': 'hi\n' });
  const workspace = new Workspace(createV86Workspace({ guest }));
  await workspace.init();
  const names = Object.keys(await createWorkspaceTools(workspace)).sort();
  console.log('    tools:', names.join(', '));
  assert.ok(names.length >= 5);
});
