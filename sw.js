// Service worker do site (PWA)
// • página e índice dos dados: tenta a rede primeiro, cai no cache se estiver offline
// • arquivos de dados com versão (?v=...): cache primeiro (abre na hora) —
//   quando sai versão nova, o índice aponta pra outra URL e ela é baixada
const CACHE = 'voos-v1';
const BASICOS = ['./', 'index.html', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function redePrimeiro(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (e) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}
async function cachePrimeiro(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) {
    // apaga as versões antigas do mesmo arquivo (mesmo caminho, outro ?v=)
    const semQuery = req.url.split('?')[0];
    for (const k of await c.keys()) if (k.url.split('?')[0] === semQuery && k.url !== req.url) c.delete(k);
    c.put(req, r.clone());
  }
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                         // mapa, CDN etc.: normal
  const p = url.pathname;
  if (/\/dados\/[^/]+\.(gz|json)$/.test(p) && url.searchParams.has('v')) { e.respondWith(cachePrimeiro(req)); return; }
  if (req.mode === 'navigate' || /\/dados\//.test(p) || /\.(html|webmanifest|png)$/.test(p) || p.endsWith('/')) {
    e.respondWith(redePrimeiro(req));
  }
});
