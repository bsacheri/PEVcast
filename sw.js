// Service Worker for PEVcast PWA
// Caching strategy: Cache-first for app shell; Network-first for data

const CACHE_VERSION = 'v7';
const CACHE_NAME = `pevcast-${CACHE_VERSION}`;

// Assets to cache on install (app shell)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/chart-compare.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/version.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install event: cache app shell assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Some assets failed to cache (may be offline or unavailable):', err);
        // Don't fail install if some assets fail to cache
        return cache.addAll(
          ASSETS_TO_CACHE.filter(url => !url.includes('cdn.jsdelivr.net'))
        );
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

// Fetch event: use cache-first strategy for app shell, network-first for data
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except CDN resources)
  if (url.origin !== self.location.origin && !url.hostname.includes('cdn.jsdelivr.net')) {
    return;
  }

  // Strategy: Cache-first for static assets, Network-first for API/data
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/chart-compare.html' ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    // Cache-first: try cache, fall back to network
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          console.log('[SW] Serving from cache:', request.url);
          return response;
        }
        return fetch(request).then((response) => {
          // Don't cache non-200 responses
          if (!response || response.status !== 200) {
            return response;
          }
          // Cache successful responses for future use
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      }).catch(() => {
        // If both cache and network fail, return a fallback
        console.warn('[SW] Failed to fetch:', request.url);
        return caches.match(request); // Return whatever is in cache, or undefined
      })
    );
  } else {
    // Network-first for API/data requests
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache non-200 or non-GET responses
          if (!response || response.status !== 200) {
            return response;
          }
          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request);
        })
    );
  }
});
