// Spike S-4 harness server.
//
// Serves the repository twice from one origin:
//   /            plain, no isolation headers  -> models the current v86 page
//   /cx/...      COOP: same-origin + COEP     -> models the planned CheerpX route
//
// Serving the same tree both ways is the point: it shows whether the isolation
// headers, and nothing else, change how the LiteRT stack loads. Range support
// is included because v86 and CheerpX both stream disk images with 206.
//
// Usage: node network/test/cx-isolation-runner.mjs [port] [coep-mode]
//   coep-mode: require-corp (default) | credentialless
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const port = Number(process.argv[2] ?? 8088);
const coep = process.argv[3] ?? 'require-corp';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.img': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    // Everything under /cx/ is the isolated route, matching production nginx.
    const isolated = pathname.startsWith('/cx/') || pathname === '/cx';
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Resolve /cx/<rest> against the real cx/ directory first, so the actual
    // provider page is served; fall back to the repo root so the spike harnesses
    // (/cx/network/test/…) keep working from the same isolated origin.
    let file = path.join(root, pathname);
    if (isolated) {
      const direct = path.join(root, pathname);            // cx/... exists on disk
      const stripped = path.join(root, pathname.replace(/^\/cx\/?/, '/') || '/index.html');
      file = await stat(direct).then(() => direct, () => stripped);
    }
    if (!file.startsWith(root)) { response.writeHead(403).end('forbidden'); return; }

    const info = await stat(file);
    const headers = {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'accept-ranges': 'bytes',
      // CheerpX's HttpBytesDevice REFUSES to initialise without one of these:
      //   "Server didn't include header `Last-Modified` nor header `Etag`"
      // It needs a validator to know the block device did not change underneath
      // it. nginx sends both for static files by default; any server hosting a
      // CheerpX image must do the same.
      'last-modified': info.mtime.toUTCString(),
      etag: `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`,
    };
    if (isolated) {
      headers['cross-origin-opener-policy'] = 'same-origin';
      headers['cross-origin-embedder-policy'] = coep;
    }

    const range = request.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;
      if (start >= info.size || end >= info.size || start > end) {
        response.writeHead(416, { 'content-range': `bytes */${info.size}` }).end();
        return;
      }
      response.writeHead(206, {
        ...headers,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${info.size}`,
      });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, { ...headers, 'content-length': info.size });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(String(error.message));
  }
}).listen(port, () => {
  console.log(`S-4 harness on http://localhost:${port}`);
  console.log(`  plain    http://localhost:${port}/network/test/cx-isolation-e2e.html`);
  console.log(`  isolated http://localhost:${port}/cx/network/test/cx-isolation-e2e.html  (COEP: ${coep})`);
});
