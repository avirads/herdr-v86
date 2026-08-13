// Live preview for the CheerpX guest, over the RPC bridge instead of TCP.
//
// The v86 dev tier serves its project with `nc -lk -p 3000 -e vmbro-httpd --cgi`
// — a real listening socket. CheerpX has no TCP stack, so that cannot port. What
// does port is the other half of that command: vmbro-httpd's `-cgi` mode is
//
//     -cgi   handle one raw HTTP request on stdin/stdout
//
// which is a stdio contract, not a socket. So every preview request becomes one
// short-lived guest process: write the raw request to a file, run vmbro-httpd
// against it, read the raw response back. No networking involved at any point.
//
// Responses come back through the IDB out-mount rather than through
// guest.execute()'s stdout, deliberately: execute() truncates at 64 KiB and is
// text-only, which would corrupt any image and silently cut long pages.
// readFileAsBlob has neither limit.

const DEFAULT_PROJECT = '/root/project';

/** Split a raw HTTP/1.1 response into status, headers and a body offset. */
export function parseHttpResponse(bytes) {
  // Find the CRLFCRLF that ends the header block, without decoding the body —
  // the body may be binary and must survive untouched.
  let separator = -1;
  for (let i = 0; i + 3 < bytes.length; i += 1) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
      separator = i;
      break;
    }
  }
  if (separator < 0) throw new Error('malformed CGI response: no header terminator');

  const head = new TextDecoder().decode(bytes.subarray(0, separator));
  const [statusLine, ...headerLines] = head.split('\r\n');
  const match = statusLine.match(/^HTTP\/[\d.]+\s+(\d{3})\s*(.*)$/);
  if (!match) throw new Error(`malformed CGI status line: ${statusLine.slice(0, 80)}`);

  const headers = new Headers();
  for (const line of headerLines) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const name = line.slice(0, colon).trim();
    // Hop-by-hop headers describe the guest's imaginary connection, not ours,
    // and Content-Length would be wrong the moment anything re-encodes.
    if (/^(connection|transfer-encoding|content-length|keep-alive)$/i.test(name)) continue;
    try { headers.append(name, line.slice(colon + 1).trim()); } catch { /* skip invalid */ }
  }

  return {
    status: Number(match[1]),
    statusText: match[2] || '',
    headers,
    body: bytes.subarray(separator + 4),
  };
}

