# Deploying vmbro to fapstaff.com

There is no deploy automation in this repository, and this document does not add
any — it records what the deployment actually consists of, so the manual steps
are repeatable and the CheerpX-specific requirements are not rediscovered each
time.

Production serves from `/var/www/herdr-v86/current` behind
`network/deploy/fapstaff-peerjs.nginx`. That config file is the real one and is
covered by `network/test/fapstaff-nginx.test.mjs`, so changes to it are testable
before they reach the server.

**Policy, unchanged:** GitHub Pages stays disabled. Pushing source to GitHub does
not authorise a Pages deployment, and nothing here should enable, trigger or
rebuild one.

## 1. Publish the static tree

Everything except the disk images is ordinary static content:

```
index.html  cx/  providers/  shared/  agent/dist/  llm/  vendor/  docs/
vendor/cheerpx/1.3.7/   <- all 7 files, or /cx/ cannot start
xterm.js  xterm.css  libv86*.js  v86-network.wasm  seabios.bin  vgabios.bin
bzImage-network  images/v86/
```

`agent/node_modules/` and `models/` are build/runtime inputs, not deployables.

**The v86 `.img` files are no longer in git.** They are build artifacts, like the
CheerpX `.ext2`, and are rebuilt with `network/guest/build-tier-images.sh` and
published by uploading. They were tracked until 2026-08-11, when adding zot took
the dev image to 120 MB and GitHub refused the push — its hard file limit is
100 MB. A fresh clone therefore has `images/v86/vm-images.json` but no images.

### Server-side conventions you can rely on

Two things about the live server were tidied on 2026-08-09 and are worth knowing
before editing anything there.

**nginx config.** `sites-enabled/fapstaff.com` is now a symlink to
`sites-available/fapstaff.com`, like every other site on the box. It previously
was not — it was a regular file, and the copy in `sites-available` was a stale
2.7 KB version nginx never read. Edit `sites-available`; that is now the real
one. Note that `nginx.conf` includes `sites-enabled/*` with no extension filter,
so **any** file left there is live config: a `.bak` in that directory was being
parsed as a second `server` block for the same names. Keep backups in
`/root/nginx-backups/`.

**Disk images.** The v86 images live in `images/v86/`, matching this repo. They
used to sit flat at the web root. Every old flat path is preserved as a symlink
(`vm-dev-i386-ext4.img -> images/v86/vm-dev-i386-ext4.img`) because the e2e pages
under `network/test/` hardcode `../../vm-network-ext4.img` and would otherwise
break. `vm-images.json` is one real file at `images/v86/vm-images.json` with a
symlink at the web root, since `index.html` fetches `./vm-images.json` — one
manifest, two paths, no second copy to drift.

The `url` fields are relative to the **page**, not the manifest, so they read
`images/v86/…` regardless of which path served the manifest.

## 2. Build and publish the CheerpX image

`.ext2` images are gitignored build artifacts, so a fresh clone has none. The
CheerpX page detects this and prints the build command rather than failing
obscurely, but `/cx/` will show that message until an image is served.

```bash
sh images/cheerpx/build-ext2.sh          # needs Linux or WSL: mke2fs + fakeroot
```

Then copy the result to `images/cheerpx/` on the server and update
`images/cheerpx/cx-images.json` with its size and sha256. The manifest already
records that the hash identifies one published artifact rather than a
reproducible function of the inputs — `mke2fs` embeds a random filesystem UUID.

Two build invariants are enforced by the script and must not be relaxed: 4096
byte blocks and 128 byte inodes. CheerpX rejects anything else, and only at boot,
as `Linux.create` never settling.

## 3. Apply the nginx config

`/cx/` must be cross-origin isolated or CheerpX cannot start — it needs
`SharedArrayBuffer`. The isolation is scoped to that location deliberately:
`COEP: require-corp` on `/` would break the v86 page's PeerJS remote chat, the
Moonshine voice model and the AutoBro extension bridge, none of which send CORP
headers.

Three blocks matter, all present in `fapstaff-peerjs.nginx`:

| location | why |
|---|---|
| `/cx/` | COOP `same-origin` + COEP `require-corp` |
| `= /cx/preview-sw.js` | `Service-Worker-Allowed: /cx/`, so the worker can control `/cx/preview/` |
| `/images/cheerpx/` | long-lived cache, `application/octet-stream` |

`HttpBytesDevice` refuses to initialise unless the image response carries
`Last-Modified` or `ETag`, and it streams the image with Range requests. nginx
emits both for static files and supports 206 by default, so this needs no extra
directives — only that nothing strips them.

## 4. Verify after deploying

