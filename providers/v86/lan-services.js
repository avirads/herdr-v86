// Browser services published on the guest LAN over real sockets.
//
// These replace what the serial host bridge does today. That bridge base64-encodes
// payloads over the tty, which caps vmfetch at 16 MiB, vmexport at 8 MiB, and runs
// at roughly 11 KB/s; the same work over the tcpip.js LAN measures ~16-25 Mbit/s
// with no size ceiling. Nothing here needs a gateway: the page is the peer.
//
// Two interfaces, because one cannot express everything:
//
//   proxy       An ordinary HTTP proxy. `export http_proxy=http://10.77.0.1:8080`
//               and unmodified curl/wget/apk work, no guest command required.
//               Plain HTTP only -- see the CONNECT note below.
//   /_vm/*      Explicit endpoints for what a proxy cannot express: HTTPS fetches,
//               file export, and the clipboard.
//
// CONNECT is deliberately unimplemented. Tunnelling TLS would require the page to
// terminate it, and a browser cannot open a raw socket to do so. HTTPS therefore
// goes through /_vm/fetch, where the *browser* performs the request and the guest
// receives the decrypted body. The same-origin policy still applies to every
// request made here, exactly as it does to the serial bridge today.

const MAX_HEAD = 64 * 1024;

export async function startLanServices(stack, { port = 8080, onStatus = () => {}, onExport = defaultExport, onClipboardRead, onClipboardWrite } = {}) {
  const listener = await stack.tcp.listen({ port });
  const services = { port, requests: 0, bytesOut: 0, bytesIn: 0 };
  (async () => {
    for await (const connection of listener) {
      handle(connection, services, { onStatus, onExport, onClipboardRead, onClipboardWrite })
        .catch(error => onStatus(`request failed: ${error.message}`));
    }
  })().catch(error => onStatus(`listener stopped: ${error.message}`));
  onStatus(`lan services listening on :${port}`);
  return services;
}

// Reads the request head, then exactly Content-Length bytes of body. Chunked
// request bodies are not accepted; curl and wget both send a length for a file.
async function readRequest(reader) {
  let buffer = new Uint8Array(0);
  let head = null;
  while (!head) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer = concat(buffer, value);
    const end = findHeadEnd(buffer);
    // -1 is truthy, so this comparison has to be explicit or the guard never fires.
    if (end === -1 && buffer.length > MAX_HEAD) throw new Error('request head too large');
    if (end !== -1) {
      head = new TextDecoder().decode(buffer.subarray(0, end));
      buffer = buffer.subarray(end + 4);
    }
  }
  if (!head) throw new Error('connection closed before a request arrived');

  const [requestLine, ...headerLines] = head.split('\r\n');
  const [method, target, version] = requestLine.split(' ');
  const headers = new Map();
  for (const line of headerLines) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  if (String(headers.get('transfer-encoding') || '').includes('chunked')) {
    throw new Error('chunked request bodies are not supported; send Content-Length');
  }
  // Collect the body as a chunk list and join once. Growing a single array per
  // read is O(n^2) copying -- it cost 43s on a 12 MiB upload that the link
  // itself carries in about 4.
  const length = Number(headers.get('content-length') || 0);
  const chunks = [buffer];
  let received = buffer.length;
  while (received < length) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }
  const body = new Uint8Array(Math.min(received, length));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= body.length) break;
    const slice = chunk.subarray(0, Math.min(chunk.length, body.length - offset));
    body.set(slice, offset);
    offset += slice.length;
  }
  return { method, target, version, headers, body };
}

