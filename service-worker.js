/* service-worker.js */

const CACHE_NAME = 'dailypick-admin-cache-v2';
const OFFLINE_QUEUE_NAME = 'dailypick-offline-orders';

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

// --- OPTIMIZATION: IndexedDB Setup for Offline POS Orders ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DailyPickOfflineDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_NAME)) {
                db.createObjectStore(OFFLINE_QUEUE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveOfflineOrder(requestUrl, headers, body) {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_NAME);
    const orderData = {
        url: requestUrl,
        headers: Array.from(headers.entries()),
        body: body,
        timestamp: Date.now()
    };
    store.add(orderData);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

async function syncOfflineOrders() {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readonly');
    const store = tx.objectStore(OFFLINE_QUEUE_NAME);
    const requests = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });

    if (requests.length === 0) return;

    console.log(`[Service Worker] Syncing ${requests.length} offline orders to backend...`);

    for (const data of requests) {
        try {
            const headers = new Headers(data.headers);
            await fetch(data.url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data.body)
            });

            // If successful, remove from IndexedDB
            const delTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
            delTx.objectStore(OFFLINE_QUEUE_NAME).delete(data.id);
        } catch (err) {
            console.error('[Service Worker] Sync failed for order, will retry later:', err);
        }
    }
}

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

// Trigger sync when internet connection is restored
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline-orders') {
        event.waitUntil(syncOfflineOrders());
    }
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // --- NEW CAPABILITY: Intercept POS checkouts for Offline Mode ---
    if (event.request.method === 'POST' && requestUrl.pathname.includes('/api/orders/pos')) {
        event.respondWith(
            fetch(event.request.clone()).catch(async (err) => {
                console.warn('[Service Worker] Network offline. Saving POS order locally.');
                const body = await event.request.clone().json();
                await saveOfflineOrder(event.request.url, event.request.headers, body);
                
                // Register background sync to trigger when online
                if ('sync' in self.registration) {
                    await self.registration.sync.register('sync-offline-orders');
                }

                // Return a fake success so the POS UI clears the cart and lets the cashier continue
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'Saved Offline. Will sync when online.', 
                    orderId: 'OFFLINE-' + Date.now(), 
                    offline: true 
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    if (event.request.method !== 'GET' || 
        event.request.url.includes('/stream/') ||
        event.request.url.includes('/export') ||
        event.request.url.includes('/analytics') ||
        event.request.url.includes('/api/auth/') || 
        event.request.url.includes('/api/shifts/')) {
        return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const clonedResponse = networkResponse.clone();
                    caches.open('dailypick-api-cache').then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    
                    // Attempt to flush offline queue if we just made a successful API call
                    syncOfflineOrders();
                    
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
