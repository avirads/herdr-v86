// Service worker backing the CheerpX live preview.
//
// The iframe needs real, navigable URLs — relative links, stylesheets and images
// must resolve — so the page cannot just inject HTML into a blob URL. But the
// content lives in a guest with no TCP stack.
//
// This worker therefore owns the URL space and nothing else: the page renders
// each file through `vmbro-httpd -cgi` and writes the result into Cache Storage,
// and the worker simply serves what it finds there.
//
// An earlier version asked the page to serve every request live over a
// MessageChannel. It was the more elegant design and it did not work: the page
// received no messages at all, so each request sat until its timeout. Cache
// Storage is shared state rather than a rendezvous, so there is nothing to
// synchronise and no round trip on the hot path. This is the "static-export
// mirror" the plan predicted would be needed once socket portals proved
// unavailable — dynamic routes are the cost, and they were already unavailable.

const CACHE = 'vmbro-preview';
const PREFIX = '/cx/preview/';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function serve(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);

  // Directory-style URLs map to their index document, as a static host would.
  const candidates = [url.pathname];
  if (url.pathname.endsWith('/')) candidates.push(`${url.pathname}index.html`);
  else candidates.push(`${url.pathname}/index.html`);

  for (const candidate of candidates) {
    const hit = await cache.match(new URL(candidate, url.origin).href);
    if (hit) return hit;
  }

  const listing = (await cache.keys())
    .map(request => new URL(request.url).pathname.slice(PREFIX.length))
    .filter(Boolean)
    .sort();

  return new Response(
    `<!doctype html><meta charset="utf-8">
     <style>body{font:14px system-ui;margin:2rem;color:#c9d1d9;background:#0d1117}
            code{color:#79c0ff} li{margin:.2rem 0}</style>
     <h2>Nothing cached for <code>${url.pathname}</code></h2>
     <p>Press <b>Build</b> in the toolbar to render the project from the guest.</p>
     ${listing.length ? `<p>Currently available:</p><ul>${listing.map(p => `<li><a href="${PREFIX}${p}">${p}</a></li>`).join('')}</ul>` : ''}`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(PREFIX)) return;
  event.respondWith(serve(event.request));
});
