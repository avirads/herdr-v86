const APP_SHELL_CACHE = "vmvm-app-shell-v2";
const STATIC_CACHE = "vmvm-static-v2";
const APP_SHELL = [
  "./",
  "./offline.html",
  "./xterm.css",
  "./xterm.js",
  "./assets/vmvm-logo.png",
  "./assets/vmvm-icon-192.png",
  "./assets/vmvm-icon-maskable-512.png",
  "./app.webmanifest",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => /^(?:herdr-app-shell-|vmvm-(?:app-shell|static)-)/.test(name) &&
        name !== APP_SHELL_CACHE && name !== STATIC_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestedUrl = new URL(request.url);
  if (requestedUrl.origin !== self.location.origin || request.headers.has("range")) return;

  // VM disks, model payloads, guest proxies, and live network transports have
  // their own lifecycle. Never let the app-shell worker cache or intercept them.
  if (/\.(?:img|litertlm|task|zip)(?:$|\?)/i.test(requestedUrl.pathname) ||
      /^\/(?:models|downloads|ide|preview|v1|peerjs|plu)(?:\/|$)/.test(requestedUrl.pathname)) return;

  if (request.mode !== "navigate") {
    if (!["script", "style", "image", "font", "manifest"].includes(request.destination)) return;
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const update = fetch(request).then(async response => {
        if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
        return response;
      });
      return cached || update;
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      let source = request;
      for (const documentName of ["guest-tools", "deep-agent"]) {
        if (requestedUrl.pathname.endsWith(`/docs/${documentName}.md`)) {
          source = new URL(`docs/${documentName}.html`, self.registration.scope);
          break;
        }
      }
      const response = await fetch(source, { cache: "no-cache" });
      if (response.ok) {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return await caches.match(request) ||
        await caches.match(new URL("./", self.registration.scope)) ||
        await caches.match(new URL("./offline.html", self.registration.scope));
    }
  })());
});
