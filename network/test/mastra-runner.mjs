// Runner for mastra-e2e.html, modelled on network/test/host-bridge-runner.mjs.
//
//   CHROME_BIN=/usr/bin/google-chrome node network/test/mastra-runner.mjs
//
// Serves the repo root with byte-range support (v86's async disk needs 206
// responses) and waits for the page to POST its result to /__result.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const chrome = process.env.CHROME_BIN || 'google-chrome';
const port = Number(process.env.PORT || 8099);

let finish;
const completed = new Promise(resolve => { finish = resolve; });

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.img': 'application/octet-stream',
  '.bin': 'application/octet-stream',
};

const server = createServer((request, response) => {
  if (request.url === '/__result' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => (body += chunk));
    request.on('end', () => {
      response.writeHead(204).end();
      try {
        finish(JSON.parse(body));
      } catch (error) {
        finish({ ok: false, error: `unparseable result: ${error.message}` });
      }
    });
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, normalize(pathname.slice(1) || 'index.html'));
  if (!file.startsWith(root)) return response.writeHead(403).end();

  let info;
  try {
    info = statSync(file);
  } catch {
    return response.writeHead(404).end();
  }

  const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = match ? Number(match[1]) : 0;
  const end = match && match[2] ? Number(match[2]) : info.size - 1;
  response.writeHead(match ? 206 : 200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
    ...(match ? { 'content-range': `bytes ${start}-${end}/${info.size}` } : {}),
  });
  createReadStream(file, { start, end }).pipe(response);
});

server.listen(port);

const profile = mkdtempSync(join(tmpdir(), 'mastra-e2e-'));
const browser = spawn(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--enable-unsafe-webgpu',
    `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/network/test/mastra-e2e.html`,
  ],
  { stdio: 'ignore' },
);

const result = await completed;

browser.kill();
server.close();
rmSync(profile, { recursive: true, force: true });

for (const step of result.steps ?? []) console.log(`  ${step}`);
if (result.checks) console.log('\nchecks:', JSON.stringify(result.checks, null, 2));
if (result.elapsedMs) console.log(`agent loop: ${result.elapsedMs} ms`);
if (!result.ok) {
  console.error('\nFAILED:', result.error ?? 'assertions did not pass');
  if (result.serial) console.error('\n--- tail of guest serial ---\n' + result.serial.slice(-2000));
  process.exit(1);
}
console.log('\nOK — Mastra agent drove the real guest bridge');
