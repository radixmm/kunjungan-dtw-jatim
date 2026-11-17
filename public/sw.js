// Service worker Paspor Wisata Jatim: halaman check-in tetap terbuka saat sinyal lemah/hilang.
// - Aset statis Next.js: cache-first.
// - Halaman /c/*, /paspor: network-first, jatuh ke salinan cache bila offline.
// Pengiriman data offline ditangani di halaman (antrean localStorage), bukan di sini.
const CACHE = "pwj-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; })));
    return;
  }
  if (req.mode === "navigate" && (url.pathname.startsWith("/c/") || url.pathname === "/paspor")) {
    e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(url.pathname, { ignoreSearch: true })).then((hit) => hit || new Response(
        "<meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font-family:sans-serif;padding:24px'><h2>Tidak ada sinyal</h2><p>Halaman ini belum tersimpan di perangkat. Silakan coba lagi di area dengan sinyal atau Wi-Fi loket.</p><p><i>No signal. Please retry where there is coverage or at the ticket counter Wi-Fi.</i></p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }))));
  }
});
