/* Lvfe PWA service worker.
   HTML/CSS/JS/manifest: network-first (avoid stale Nord chrome + menus).
   Images/icons: cache-first.
   API / cloud save / maps / GIS / tiles: network-first (never stale save). */
const CACHE = "lvfe-shell-v6";
const SHELL = [
  "./",
  "./index.html",
  "./install.html",
  "./manifest.webmanifest",
  "./css/nord-shell-v2.css",
  "./css/switch.css",
  "./css/lvfe.css",
  "./map-3d.css",
  "./assets/brand/lvfe-mark-512.png",
  "./assets/brand/pwa-icon-192.png",
  "./assets/brand/pwa-icon-512.png",
  "./js/lvfe-assets.js",
  "./js/pwa-register.js",
  "./js/pwa-install.js",
  "./js/google-auth.config.js",
  "./js/google-auth.js",
  "./js/account.js",
  "./js/local-factions.js",
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
  /* Shell mutables — never stick on an old Nord theme / menu HTML. */
  if (/\.(?:css|html|js|webmanifest)(?:\?|$)/i.test(u)) return true;
  if (/\/lvfe\/?(?:\?|$|#)/i.test(u)) return true;
  return false;
}

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok && req.method === "GET") {
      const copy = res.clone();
      caches.open(CACHE).then(function (cache) {
        try { cache.put(req, copy); } catch (err) { /* opaque / quota */ }
      });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    });
  });
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

self.addEventListener("message", function (event) {
  const data = event && event.data;
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = req.url;
  if (isNetworkFirst(url) || req.mode === "navigate") {
    event.respondWith(networkFirst(req));
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
