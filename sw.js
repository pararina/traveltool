// 旅行管理ツール Service Worker
// アプリ本体をキャッシュして、オフラインでも起動できるようにします。
// index.html を更新したときは、下の CACHE の番号(v1→v2…)を上げてください。
const CACHE = 'travel-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './favicon_travel.png?v=2', './favicon_travel.png?v=2'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = ms => new Promise((_, reject) => setTimeout(reject, ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;           // GASへのPOSTなどは対象外
  const url = new URL(req.url);

  // 自サイト: ネットワーク優先(3秒で諦めてキャッシュ)。更新がすぐ反映され、電波が悪くても開ける
  if (url.origin === self.location.origin) {
    e.respondWith(
      Promise.race([fetch(req), timeout(3000)])
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Tailwind・フォント: キャッシュ優先で裏で更新
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
  // Googleマップ関連はキャッシュしない(オフライン時は地図だけ使えません)
});
