# Migrating the v86 site off fapstaff.com

A runbook for moving the **v86 deployment** to a new host (written against
exe.dev, but only §1 is specific to it). CheerpX is deliberately out of scope:
`/cx/`, its disk image and its vendored engine are not migrated, which removes
the cross-origin isolation requirements entirely and about 450 MB of transfer.

**Read §0 first.** The most expensive mistake available here is deploying this
repository over the live tree.

---

## 0. Production is not this repository

The live site carries code that exists in no git repo, and this has already
caused one outage during development:

| on the server | in this repo |
|---|---|
| `index.html` — 122,502 bytes, wires up `cline-agent.js` | 114,411 bytes, no Cline at all |
| `cline-agent.js`, `vmagent-controller.js` at the web root | absent |
| `network/browser/{v86-host-bridge,llm-provider-router}.js` | `providers/v86/`, `shared/` — different layout, and the live router has a `copilot` provider this repo lacks |
| `star` tier in `vm-images.json` + its image | six tiers, no `star`, no build recipe |
| `app.webmanifest`, `offline.html` | see `rescued-from-production/` |

**So the migration copies the live tree. It does not build from git.** Treat the
current server as the source of truth for the web root, and this repository as
the source of truth for the nginx config, the image build scripts and the guest
tooling.

---

## 1. Prove the new host is faster before moving anything

**Measure from somewhere other than your own machine.** This step exists because
getting it wrong sent this project down a false trail: fapstaff.com appeared to
serve at 24 KB/s and was written up as an egress collapse, which motivated the
whole migration. Measured later from a third-party VM it served at **3.7 MB/s
with a 0.58 s TTFB**. The origin was healthy the entire time; the slow number
came from one client's network path.

One client is not a measurement. Test from at least two unrelated networks, and
treat a slow result as unproven until a second vantage point agrees.

```bash
# on the new host
head -c 8388608 /dev/urandom > /var/www/speedtest.bin

# from your machine
curl -o /dev/null -r 0-8388607 \
  -w 'egress: %{speed_download} B/s  ttfb: %{time_starttransfer}s\n' \
  https://NEW_HOST/speedtest.bin
```

Below ~500 KB/s from multiple vantage points, do not migrate — a 208 MB dev
image is unusable and you will have moved for nothing. Delete the file
afterwards.

And compare like with like: run the same test against the *current* host from
the same clients. Migrating to escape a bandwidth problem the origin does not
have costs money and changes nothing.

Also check the plan's egress allowance against real usage: the dev image alone is
208 MB per cold boot, and every image version bump re-downloads for every user.
exe.dev meters at 200 GB/month on Personal, then $0.05/GB.

---

## 2. What has to exist on the new host

Inventoried from the running server, excluding services that belong to other
projects sharing the box (`tomcat10`, `guacd`, `openobserve`, `interactsh-server`).

| component | port | notes |
|---|---|---|
| nginx | 80, 443 | config in `network/deploy/fapstaff-peerjs.nginx` |
| `v86net-gateway` | 127.0.0.1:8086 | Go binary; admin token file |
| `dnsmasq` | 10.77.0.1:53 | DNS for the guest network |
| PeerJS | 127.0.0.1:9000 | remote-control signalling |
| `/plu/` proxy | 127.0.0.1:8081 | python3 |

Disk: the six v86 images are ~950 MB together, and each tier now carries 64 MiB
of headroom, so budget for growth.

---

## 3. Order of operations

### 3.1 Base

```bash
apt update && apt install -y nginx dnsmasq python3 certbot python3-certbot-nginx
```

### 3.2 Copy the web root

From a machine that can reach both hosts. Two flags matter.

`-H` preserves hard links: `vm-dev-i386-ext4.img` and
`images/v86/vm-dev-i386-ext4.img` are one inode, and without it every image is
copied twice.

`--exclude` keeps CheerpX out, which is the point of this scope.

```bash
rsync -aHz --info=progress2 \
  --exclude 'cx/' --exclude 'images/cheerpx/' --exclude 'vendor/cheerpx/' \
  root@OLD_HOST:/var/www/herdr-v86/ \
  root@NEW_HOST:/var/www/herdr-v86/
```

Verify the hard links survived — if the count reads 1, the images just doubled
in size:

```bash
ssh root@NEW_HOST 'stat -c "%h %n" /var/www/herdr-v86/current/vm-dev-i386-ext4.img'
# expect 2
```

### 3.3 The gateway

```bash
install -m 0755 v86net-gateway /usr/local/bin/
install -d -m 0700 /etc/v86net
head -c 48 /dev/urandom | base64 > /etc/v86net/admin.token
chmod 600 /etc/v86net/admin.token
```

**The origin allow-list must name the new domain.** This is the easiest thing to
miss: the page mints its own session by POSTing to `/v1/sessions`, which the
gateway only permits for an allow-listed `Origin`. Leave the old domain here and
networking fails with a bare 401 that never mentions origins.

