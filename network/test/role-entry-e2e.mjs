import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { extname, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..', '..');
const chrome = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 8091;
const requests = [];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.img': 'application/octet-stream', '.bin': 'application/octet-stream' };

const server = createServer((request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  requests.push(pathname);
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if (file !== root && !file.startsWith(root + '\\') && !file.startsWith(root + '/')) {
    response.writeHead(403).end();
    return;
  }
  let info;
  try { info = statSync(file); } catch { response.writeHead(404).end(); return; }
  if (!info.isFile()) { response.writeHead(404).end(); return; }
  const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
  response.writeHead(range ? 206 : 200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
    ...(range ? { 'content-range': `bytes ${start}-${end}/${info.size}` } : {}),
  });
  createReadStream(file, { start, end }).pipe(response);
});

await new Promise((resolveListen, reject) => server.listen(port, '127.0.0.1', error => error ? reject(error) : resolveListen()));

async function load(path, waitMs) {
  requests.length = 0;
  const profile = mkdtempSync(`${tmpdir()}\\vm-role-test-`);
  const child = spawn(chrome, [
    '--headless', '--disable-gpu', '--no-first-run',
    `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/${path}`,
  ], { stdio: 'ignore', windowsHide: true });
  await new Promise(resolveWait => setTimeout(resolveWait, waitMs));
  child.kill();
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise(resolveWait => setTimeout(resolveWait, 3000))]);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return [...requests];
}

try {
  const undecided = await load('', 2500);
  const host = await load('?role=agent', 6000);
  const guest = await load('?role=human', 2500);
  const expensive = path => /vm-network-ext4\.img|\.litertlm$/i.test(path);
  const result = {
    undecidedRequests: undecided,
    hostRequestedDisk: host.some(path => /vm-network-ext4\.img/i.test(path)),
    guestOpenedRemote: guest.includes('/remote.html'),
    undecidedLoadedHost: undecided.some(expensive),
    guestLoadedHost: guest.some(expensive),
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.undecidedLoadedHost || !result.hostRequestedDisk || !result.guestOpenedRemote || result.guestLoadedHost) process.exitCode = 1;
} finally {
  server.close();
}
