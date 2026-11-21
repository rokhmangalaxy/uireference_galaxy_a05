// Service worker: cache-first for the app shell so the player works with the
// network switched off. ROMs are NOT cached here — they live in IndexedDB.
const CACHE = "gunnac-__BUILD__";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./emulator.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./roms/test.nes",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll fails as a whole if one file is missing; do them individually.
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          // Cache same-origin static assets as they're fetched.
          if (res.ok && /\.(js|css|png|svg|webmanifest|html|nes)$/.test(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
