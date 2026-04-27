const CACHE_NAME = 'sweet-merge-v3.7'; 
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './app.js',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate Strategy
// Serves from cache immediately, but updates cache in background
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        const fetchedResponse = fetch(e.request).then((networkResponse) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
