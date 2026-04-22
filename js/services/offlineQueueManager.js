/* js/services/offlineQueueManager.js */

let isSyncing = false;

async function syncOfflinePOS() {
    if (!navigator.onLine || isSyncing) return;
    if (typeof getAllFromIDB !== 'function') return;

    isSyncing = true;
    try {
        const offlineQueue = await getAllFromIDB();
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
                const res = await fetchFn(`${BACKEND_URL}/api/orders/pos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadToSync),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const result = await res.json();
                if (result.success) {
                    await deleteFromIDB(id); 
                    showToast('Offline POS transaction synced! ✅');
                    if (typeof renderOverview === 'function') renderOverview(); 
                } else {
                    await deleteFromIDB(id); 
                    
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
