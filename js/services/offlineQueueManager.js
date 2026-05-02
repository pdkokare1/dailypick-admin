/* js/services/offlineQueueManager.js */

// ============================================================================
// --- TRUE OFFLINE-FIRST INDEXEDDB IMPLEMENTATION ---
// Moved to the top to ensure DB is initialized before sync loops fire
// ============================================================================
const DB_NAME = 'DailyPickAdminDB';
const STORE_NAME = 'offline_queue';

function initIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

window.getAllFromIDB = async function() {
    try {
        const db = await initIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) { return []; }
};

window.deleteFromIDB = async function(id) {
    try {
        const db = await initIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {}
};

window.addToOfflineQueue = async function(payload) {
    try {
        const db = await initIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add(payload);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        });
    } catch (e) {}
};

// ============================================================================
// --- OFFLINE SYNC ENGINE ---
// ============================================================================

let isSyncing = false;

async function syncOfflinePOS() {
    if (!navigator.onLine || isSyncing) return;
    if (typeof window.getAllFromIDB !== 'function') return;

    isSyncing = true;
    try {
        const offlineQueue = await window.getAllFromIDB();
        if (offlineQueue.length === 0) return;

        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;

        for (const itemToSync of offlineQueue) {
            const { id, ...payloadToSync } = itemToSync;

            if (!payloadToSync.idempotencyKey) {
                payloadToSync.idempotencyKey = 'OFFLINE-SYNC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
            }

            // OPTIMIZATION: AbortController prevents hanging requests on flaky networks
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                // Ensure BACKEND_URL falls back securely if not defined in local scope
                const targetUrl = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : '') + '/api/orders/pos';
                
                const res = await fetchFn(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadToSync),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const result = await res.json();
                if (result.success) {
                    await window.deleteFromIDB(id); 
                    showToast('Offline POS transaction synced! ✅');
                    if (typeof renderOverview === 'function') renderOverview(); 
                } else {
                    await window.deleteFromIDB(id); 
                    
                    let failedQueue = JSON.parse(localStorage.getItem('dailypick_failed_syncs') || '[]');
                    failedQueue.push({
                        ...itemToSync,
                        failReason: result.message || 'Unknown backend rejection',
                        failedAt: new Date().toISOString()
                    });
                    localStorage.setItem('dailypick_failed_syncs', JSON.stringify(failedQueue));
                    
                    showToast(`Offline Sync Failed: ${result.message}`);
                    if (typeof renderOverview === 'function') renderOverview(); 
                }
            } catch (err) {
                clearTimeout(timeoutId);
                // If it aborts due to timeout, break the loop and try again on the next interval
                console.warn('Sync request timed out or network dropped during transit. Will retry later.', err);
                break;
            }
        }
    } catch (e) {
        console.log('Sync attempted, still offline or server unreachable.');
    } finally {
        isSyncing = false;
    }
}

setInterval(syncOfflinePOS, 30000);

window.addEventListener('online', () => {
    if (!isSyncing) {
        if (typeof showToast === 'function') showToast('Network restored. Flushing offline queue...');
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('trigger-sync');
        }
        syncOfflinePOS();
    }
});
