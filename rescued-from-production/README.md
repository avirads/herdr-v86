# Rescued from production

These files were running on `https://fapstaff.com/` but existed in **no git
repository**. They are preserved here verbatim, not merged, because merging them
correctly requires decisions this rescue should not make on its own.

Recovered 2026-08-09 from `root@82.180.132.123:/var/www/herdr-v86/current/` and
`/etc/nginx/snippets/herdr-app.conf`.

## Why this exists

The live release directory is `releases/e39e0c3`. That SHA is **not in
`avirads/herdr-v86`**, whose `main` was `5b5b4ca` at the time of writing — the
same commit this repository was forked from. So production had drifted ahead of
source control, and some of what it served could not be rebuilt from any repo.

## What is here

| file | status |
|---|---|
| `app.webmanifest` | not in any repo |
| `offline.html` | not in any repo |
| `vm-images.json` | production copy, declares a seventh tier (`star`) |
| `herdr-app.conf` | the live nginx snippet, with blocks absent from `network/deploy/fapstaff-peerjs.nginx` |
| `images/vm-star-i386-ext4.img` | the `star` tier image itself |

### The `star` tier

```
All guest features in one image: AI Tools, Dev IDE and seven templates,
Grafana k6 with k6obs, and the self-contained Vaptr scanner.
128 MiB · version 2026.08.03.9
sha256 d8a5f4f675c9fd2f800a40bde9bd3cac954bbd00512d0f406ff294a64e49e51e
```

This one matters most. `network/guest/build-tier-images.sh` knows six tiers —
barebones, essentials, ai-tools, dev, performance, vapt — and **no `star`**. The
build recipe was never committed, so the image could not have been reproduced
from source. It existed only on that disk.

### nginx blocks missing from the repo copy

The live snippet carries `location = /app.webmanifest`, `location = /preview`
and `location /preview/` — none of which appear in
`network/deploy/fapstaff-peerjs.nginx`. (The CheerpX `/cx/preview/` route added
on 2026-08-09 does not collide with the existing `/preview/`.)

## Update 2026-08-09 — the layout divergence is resolved

Production now uses this repository's `images/v86/` layout. The images were moved
server-side (no re-upload), every old flat path was left behind as a symlink so
the hardcoded `../../vm-network-ext4.img` in `network/test/*.html` still resolves,
and `vm-images.json` is a single file at `images/v86/vm-images.json` with a
symlink at the web root. Its `url` fields were rewritten to `images/v86/…`.

Verified afterwards: the v86 page reads `/vm-images.json` and streams
`/images/v86/vm-dev-i386-ext4.img`.

**What is still divergent is the `star` tier**, and only that. Production's
manifest declares seven tiers; this repo's declares six. Adding `star` to
`images/v86/vm-images.json` here would advertise a tier that
`network/guest/build-tier-images.sh` cannot build, so the entry is deliberately
still absent — see step 1 below.

## Deliberately not merged

Dropping these into the tree would be wrong in ways that are easy to miss:

- The `star` tier needs a build recipe in `build-tier-images.sh` before it can be
  maintained rather than merely stored.
- `herdr-app.conf` is the live file including the CheerpX blocks added on
  2026-08-09; reconciling it with `fapstaff-peerjs.nginx` means deciding which is
  canonical.

## Suggested next steps

1. Decide whether `star` should be a supported tier. If so, port its recipe into
   `build-tier-images.sh` and add it to `images/v86/vm-images.json` with the
   `images/v86/` URL prefix.
2. Fold `app.webmanifest` and `offline.html` into the tree (they are PWA assets
   and `service-worker.js` may expect them).
3. Reconcile `herdr-app.conf` with `network/deploy/fapstaff-peerjs.nginx` and pick
   one source of truth.
4. Consider whether `avirads/herdr-v86` should also receive these, since that is
   where they originally belonged.
