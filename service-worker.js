/* service-worker.js */

const CACHE_NAME = 'dailypick-admin-cache-v2';

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
    'https://unpkg.com/html5-qrcode',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching Core Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

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
        }).then(() => self.clients.claim()) 
    );
});

self.addEventListener('fetch', (event) => {
    // --- SECURITY & OPTIMIZATION: Ignore lists ---
    // Never cache non-GET requests, streams, exports, auth routes, or live shift data
    if (event.request.method !== 'GET' || 
        event.request.url.includes('/stream/') ||
        event.request.url.includes('/export') ||
        event.request.url.includes('/analytics') ||
        event.request.url.includes('/api/auth/') || 
        event.request.url.includes('/api/shifts/')) {
        return;
    }

    const requestUrl = new URL(event.request.url);

    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const clonedResponse = networkResponse.clone();
                    caches.open('dailypick-api-cache').then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return networkResponse;
                })
                .catch(async () => {
                    console.warn('[Service Worker] Network failed, serving API from cache.');
                    const cachedResponse = await caches.match(event.request);
                    return cachedResponse || new Response(JSON.stringify({ success: false, message: 'Offline mode' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                }).catch(() => {});
                
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});
