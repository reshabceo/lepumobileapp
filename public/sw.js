const CACHE_NAME = 'priti-medical-v2-fresh';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  // Force immediate activation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    // For HTML files, always fetch fresh content
    event.request.destination === 'document' ? 
      fetch(event.request).catch(() => caches.match(event.request)) :
      caches.match(event.request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        })
  );
});
