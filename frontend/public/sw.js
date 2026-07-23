const CACHE_NAME = "ire-ayode-v1";
const STATIC_ASSETS = ["/", "/login", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // API calls: network only
  if (request.url.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }
  // Static assets: cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
