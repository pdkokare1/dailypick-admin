/* js/modules/websocketClient.js */
// Extracted from app.js to decouple networking

let realtimeSocket = null; 
let realtimeReconnectTimeout = null;
let realtimePingInterval = null; 
let reconnectAttempts = 0; // OPTIMIZATION: Track attempts for exponential backoff

window.setupRealtimeConnection = function() {
    if (realtimeSocket && realtimeSocket.readyState <= 1) return; 

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const wsUrl = window.BACKEND_URL.replace(/^http/, 'ws') + `/api/ws/pos?token=${token}`;
    
    try {
        realtimeSocket = new WebSocket(wsUrl);

        realtimeSocket.onopen = () => {
            console.log("Secure Realtime WebSocket Connected");
            reconnectAttempts = 0; // OPTIMIZATION: Reset on successful connection
            if (realtimeReconnectTimeout) clearTimeout(realtimeReconnectTimeout);

            if (realtimePingInterval) clearInterval(realtimePingInterval);
            realtimePingInterval = setInterval(() => {
                if (realtimeSocket && realtimeSocket.readyState === WebSocket.OPEN) {
                    realtimeSocket.send(JSON.stringify({ type: 'PONG' }));
                }
            }, 15000);
        };

        realtimeSocket.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);
                
                // OPTIMIZATION: Handle both single events and the new High-Throughput Micro-Batched Arrays from the backend
                const eventsToProcess = Array.isArray(parsedData) ? parsedData : [parsedData];
                
                eventsToProcess.forEach(data => {
                    if (data.type === 'PING') {
                        realtimeSocket.send(JSON.stringify({ type: 'PONG' }));
                        return;
                    }
                    
                    if (data.type === 'CONNECTION_ESTABLISHED') {
                        console.log('✅ Real-Time Sync Active:', data.message);
                        return;
                    }
                    
                    if (data.type === 'NEW_ORDER' || data.type === 'ORDER_STATUS_UPDATED') {
                        if (typeof fetchOrders === 'function') fetchOrders();
                        if (typeof renderOverview === 'function') renderOverview();
                    }
                    if (data.type === 'INVENTORY_UPDATE') {
                        if (typeof fetchInventory === 'function') fetchInventory();
                    }
                    
                    // --- NEW: FINANCIAL SETTLEMENT PUSH NOTIFICATION ---
                    if (data.type === 'SETTLEMENT_PAID') {
                        if (typeof showToast === 'function') {
                            showToast(`💰 Payment Received! Gamut just wired Rs ${data.amount} to your account.`);
                        }
                        // Live refresh the ledger if the user is currently looking at it
                        const ledgerModal = document.getElementById('vendor-ledger-modal');
                        if (ledgerModal && ledgerModal.classList.contains('active')) {
                            if (typeof openVendorLedgerModal === 'function') openVendorLedgerModal();
                        }
                    }
                });
            } catch (e) {
                console.warn("WebSocket message error", e);
            }
        };

        realtimeSocket.onclose = () => {
            // OPTIMIZATION: Exponential backoff calculation (max 30 seconds) prevents self-inflicted DDoS
            const delay = Math.min(1000 * (2 ** reconnectAttempts), 30000);
            reconnectAttempts++;

            console.warn(`Realtime WebSocket Closed. Attempting reconnect in ${delay}ms...`);
            if (realtimePingInterval) clearInterval(realtimePingInterval);
            realtimeSocket = null;
            realtimeReconnectTimeout = setTimeout(window.setupRealtimeConnection, delay);
        };

        realtimeSocket.onerror = (err) => {
            console.error("Realtime WebSocket Error:", err);
            if (realtimePingInterval) clearInterval(realtimePingInterval);
            realtimeSocket.close(); 
        };
    } catch (e) {
        console.error("WebSocket setup failed", e);
    }
};
