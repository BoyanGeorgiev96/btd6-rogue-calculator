/* RELEASE and FILES are supplied by the production build. */
const base = new URL('./', self.location.href);
const prefix = `rogue-lab:${base.href}:`;
const cacheName = prefix + RELEASE;
const shell = new URL('index.html', base).href;
const assets = new Set(FILES.map(file => new URL(file.url, base).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    try {
      await cache.addAll(FILES.map(file => new Request(new URL(file.url, base), {
        cache: 'reload', integrity: file.integrity
      })));
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  })());
  // Updates wait for all tabs to close. Never discard an unfinished plan or
  // switch a running document to a different release's data/modules.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Section fragments identify a position in the same cached document.
  url.hash = '';
  const navigation = event.request.mode === 'navigate' &&
    (url.pathname === base.pathname || url.pathname === new URL(shell).pathname) && url.origin === base.origin;
  const key = navigation ? shell : url.href;
  if (!assets.has(key)) return; // No external fonts, sources, other apps or runtime data.
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) || fetch(event.request);
  })());
});
