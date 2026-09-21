// Généré par build.py — ne pas éditer à la main (cf. commentaire dans build.py, v1.78).
const CACHE_NAME = "socalm-7270b021dae2";
const PRECACHE_URLS = [
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/logo-johan-raiz.png",
  "./css/app.css?v=b80afd81",
  "./index.html",
  "./js/bundle.482fdbd0.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Coquille de l'app (HTML/CSS/JS/assets) : cache d'abord, réseau en secours — alimente aussi
    // le cache au passage pour les requêtes qui n'y étaient pas encore (rare, la précache couvre
    // déjà tout dist/ au moment de l'installation).
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Ressources externes (polices Google Fonts) : sert la version en cache immédiatement si elle
  // existe, tout en la rafraîchissant en arrière-plan pour la prochaine visite ("stale-while-
  // revalidate") — sans cache, attend simplement le réseau (déjà un repli propre en place côté
  // CSS, cf. la pile de polices système sur `html, body` dans app.css).
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
