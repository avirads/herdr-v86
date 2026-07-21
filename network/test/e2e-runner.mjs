import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const index = value.indexOf('=');
  return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)];
}));
const root = resolve(args['--root'] || join(import.meta.dirname, '..', '..'));
const gateway = args['--gateway'];
const token = args['--token'];
const chrome = args['--chrome'] || process.env.CHROME_BIN || 'google-chrome';
const port = Number(args['--port'] || 8090);
if (!gateway || !token) throw new Error('--gateway and --token are required');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.img': 'application/octet-stream', '.bin': 'application/octet-stream' };
let finish;
const completed = new Promise(resolve => { finish = resolve; });
const server = createServer((request, response) => {
  if (request.url === '/__result' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      const result = JSON.parse(body);
      response.writeHead(204).end();
      finish(result);
    });
    return;
  }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if (file !== root && !file.startsWith(root + '\\') && !file.startsWith(root + '/')) {
    response.writeHead(403).end(); return;
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
await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', error => error ? reject(error) : resolve()));

const fragment = new URLSearchParams({ gateway, token });
const url = `http://127.0.0.1:${port}/network/test/e2e.html#${fragment}`;
const profile = mkdtempSync(join(tmpdir(), 'vm-e2e-'));
const child = spawn(chrome, [
  '--headless', '--disable-gpu', '--no-first-run',
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
  `--user-data-dir=${profile}`, url,
], { stdio: ['ignore', 'pipe', 'pipe'] });
let browserError = '';
child.stderr.on('data', chunk => browserError += chunk);
let timeoutID;
const timeout = new Promise((_, reject) => {
  timeoutID = setTimeout(() => reject(new Error('v86 test timed out')), 150000);
});
try {
  const result = await Promise.race([completed, timeout]);
  console.log(JSON.stringify({ ...result, serial: undefined }, null, 2));
  if (!result.ok) {
    console.error(result.serial);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message, browserError);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutID);
  child.kill();
  if (child.exitCode === null) {
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  server.close();
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`could not remove temporary Chrome profile ${profile}: ${error.message}`);
  }
}
