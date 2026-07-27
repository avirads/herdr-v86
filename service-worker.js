const APP_SHELL_CACHE = "herdr-app-shell-v1";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("herdr-app-shell-") && name !== APP_SHELL_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;

  event.respondWith((async () => {
    try {
      const requestedUrl = new URL(event.request.url);
      const source = requestedUrl.pathname.endsWith("/docs/guest-tools.md")
        ? new URL("docs/guest-tools.html", self.registration.scope)
        : event.request;
      const response = await fetch(source, { cache: "no-cache" });
      if (response.ok) {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return await caches.match(event.request) || Response.error();
    }
  })());
});
