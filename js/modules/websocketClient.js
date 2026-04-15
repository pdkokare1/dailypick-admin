/* js/modules/websocketClient.js */
// Extracted from app.js to decouple networking

let realtimeSocket = null; 
let realtimeReconnectTimeout = null;

window.setupRealtimeConnection = function() {
    if (realtimeSocket && realtimeSocket.readyState <= 1) return; 

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const wsUrl = window.BACKEND_URL.replace(/^http/, 'ws') + `/api/ws/pos?token=${token}`;
    
    try {
        realtimeSocket = new WebSocket(wsUrl);

        realtimeSocket.onopen = () => {
            console.log("Secure Realtime WebSocket Connected");
            if (realtimeReconnectTimeout) clearTimeout(realtimeReconnectTimeout);
        };

        realtimeSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
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
            } catch (e) {
                console.warn("WebSocket message error", e);
            }
        };

        realtimeSocket.onclose = () => {
            console.warn("Realtime WebSocket Closed. Attempting reconnect in 3s...");
            realtimeSocket = null;
            realtimeReconnectTimeout = setTimeout(window.setupRealtimeConnection, 3000);
        };

        realtimeSocket.onerror = (err) => {
            console.error("Realtime WebSocket Error:", err);
            realtimeSocket.close(); 
        };
    } catch (e) {
        console.error("WebSocket setup failed", e);
    }
};
