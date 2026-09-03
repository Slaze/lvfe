/* Lvfe PWA service worker.
   Shell: cache-first (HTML/CSS/JS/icons under this scope).
   API / cloud save / maps / GIS / tiles: network-first (never stale save). */
const CACHE = "lvfe-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/nord-shell.css",
  "./css/switch.css",
  "./css/lvfe.css",
  "./map-3d.css",
  "./assets/brand/lvfe-mark-512.png",
  "./assets/brand/pwa-icon-192.png",
  "./assets/brand/pwa-icon-512.png",
  "./js/lvfe-assets.js",
  "./js/pwa-register.js",
  "./js/google-auth.config.js",
  "./js/google-auth.js",
  "./js/account.js",
  "./js/save-api.config.js",
  "./js/save-sync.js",
];

function isNetworkFirst(url) {
  const u = String(url || "");
  if (/\/lvfe-save(\/|$)/i.test(u)) return true;
  if (/accounts\.google\.com|googleapis\.com|gstatic\.com/i.test(u)) return true;
  if (/openfreemap|arcgisonline|overpass|osrm|tile|maplibre/i.test(u)) return true;
  if (/paystack/i.test(u)) return true;
  if (/\/v1\//i.test(u)) return true;
  return false;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {
        /* partial shell ok — network fills gaps */
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = req.url;
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        const copy = res.clone();
        if (res.ok && (req.url.indexOf(self.registration.scope) === 0)) {
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      });
    })
  );
});
