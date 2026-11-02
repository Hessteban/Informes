/* Service worker: guarda la app completa para usarla sin conexión.
   Si modificas cualquier archivo, sube el número de CACHE para que los equipos se actualicen. */
const CACHE = 'informe-especialista-v10';
const ARCHIVOS = [
  './', 'index.html', 'style.css', 'app.js', 'docx.js', 'template.js', 'jszip.min.js',
  'manifest.webmanifest', 'icons/fam-192.png', 'icons/fam-512.png', 'icons/fam-maskable-512.png', 'icons/fam-apple-180.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const red = fetch(req).then((r) => { if (r && r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone())); return r; }).catch(() => hit);
      return hit || red;
    }).catch(() => caches.match('index.html'))
  );
});