export class CheerpXPreview {
  /**
   * @param {object} runtime  from createRuntime()
   * @param {object} guest    CheerpXGuestClient, for building and file access
   */
  constructor({ cx, dataIn, idbOut }, guest, {
    projectDir = DEFAULT_PROJECT,
    root = 'dist',
    // .mjs, not .js, and the extension is the whole point: qjs parses a .js file
    // as a script, and the shim's `import * as std from 'std'` is a syntax error
    // there. See _ensureHandler.
    handler = 'server.mjs',
    runtime = 'qjs',
    uid = 0,
    gid = 0,
    env = ['HOME=/root', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8'],
  } = {}) {
    this.cx = cx;
    this.dataIn = dataIn;
    this.idbOut = idbOut;
    this.guest = guest;
    this.projectDir = projectDir;
    this.root = root;
    this.handler = handler;
    this.runtime = runtime;
    this.uid = uid;
    this.gid = gid;
    this.env = env;
    this.sequence = 0;
    // Dynamic routes: static files are served first and this is the fallback for
    // what they do not cover. Opt-in because it costs a qjs process per request.
    this.dynamic = false;
    this._handlerReady = null;
  }

  /**
   * Make sure a module-mode copy of the handler shim exists.
   *
   * The dev template ships the shim as server.js, and images built before
   * 2026-08-10 contain only that name. qjs decides script-vs-module from the
   * extension, and as a script the shim fails at its first line — `import * as
   * std from 'std'` — long before it reads a request. Copying it to .mjs at
   * runtime fixes existing images without a rebuild; the template now ships
   * .mjs so fresh images need no copy.
   */
  _ensureHandler() {
    this._handlerReady ??= this.guest
      .execute(`cd ${this.projectDir} && [ -f ${this.handler} ] || cp server.js ${this.handler}`)
      .catch(() => {});
    return this._handlerReady;
  }

  _nextId() {
    this.sequence += 1;
    return `p${this.sequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Rebuild the project's server bundle. Returns esbuild's output. */
  async build() {
    const result = await this.guest.execute(
      `cd ${this.projectDir} && mkdir -p ${this.root} && ` +
      `esbuild src/server.ts --bundle --format=esm --platform=neutral --target=es2020 ` +
      `--outfile=${this.root}/server.js 2>&1`,
    );
    return result.replace(/^__V86AGENT_EXIT__\d+\n/, '');
  }

  /**
   * Serve one request from the guest.
   * @param {Request|{method,url,headers}} request
   * @returns {Promise<Response>}
   */
  async handle(request) {
    const url = new URL(request.url, 'http://preview.vmbro.local');
    const id = this._nextId();
    const requestPath = `/vmbro/in/${id}.req`;
    const responsePath = `/vmbro/out/${id}.res`;

    const headerLines = [];
    if (request.headers?.forEach) {
      request.headers.forEach((value, name) => {
        if (!/^(host|connection|content-length)$/i.test(name)) headerLines.push(`${name}: ${value}`);
      });
    }
    const raw =
      `${request.method || 'GET'} ${url.pathname}${url.search} HTTP/1.1\r\n` +
      `Host: preview.vmbro.local\r\n` +
      headerLines.join('\r\n') + (headerLines.length ? '\r\n' : '') +
      `\r\n`;

    // DataDevice.writeFile is string-only, so a binary request body cannot ride
    // this path. Preview traffic is GETs, so that is acceptable for now.
    await this.dataIn.writeFile(`/${id}.req`, raw);

    // No -handler here, ever, even when dynamic is on. That flag is the path
    // that deadlocks -- vmbro-httpd never closes the handler's stdin, so the
    // shim's std.in.readAsString() never returns and the call outlives every
    // timeout above it. Dynamic requests go through _runHandler instead, which
    // runs qjs directly with its stdin redirected from a file. This leg stays
    // purely static: it either finds a file or 404s, quickly.
    const command =
      `cd ${this.projectDir} && ` +
      `vmbro-httpd -cgi -root ${this.root} < ${requestPath} > ${responsePath} 2>/dev/null`;

    const { status } = await this.cx.run('/bin/sh', ['-c', command], {
      env: this.env, cwd: '/', uid: this.uid, gid: this.gid,
    });

    let bytes;
    try {
      const blob = await this.idbOut.readFileAsBlob(`/${id}.res`);
      bytes = new Uint8Array(await blob.arrayBuffer());
    } catch {
      bytes = new Uint8Array(0);
    }
    this._cleanup(id);

    if (!bytes.length) {
      return new Response(
        `vmbro preview: the guest produced no response (vmbro-httpd exited ${status}).`,
        { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }

    try {
      const parsed = parseHttpResponse(bytes);
      // Static first, handler second. Running qjs costs a process per request --
      // hundreds of milliseconds -- so it must not sit in front of every asset.
      // 404 is the handover point, the same one a dev server uses.
      if (parsed.status === 404 && this.dynamic) {
        const dynamic = await this._runHandler(request, url).catch(() => null);
        if (dynamic) return dynamic;
      }
      return new Response(parsed.body, {
        status: parsed.status,
        statusText: parsed.statusText,
        headers: parsed.headers,
      });
    } catch (error) {
      return new Response(`vmbro preview: ${error.message}`, {
        status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  }

  /**
   * Run one request through the QuickJS handler and return a Response, or null
   * if the handler could not answer.
   *
   * This deliberately does NOT go through `vmbro-httpd -handler`. That path
   * deadlocks: the shim reads its envelope with std.in.readAsString(), which
   * returns at EOF, and vmbro-httpd never closes the handler's stdin. Measured
   * on the guest, it outlives both `timeout 25` and the RPC layer's own 120 s
   * wrapper. vmbro-httpd is a stripped Go binary with no source in this repo,
   * so the fix cannot live there.
   *
   * Redirecting stdin from a *file* sidesteps it entirely — a file is at EOF
   * immediately, which is exactly what the shim is waiting for. The shim already
   * prints {status, headers, body} as JSON, so nothing else has to change.
   */
  async _runHandler(request, url) {
    await this._ensureHandler();
    const id = this._nextId();

    const headers = {};
    if (request.headers?.forEach) {
      request.headers.forEach((value, name) => {
        if (!/^(host|connection|content-length)$/i.test(name)) headers[name] = value;
      });
    }
    const envelope = JSON.stringify({
      method: request.method || 'GET',
      path: url.pathname,
      query: url.search.replace(/^\?/, ''),
      headers,
      body: null, // DataDevice.writeFile is string-only; preview traffic is GETs
    });

    await this.dataIn.writeFile(`/${id}.env`, envelope);
    // The in-guest timeout is not belt-and-braces. A handler that hangs holds
    // the RPC queue, and the queue is serial: one stuck request freezes the
    // whole IDE, not just the preview.
    const command =
      `cd ${this.projectDir} && timeout 30 ${this.runtime} ${this.handler} ` +
      `< /vmbro/in/${id}.env > /vmbro/out/${id}.out 2>/vmbro/out/${id}.err`;

    const { status } = await this.cx.run('/bin/sh', ['-c', command], {
      env: this.env, cwd: '/', uid: this.uid, gid: this.gid,
    });

    let text = '';
    try {
      const blob = await this.idbOut.readFileAsBlob(`/${id}.out`);
      text = await blob.text();
    } catch { /* no output */ }

    let stderr = '';
    if (!text.trim()) {
      try { stderr = (await (await this.idbOut.readFileAsBlob(`/${id}.err`)).text()).trim(); }
      catch { /* none */ }
    }
    this._cleanupHandler(id);

    if (!text.trim()) {
      if (!stderr && status === 0) return null; // nothing to say: let the caller 404
      return new Response(
        `vmbro preview: the handler produced no response (exit ${status}).\n\n${stderr}`,
        { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      return new Response(`vmbro preview: handler emitted non-JSON:\n\n${text.slice(0, 2000)}`,
        { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(parsed.headers ?? {})) {
      // Same reasoning as parseHttpResponse: these describe a connection that
      // does not exist here, and content-length stops being true on re-encode.
      if (/^(connection|transfer-encoding|content-length|keep-alive)$/i.test(name)) continue;
      try { responseHeaders.append(name, value); } catch { /* skip invalid */ }
    }
    return new Response(parsed.body ?? '', {
      status: parsed.status ?? 200,
      headers: responseHeaders,
    });
  }

  _cleanupHandler(id) {
    this.cx.run('/bin/sh', ['-c',
      `rm -f /vmbro/in/${id}.env /vmbro/out/${id}.out /vmbro/out/${id}.err`,
    ], { env: this.env, cwd: '/', uid: this.uid, gid: this.gid }).catch(() => {});
  }

  _cleanup(id) {
    this.cx.run('/bin/sh', ['-c', `rm -f /vmbro/in/${id}.req /vmbro/out/${id}.res`], {
      env: this.env, cwd: '/', uid: this.uid, gid: this.gid,
    }).catch(() => {});
  }
}
