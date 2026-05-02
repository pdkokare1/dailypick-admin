/* service-worker.js */

const CACHE_NAME = 'dailypick-admin-cache-v7'; 
const OFFLINE_QUEUE_NAME = 'dailypick-offline-orders';

// ENTERPRISE OPTIMIZATION: Holds the freshest JWT so background syncs don't fail due to 401s after long offline periods
let latestAuthToken = null;

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

async function saveToEnterpriseOutbox(requestUrl, headers, body, method = 'POST') {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_NAME);
    
    const mutableHeaders = new Headers(headers);
    
    if (!mutableHeaders.has('Idempotency-Key')) {
        mutableHeaders.append('Idempotency-Key', 'OFFLINE-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));
    }
    
    const headersArray = Array.from(mutableHeaders.entries());
    
    const payload = {
        url: requestUrl,
        method: method,
        headers: headersArray,
        body: body,
        timestamp: Date.now(),
        retryCount: 0 
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
        // OPTIMIZATION: Prevent poisoned queue items from permanently blocking sync
        if (data.retryCount && data.retryCount > 5) {
            console.error(`[Enterprise SW] Transaction ${data.id} failed 5 times. Purging from queue to prevent blockages.`);
            const delTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
            delTx.objectStore(OFFLINE_QUEUE_NAME).delete(data.id);
            continue;
        }

        try {
            const headers = new Headers(data.headers);
            
            // ENTERPRISE OPTIMIZATION: Inject the latest token to prevent 401s on stale payloads
            if (latestAuthToken) {
                headers.set('Authorization', `Bearer ${latestAuthToken}`);
            }

            const response = await fetch(data.url, {
                method: data.method,
                headers: headers,
                body: JSON.stringify(data.body)
            });

            if (response.ok || response.status === 400 || response.status === 409) { 
                const delTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
                delTx.objectStore(OFFLINE_QUEUE_NAME).delete(data.id);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (err) {
            console.warn('[Enterprise SW] Sync failed for payload. Incrementing retry count.', err);
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

self.addEventListener('message', (event) => {
    // ENTERPRISE OPTIMIZATION: Main thread pushes fresh tokens here when coming online
    if (event.data && event.data.type === 'UPDATE_TOKEN') {
        latestAuthToken = event.data.token;
    }
    else if (event.data === 'trigger-sync') {
        processEnterpriseOutbox();
    }
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (event.request.mode === 'navigate') {
        event.respondWith(
            // ENTERPRISE OPTIMIZATION: ignoreSearch handles cache busting params safely
            caches.match('./index.html', { ignoreSearch: true }).then((cachedResponse) => {
                return cachedResponse || fetch(event.request).catch(() => caches.match('./index.html', { ignoreSearch: true }));
            })
        );
        return;
    }

    if (['POST', 'PUT', 'PATCH'].includes(event.request.method) && 
        requestUrl.pathname.startsWith('/api/') && 
        !requestUrl.pathname.startsWith('/api/auth/')) {
        
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
                    const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
                    return cachedResponse || new Response(JSON.stringify({ success: false, message: 'Offline mode' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // ENTERPRISE OPTIMIZATION: Stale-While-Revalidate pattern for maximum UI speed
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {}); 
            
            if (cachedResponse) {
                event.waitUntil(fetchPromise);
                return cachedResponse;
            }
            return fetchPromise;
        })
    );
});