```ini
# /etc/systemd/system/v86net-gateway.service
[Service]
ExecStart=/usr/local/bin/v86net-gateway \
  -listen 127.0.0.1:8086 \
  -admin-token-file /etc/v86net/admin.token \
  -allow-origin https://NEW_DOMAIN \
  -allow-origin-sessions
Restart=always
```

The `-backend native -tap v86tap0` flags the old host uses are an optimisation.
The default backend is `userspace`, a pure-Go gVisor stack needing no TUN device
and no privileges — start there, and only add the TAP setup if throughput
demands it.

### 3.4 nginx

Copy `network/deploy/fapstaff-peerjs.nginx`, replace the server names, and issue
certificates. **Drop the `/cx/`, `= /cx/preview-sw.js`, `/images/cheerpx/` and
`/vendor/cheerpx/` blocks** — without CheerpX there is nothing to isolate, and
the COOP/COEP headers are the part most likely to break the v86 page if
misapplied (`require-corp` on `/` breaks PeerJS chat, the Moonshine voice model
and the AutoBro bridge, none of which send CORP headers).

What still matters:

1. **`/images/v86/` must keep its `Cache-Control: public, max-age=31536000,
   immutable`.** The images are immutable per version — `index.html` appends
   `?v=<version>` — and they carried no cache headers at all until 2026-08-11.
2. **Range and validators must survive.** v86 boots the disk with `async: true`,
   which streams over 206, and the page's Range preflight decides between normal
   and compatibility boot. nginx does the right thing by default; just do not add
   anything that strips `Content-Length`, `ETag` or `Last-Modified`.
3. **`http2 on;`** — less critical than it was for CheerpX (v86 fetches its image
   in bulk rather than as hundreds of small ranges) but keep it.
4. **Nothing but real config in `sites-enabled/`** — `nginx.conf` includes
   `sites-enabled/*` with no extension filter, so a stray `.bak` is parsed as a
   second `server` block for the same names. Keep backups in
   `/root/nginx-backups/`.

### 3.5 DNS cutover

Drop the TTL to 300 s a day ahead, then move the record. Keep the old host
running until the new one is verified — rollback is a DNS change, not a rebuild.

---

## 4. Verify before cutting over

`--resolve` runs these against the new host before DNS moves.

```bash
H=NEW_DOMAIN; IP=NEW_IP

# HTTP/2 negotiated
curl -s -o /dev/null -w '%{http_version}\n' --resolve $H:443:$IP https://$H/

# images: ranges, validators, and the immutable cache header
curl -sI --resolve $H:443:$IP https://$H/images/v86/vm-dev-i386-ext4.img \
  | grep -iE 'content-length|accept-ranges|last-modified|etag|cache-control'
curl -s -o /dev/null -w '%{http_code}\n' -r 0-1023 \
  --resolve $H:443:$IP https://$H/images/v86/vm-dev-i386-ext4.img     # expect 206

# both paths serve the same file (flat and images/v86 are hard links)
for p in /vm-dev-i386-ext4.img /images/v86/vm-dev-i386-ext4.img; do
  curl -sI --resolve $H:443:$IP "https://$H$p" | awk '/[Cc]ontent-[Ll]ength/{print}'
done

# manifest size must equal the real file byte for byte
curl -s --resolve $H:443:$IP https://$H/vm-images.json | python3 -c '
import sys,json
for t,e in json.load(sys.stdin)["tiers"].items(): print(t, e["size"], e["url"])'

# the gateway mints a session for the NEW origin
curl -s -X POST --resolve $H:443:$IP https://$H/v1/sessions \
  -H 'Content-Type: application/json' -H "Origin: https://$H" \
  -d '{"ttlSeconds":3600}' -w '\n%{http_code}\n'                     # expect 201
```

A manifest size that disagrees with the file is not cosmetic: `index.html`
compares it against the Range preflight's `content-range` total and silently
falls back to compatibility boot, costing every user the slow path with no
visible error.

Then load the site and confirm:

- the dev tier boots and reaches a shell prompt
- the header shows `network: connected` — that is the gateway session working
- `vmllm "hi"` answers, which proves the browser RPC bridge end to end

---

## 5. Rollback

Point DNS back. Nothing on the old host is modified by any step above, so this
is complete and immediate once the TTL expires. Keep it running for a week.

---

## 6. Not solved by moving

- **`/ide/` needs a live tab.** It proxies to `10.77.0.15:3000`, which exists
  only while someone has the VMVM page open — that page owns the emulator and its
  network tunnel. It 502s otherwise, on any host.
- **One guest address.** `10.77.0.15` is hardcoded, so two concurrent guests
  collide. Per-session addressing is separate work.
- **Egress becomes metered rather than throttled.** Better, but not free.

---

## 6a. Serving an image from a different origin

If a tier's `url` points at another host — ai-tools is served from exe.dev — the
disk fetch becomes cross-origin, and two things must be right or the page fails
in ways that look like something else entirely.

