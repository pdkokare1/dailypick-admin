/* service-worker.js */

const CACHE_NAME = 'dailypick-admin-cache-v2';

// The core static files your app needs to boot up offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './js/api.js',
    './js/ui.js',
    './js/state.js',
    './js/pos.js',
    './js/orders.js',
    './js/inventory.js',
    './js/crm.js',
    './js/analytics.js',
    './manifest.json',
    // External libraries you use (Add any CDNs you use in index.html here)
    'https://unpkg.com/html5-qrcode',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. Install Event: Download and cache all static assets immediately
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching Core Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event: Clean up old, outdated caches when you push new code
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open pages immediately
    );
});

// 3. Fetch Event: Intercept network requests
self.addEventListener('fetch', (event) => {
    // Ignore non-GET requests (like POSTing a new order) and live SSE streams
    if (event.request.method !== 'GET' || event.request.url.includes('/stream/')) {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // STRATEGY A: Network-First for API calls (Always try to get fresh data)
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Clone the response and save it to cache just in case we go offline later
                    const clonedResponse = networkResponse.clone();
                    caches.open('dailypick-api-cache').then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return networkResponse;
                })
                .catch(async () => {
                    // If network fails (offline), return the last known cached API data
                    console.warn('[Service Worker] Network failed, serving API from cache.');
                    const cachedResponse = await caches.match(event.request);
                    return cachedResponse || new Response(JSON.stringify({ success: false, message: 'Offline mode' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // STRATEGY B: Cache-First for Static Assets (HTML, CSS, JS, Images)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Background update: Serve from cache instantly, but fetch a new version silently
                fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                }).catch(() => {});
                
                return cachedResponse;
            }
            // If not in cache, go to network
            return fetch(event.request);
        })
    );
});