```bash
# isolation on /cx/ and NOT on /
curl -sI https://fapstaff.com/cx/    | grep -i cross-origin      # both headers
curl -sI https://fapstaff.com/       | grep -ci cross-origin      # expect 0

# the image streams
curl -sI https://fapstaff.com/images/cheerpx/vmbro-debian-i386.ext2 \
  | grep -iE 'last-modified|etag|accept-ranges'
curl -s -o /dev/null -w '%{http_code}\n' -r 0-1023 \
  https://fapstaff.com/images/cheerpx/vmbro-debian-i386.ext2        # expect 206
```

Then open `/cx/` and confirm the diagnostics panel reports
`crossOriginIsolated: true` and `SharedArrayBuffer: function`. If the boot
overlay stops at 60% with "Invalid disk image", the image was built with the
wrong block or inode size.

## HTTP/2 is required, not optional

The TLS server block must carry `http2 on;`. This is the single change that made
`/cx/` usable on fapstaff.com, and it is worth understanding why, because the
symptom looks like something else entirely.

CheerpX streams its disk as hundreds of small Range requests. On HTTP/1.1 those
queue behind roughly six connections per origin, and each new connection pays a
fresh TCP and TLS handshake — about 2.7 s on this host, whose round-trip time is
~1.2 s. Measured before and after, with nothing else changed:

| | HTTP/1.1 | HTTP/2 |
|---|---|---|
| ALPN | `http/1.1` | `h2` |
| Boot | 32,337 ms | 92 ms (warm cache) |
| Steady-state guest command | never returned within 60 s | 76–128 ms |
| Median per-request latency | ~4.4 s | ~4.4 s — **unchanged** |

Per-request latency does not move. HTTP/2 buys **concurrency, not speed**: the
same slow requests now multiplex over one connection instead of serialising.

Two things this does not fix. A genuinely cold first visit still pays for every
uncached block — the 92 ms boot above benefited from blocks already in the IDB
overlay, and the first command after a cold boot still took 20 s. And the ~1.2 s
round-trip time is untouched; fixing that needs a CDN in front (which would also
terminate TLS closer to users) or hosting nearer them. The box itself is not the
problem: it idles at 0.00 load on 1 vCPU.

Diagnosing this is quick if it regresses:

```bash
openssl s_client -alpn h2,http/1.1 -connect fapstaff.com:443 \
  -servername fapstaff.com </dev/null 2>/dev/null | grep -i ALPN   # expect h2
curl -s -o /dev/null -w '%{http_version}\n' --http2 https://fapstaff.com/cx/index.html
```

## Known limits at the time of writing

- **Dynamic routes do not work.** Preview renders static output only, so
  `/api/*` in the dev template answers on the v86 page and 404s here. The guest
  has no network stack — every `bind()` fails — so a listening dev server is not
  an option either. See IMPLEMENTATION-PLAN.md §5.1c.

  Measured on the guest 2026-08-09, because the original one-line diagnosis was
  only half the story and the half it named was not the half that bites first:

  | invocation | result |
  |---|---|
  | `qjs dist/server.js` | `SyntaxError: unsupported keyword: export` in 0.4 s |
  | `qjs -m dist/server.js` | clean, RC=0, 0.6 s |
  | `qjs dist/server.mjs` | clean, RC=0 — `.mjs` selects module mode by itself |
  | `vmbro-httpd -cgi -handler <missing>` | clean 500 in 1.2 s |
  | `vmbro-httpd -cgi -handler server.mjs` | **hangs**, survives `timeout 25` |

  So there are two faults stacked, and the first hides the second. The handler
  shim (`dev-template/server.js`) opens with `import * as std from 'std'` and the
  bundle ends with `export default app`; run as a *script*, which is what a `.js`
  extension selects, qjs rejects both at parse time. Fixing that only gets far
  enough to reach the real deadlock: the shim reads its request envelope with
  `std.in.readAsString()`, which returns at EOF, and `vmbro-httpd` does not close
  the handler's stdin.

  **`vmbro-httpd` has no source in this repository** — `network/guest/bin/vmbro-httpd`
  is a 7 MB stripped, statically linked i386 Go binary — so the deadlock cannot
  be fixed where it lives.

  The way round it does not need that source: invoke the shim directly from
  `CheerpXPreview.handle` instead of through `-handler`, with the envelope
  redirected from a *file*. A file gives EOF immediately, which is exactly what
  the shim is waiting for, and the shim already prints `{status, headers, body}`
  as JSON for `handle()` to turn into a Response. `qjs … < file` was measured
  above returning in well under a second.
- **Licensing:** CheerpX is free for personal projects and evaluation. fapstaff.com
  is a public deployment, and `vendor/cheerpx/` now **redistributes** Leaning's
  runtime from our own origin rather than merely loading it from theirs — a
  different thing to be licensed for. Confirm terms with Leaning Technologies
  before treating `/cx/` as production.
