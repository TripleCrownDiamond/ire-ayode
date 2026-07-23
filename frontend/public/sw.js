// Version — changer à chaque déploiement pour vider le cache
const CACHE_VERSION = "v2";
const CACHE_NAME = "ire-ayode-" + CACHE_VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Supprimer TOUS les anciens caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Tout ce qui n'est pas un asset statique : réseau uniquement
  if (request.mode === "navigate" || request.url.includes("/api/") || request.url.includes("/_next/data/")) {
    return;
  }
  // Assets statiques uniquement : cache puis réseau
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
