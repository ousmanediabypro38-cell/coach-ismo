// Service worker : l'application s'ouvre sans réseau. Les fichiers sont servis depuis le cache
// puis rafraîchis en arrière-plan (la mise à jour apparaît au lancement suivant).
const CACHE = "coach-ismo-v18";
const FILES = ["./", "index.html", "app.js", "db.js", "sync.js", "conflicts.js", "calendar.js", "carnet.js", "oussou.js", "venues.js", "matchs.js", "suivi.js", "playbook.js", "importer.js", "icons.js", "barlow-400.woff2", "barlow-500.woff2", "barlow-600.woff2", "barlowc-600.woff2", "barlowc-700.woff2", "style.css", "config.js",
  "supabase-lib.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Supabase : jamais en cache
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
