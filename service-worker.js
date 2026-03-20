const CACHE_NAME = 'dailypick-admin-v1';

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
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// Fetch Event: Serve from cache if offline
self.addEventListener('fetch', event => {
    // We only want to cache frontend files, NOT API calls to the backend.
    // API calls should always try to hit the network first.
    if (event.request.url.includes('/api/')) {
        return; // Let API calls pass through normally
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found
                if (response) {
                    return response;
                }
                // Otherwise fetch from network
                return fetch(event.request);
            })
    );
});

// Activate Event: Clean up old caches if we update the app
self.addEventListener('activate', event => {
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
