// MODIFIED: Bumped version to force clients to download the new, stable cache
const CACHE_NAME = 'dailypick-admin-v2';

// The files we want to save to the device for offline use
const URLS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './js/state.js',
    './js/ui.js',
    './js/api.js',
    './js/pos.js',
    './js/orders.js',
    './js/inventory.js',
    './js/crm.js',
    './js/analytics.js',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    'https://unpkg.com/html5-qrcode',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js'
];

// Install Event: Save files to cache
self.addEventListener('install', event => {
    // MODIFIED: Added skipWaiting to force the new worker to activate immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and storing UI shell');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// Fetch Event: Cache-First with Background Network Sync
self.addEventListener('fetch', event => {
    // We only want to cache frontend files, NOT API calls to the backend.
    // API calls should always try to hit the network first.
    if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
        return; // Let API calls pass through normally
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // If the file is in the cache, return it immediately for instant loading
            if (cachedResponse) {
                // MODIFIED: Fetch the latest version in the background to update the cache silently
                fetch(event.request).then(networkResponse => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }).catch(() => {
                    // Ignore background network errors if offline
                });
                return cachedResponse;
            }

            // If not in cache, fetch from network and add to cache
            return fetch(event.request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
                // Safe failure if entirely offline and file isn't cached
                console.warn('Offline and resource not in cache:', event.request.url);
            });
        })
    );
});

// Activate Event: Clean up old caches if we update the app
self.addEventListener('activate', event => {
    // MODIFIED: Take control of all open pages immediately
    event.waitUntil(self.clients.claim());
    
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