async function handle(connection, services, hooks) {
  const reader = connection.readable.getReader();
  const writer = connection.writable.getWriter();
  const respond = makeResponder(writer, services);
  try {
    const request = await readRequest(reader);
    services.requests++;
    services.bytesIn += request.body.length;
    const url = new URL(request.target, 'http://guest.invalid');

    if (request.method === 'CONNECT') {
      // Be explicit rather than hanging: a tunnel cannot be built from here.
      await respond(501, 'text/plain',
        'CONNECT is not supported: a browser cannot open a raw socket to tunnel TLS.\n' +
        'Use http_proxy for plain HTTP, or GET /_vm/fetch?url=<https url> for HTTPS.\n');
      return;
    }

    // Absolute-form request-target means we are being used as a proxy.
    if (/^https?:\/\//i.test(request.target)) {
      await proxyThrough(request, respond, services);
      return;
    }

    switch (url.pathname) {
      case '/_vm/health':
        await respond(200, 'application/json', JSON.stringify({ ok: true, ...services }) + '\n');
        return;
      case '/_vm/fetch': {
        const target = url.searchParams.get('url');
        if (!target) { await respond(400, 'text/plain', 'usage: /_vm/fetch?url=<absolute url>\n'); return; }
        await proxyThrough({ ...request, target }, respond, services);
        return;
      }
      case '/_vm/export': {
        if (request.method !== 'PUT' && request.method !== 'POST') {
          await respond(405, 'text/plain', 'use PUT or POST with the file as the body\n'); return;
        }
        const name = url.searchParams.get('name') || 'export.bin';
        hooks.onExport(name, request.body);
        await respond(200, 'text/plain', `exported ${request.body.length} bytes as ${name}\n`);
        return;
      }
      case '/_vm/clip': {
        if (request.method === 'GET') {
          if (!hooks.onClipboardRead) { await respond(501, 'text/plain', 'clipboard read unavailable\n'); return; }
          try {
            await respond(200, 'text/plain', await hooks.onClipboardRead());
          } catch (error) {
            await respond(403, 'text/plain', `clipboard read refused: ${error.message}\n`);
          }
          return;
        }
        if (request.method === 'PUT' || request.method === 'POST') {
          if (!hooks.onClipboardWrite) { await respond(501, 'text/plain', 'clipboard write unavailable\n'); return; }
          try {
            await hooks.onClipboardWrite(new TextDecoder().decode(request.body));
            await respond(200, 'text/plain', 'ok\n');
          } catch (error) {
            await respond(403, 'text/plain', `clipboard write refused: ${error.message}\n`);
          }
          return;
        }
        await respond(405, 'text/plain', 'use GET, PUT or POST\n');
        return;
      }
      default:
        await respond(404, 'text/plain',
          'browser LAN services\n\n' +
          '  http_proxy=http://<this address>:' + services.port + '   plain HTTP for any guest tool\n' +
          '  GET  /_vm/fetch?url=<url>                    fetch through the browser (HTTPS included)\n' +
          '  PUT  /_vm/export?name=<name>                 save the body as a browser download\n' +
          '  GET|PUT /_vm/clip                            read or write the browser clipboard\n' +
          '  GET  /_vm/health                             counters\n');
    }
  } finally {
    await writer.close().catch(() => {});
    reader.cancel().catch(() => {});
  }
}

// The browser performs the request, so the guest gets the decrypted body without
// a TLS stack of its own. Streamed chunked, so nothing is buffered whole.
async function proxyThrough(request, respond, services) {
  const forwarded = new Headers();
  for (const [name, value] of request.headers) {
    if (['host', 'connection', 'proxy-connection', 'content-length', 'transfer-encoding'].includes(name)) continue;
    forwarded.set(name, value);
  }
  let response;
  try {
    response = await fetch(request.target, {
      method: request.method === 'GET' || request.method === 'HEAD' ? request.method : request.method,
      headers: forwarded,
      body: request.body.length ? request.body : undefined,
      redirect: 'follow',
    });
  } catch (error) {
    // Overwhelmingly this is the same-origin policy, so say so rather than
    // leaving the guest with an unexplained "failed".
    await respond(502, 'text/plain',
      `browser fetch failed: ${error.message}\n` +
      'A cross-origin target must send permissive CORS headers; the browser blocks it otherwise.\n');
    return;
  }
  await respond(response.status, response.headers.get('content-type') || 'application/octet-stream', response.body, services);
}

function makeResponder(writer, services) {
  const encoder = new TextEncoder();
  return async (status, contentType, body) => {
    if (body && typeof body.getReader === 'function') {
      await writer.write(encoder.encode(
        `HTTP/1.1 ${status} ${statusText(status)}\r\nContent-Type: ${contentType}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n`));
      const reader = body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        await writer.write(encoder.encode(value.length.toString(16) + '\r\n'));
        await writer.write(value);
        await writer.write(encoder.encode('\r\n'));
        services.bytesOut += value.length;
      }
      await writer.write(encoder.encode('0\r\n\r\n'));
      return;
    }
    const payload = encoder.encode(String(body ?? ''));
    services.bytesOut += payload.length;
    await writer.write(encoder.encode(
      `HTTP/1.1 ${status} ${statusText(status)}\r\nContent-Type: ${contentType}\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n`));
    await writer.write(payload);
  };
}

function defaultExport(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes]));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function statusText(status) {
  return { 200: 'OK', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
           501: 'Not Implemented', 502: 'Bad Gateway' }[status] || 'OK';
}

function findHeadEnd(buffer) {
  for (let i = 3; i < buffer.length; i++) {
    if (buffer[i - 3] === 13 && buffer[i - 2] === 10 && buffer[i - 1] === 13 && buffer[i] === 10) return i - 3;
  }
  return -1;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
