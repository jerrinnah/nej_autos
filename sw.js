/* NEJ Autos — self-destruct worker.
   Replaces the old caching service worker: clears all caches, unregisters
   itself, and reloads open pages so they always get fresh files.
   (PWA/offline can be re-added later once the app stabilises.) */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    } catch (err) { /* no-op */ }
  })());
});

// pass everything straight through to the network — no caching
self.addEventListener('fetch', () => {});
