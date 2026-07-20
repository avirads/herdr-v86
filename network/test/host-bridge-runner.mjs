import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const chrome = process.env.CHROME_BIN || 'google-chrome';
let finish;
const completed = new Promise(resolve => { finish = resolve; });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.img': 'application/octet-stream' };
const server = createServer((request, response) => {
  if (request.url === '/__result' && request.method === 'POST') {
    let body = ''; request.on('data', chunk => body += chunk);
    request.on('end', () => { response.writeHead(204).end(); finish(JSON.parse(body)); }); return;
  }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, normalize(pathname.slice(1) || 'index.html'));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  let info; try { info = statSync(file); } catch { return response.writeHead(404).end(); }
  const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = match ? Number(match[1]) : 0;
  const end = match && match[2] ? Number(match[2]) : info.size - 1;
  response.writeHead(match ? 206 : 200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'accept-ranges': 'bytes', 'content-length': end - start + 1, ...(match ? { 'content-range': `bytes ${start}-${end}/${info.size}` } : {}) });
  createReadStream(file, { start, end }).pipe(response);
});
await new Promise(resolve => server.listen(8091, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'v86-host-bridge-'));
const child = spawn(chrome, ['--headless', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, 'http://127.0.0.1:8091/network/test/host-bridge-e2e.html'], { stdio: ['ignore', 'ignore', 'pipe'] });
let errors = ''; child.stderr.on('data', chunk => errors += chunk);
try {
  let timeoutID;
  const timeout = new Promise((_, reject) => { timeoutID = setTimeout(() => reject(new Error('host bridge test timed out')), 150000); });
  const result = await Promise.race([completed, timeout]);
  clearTimeout(timeoutID);
  console.log(JSON.stringify({ ok: result.ok }));
  if (!result.ok) { console.error(result.serial); process.exitCode = 1; }
} catch (error) { console.error(error.message, errors); process.exitCode = 1; }
finally { child.kill(); server.close(); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} }
