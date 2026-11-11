// Service worker : met l'application en cache pour qu'elle s'ouvre sans réseau.
const CACHE = "coach-ismo-v1";
const FILES = ["./", "index.html", "app.js", "style.css", "config.js",
  "vendor/supabase.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Supabase : jamais en cache
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
