/* js/services/liveStreamService.js */
import { CONFIG } from '../core/config.js';

let sseRetryCount = 0;

export async function connectAdminLiveStream() {
    if (window.adminStreamController) return; 

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    window.adminStreamController = new AbortController();

    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/orders/stream/admin`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include',
            signal: window.adminStreamController.signal
        });

        if (!response.ok) throw new Error('Stream connection failed due to authorization or server error');

        console.log("🟢 Live Order Stream Connected (Secured)");
        sseRetryCount = 0; 

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === ':' || !dataStr) continue; 

                    try {
                        const data = JSON.parse(dataStr);
                        if (data.message) continue;

                        if (data.type === 'NEW_ORDER') {
                            if (typeof currentOrders !== 'undefined') currentOrders.unshift(data.order);
                            if (typeof updateDashboard === 'function') updateDashboard();
                            if (typeof playNewOrderAudio === 'function') playNewOrderAudio(); 
                            if (typeof showToast === 'function') showToast('🚨 New Order Arrived!');
                        } else if (data.type === 'EXPIRY_WARNING') {
                            if (typeof showToast === 'function') showToast(data.message);
                        }
                    } catch (e) {
                        console.error("Error parsing stream data:", e);
                    }
                }
            }
        }
    } catch (error) {
        sseRetryCount++;
        const retryDelay = Math.min(1000 * (2 ** sseRetryCount), 30000); 
        console.warn(`⚠️ Live Stream disconnected. Reconnecting in ${retryDelay/1000}s...`);
        
        window.adminStreamController = null;
        setTimeout(connectAdminLiveStream, retryDelay);
    }
}

// BRIDGE: Exposing to window
window.connectAdminLiveStream = connectAdminLiveStream;