**Answer the CORS preflight, and do not enumerate the allowed headers.** The
browser sends `OPTIONS` before the range requests. nginx has no `OPTIONS`
handler by default and replies `405`, so the preflight fails, the real requests
are never sent, the guest never gets a disk, and the boot bar stalls at 90% with
no error the page can name. Note that `curl` does not preflight, so every manual
check passes while the page cannot load the image at all.

Answering it is not enough on its own: v86 sets `X-Accept-Encoding: identity` on
every disk XHR so no proxy can gzip a range response, and an `Allow-Headers`
list that names `Range` and the conditional headers but not that one fails the
whole preflight just as hard. Send the wildcard. It is legal here because this
origin is `Allow-Origin: *` with no credentials, so there is nothing to guess at.

**Keep `Max-Age` short.** A preflight answer is cached per URL, and a wrong one
is cached exactly as long as a right one -- with `86400` a bad deploy is pinned
on every client that saw it for a day, and the fix cannot reach them. Ten
minutes costs one extra `OPTIONS` per image per ten minutes.

**Expose `Content-Range`.** It is not a CORS-safelisted response header, and
`index.html` reads it to compare the disk size against the manifest. Cross-origin
that read returns null unless the host exposes it, which silently downgrades
every boot to ATA PIO compatibility mode -- the opposite failure to the two
above, which block outright.

```nginx
location /images/v86/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        add_header Access-Control-Max-Age 600 always;
        add_header Content-Length 0 always;
        return 204;
    }
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Expose-Headers "Content-Range, Content-Length, Accept-Ranges, ETag, Last-Modified" always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    default_type application/octet-stream;
    try_files $uri =404;
}
```

Verify with the preflight the browser actually sends -- both headers, not just
`Range`:

```bash
curl -si -X OPTIONS -H 'Origin: https://YOUR_PAGE_HOST' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: range,x-accept-encoding' \
  https://IMAGE_HOST/images/v86/vm-ai-tools-i386-ext4.img | head -1   # expect 204
```

Better still, load the page in a browser and read the console. Nothing else
reproduces what the browser does, and the console names the exact header the
preflight rejected -- which is the whole diagnosis in one line.

On the page host, serve `vm-images.json` with `Cache-Control: no-cache`. The
version in it is the cache key for the disk bytes *and* for the preflight, so a
heuristically-cached manifest keeps clients pinned to the old URL and a corrected
preflight is never requested.

The image host must also be **https**: the page is served over https, so an
http disk fetch is blocked as mixed content.

---

## 7. Put a CDN in front

This is what makes origin bandwidth stop mattering, and it is worth doing on
whichever host you land on. The origin side is already done: `/images/v86/`
advertises `Cache-Control: public, max-age=31536000, immutable`, which is safe
forever because the version is in the URL.

**Front the whole origin, not just `/images/`.** v86 loads its files strictly in
order -- `bios`, `vga_bios`, `hda`, then `bzimage` -- and each waits for the one
before it. `bzImage-network` is 7.6 MB and sits on the same critical path as the
disk, so a client that cannot pull from the origin quickly stalls on the kernel
and never reaches a single Range request. Moving only the disk to a faster host
does not fix that, and the symptom is identical either way: 90%, forever, with
nothing in the console.

Measured 2026-08-11 from one client, same minute, same machine:

| target | throughput |
| --- | --- |
| jsdelivr CDN | 3.4 MB/s |
| fapstaff.com origin | 3.8 KB/s |
| vmbro.exe.xyz origin | 44 KB/s |
| fapstaff.com, measured *from* the exe.dev VM | 2.9 MB/s |

Both origins served that client ~1000x slower than a CDN did while both were
healthy from elsewhere -- so this is a path problem, and a CDN edge is the only
part of it under our control. The last row is the control: without a
third-vantage measurement the obvious reading is "the origin is broken", and
that reading has been wrong every time it has come up in this migration.

1. Proxy the zone (orange cloud).
2. Add a **Cache Rule** for `/images/*`. Cloudflare caches by file extension and
   `.img` is not in its default list, so without a rule the large files stay
   uncached and nothing improves.
3. **Bypass** cache for `/v1/*`, `/peerjs/*`, `/ide/*`, `/plu/*` and HTML. The
   first two are WebSockets, `/ide/` proxies into a live guest, and `index.html`
   is deliberately `no-cache` so deploys are visible.
4. Confirm 206 still works through the edge — it should, since nginx sends
   `Content-Length`, and Range is how v86 reads its disk:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -r 0-1023 \
     https://HOST/images/v86/vm-dev-i386-ext4.img          # expect 206
   ```

5. Check `cf-cache-status` on a second request: `MISS` then `HIT`. A file that
   never reaches `HIT` is missing its Cache Rule — every v86 image is well under
   the 512 MB per-object cache limit, so size is not a constraint here.
