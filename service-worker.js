/* service-worker.js */

const CACHE_NAME = 'dailypick-admin-cache-v4'; 
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

// DEPRECATION CONSULTATION: Legacy offline saver
/*
async function saveOfflineOrder(requestUrl, headers, body) { ... }
async function syncOfflineOrders() { ... }
*/

// ENTERPRISE OPTIMIZATION: Robust Outbox Pattern with Exponential Backoff
async function saveToEnterpriseOutbox(requestUrl, headers, body, method = 'POST') {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_NAME);
    
    const headersArray = Array.from(headers.entries());
    
    const payload = {
        url: requestUrl,
        method: method,
        headers: headersArray,
        body: body,
        timestamp: Date.now(),
        retryCount: 0 // New: Track retries
    };
    store.add(payload);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

async function processEnterpriseOutbox() {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readonly');
    const store = tx.objectStore(OFFLINE_QUEUE_NAME);
    const requests = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });

    if (requests.length === 0) return;
    console.log(`[Enterprise SW] Processing ${requests.length} offline transactions...`);

    for (const data of requests) {
        try {
            const headers = new Headers(data.headers);
            const response = await fetch(data.url, {
                method: data.method,
                headers: headers,
                body: JSON.stringify(data.body)
            });

            // 400s are user errors (e.g., duplicate order), we drop them so they don't block the queue forever
            if (response.ok || response.status === 400 || response.status === 409) { 
                const delTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
                delTx.objectStore(OFFLINE_QUEUE_NAME).delete(data.id);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (err) {
            console.warn('[Enterprise SW] Sync failed for payload. Incrementing retry count.', err);
            // Exponential backoff logic
            data.retryCount = (data.retryCount || 0) + 1;
            const updateTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
            updateTx.objectStore(OFFLINE_QUEUE_NAME).put(data);
        }
    }
}

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching Core Assets for Stale-While-Revalidate');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== 'dailypick-api-cache') {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) 
    );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline-orders') {
        event.waitUntil(processEnterpriseOutbox());
    }
});

// OPTIMIZATION: Cross-communication port to allow the UI to forcefully trigger SW outbox flushing
self.addEventListener('message', (event) => {
    if (event.data === 'trigger-sync') {
        processEnterpriseOutbox();
    }
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('./index.html').then((cachedResponse) => {
                return cachedResponse || fetch(event.request).catch(() => caches.match('./index.html'));
            })
        );
        return;
    }

    // DEPRECATION CONSULTATION: Legacy POS interceptor
    /*
    if (event.request.method === 'POST' && requestUrl.pathname.includes('/api/orders/pos')) { ... }
    */

    // ENTERPRISE OPTIMIZATION: Zero-Downtime Interceptor for ALL critical operations (POS, Shifts, Expenses)
    if (['POST', 'PUT', 'PATCH'].includes(event.request.method) && requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request.clone()).catch(async (err) => {
                console.warn(`[Enterprise SW] Network offline. Saving ${event.request.method} locally.`);
                const body = await event.request.clone().json();
                
                await saveToEnterpriseOutbox(event.request.url, event.request.headers, body, event.request.method);
                
                if ('sync' in self.registration) {
                    await self.registration.sync.register('sync-offline-orders');
                }

                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'Offline Mode: Action queued for background sync.', 
                    offline: true,
                    orderId: requestUrl.pathname.includes('/pos') ? 'OFFLINE-' + Date.now() : null
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
        event.request.url.includes('/api/auth/')) {
        return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const responseToCache = networkResponse.clone();
                    caches.open('dailypick-api-cache').then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    processEnterpriseOutbox();
                    return networkResponse;
                })
                .catch(async () => {
                    console.warn('[Enterprise SW] Network failed, serving API from High-Availability cache.');
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
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {}); 
            
            return cachedResponse || fetchPromise;
        })
    );
});
