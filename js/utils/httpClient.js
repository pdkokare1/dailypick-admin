/* js/utils/httpClient.js */
import { CONFIG } from '../core/config.js';

export function handleAuthFailure(url) {
    console.warn('Authentication failed for:', url);
    if (typeof showToast === 'function') showToast('Session Expired or Access Denied. Please log in again.');
}

// ENTERPRISE OPTIMIZATION: Exponential Backoff Retry Engine
// Silently absorbs network blips and 500/502/503/504 errors without bothering the user
export async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            // Only retry on actual server crashes or gateway timeouts, not 4xx client errors
            if (res.status >= 500 && i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
                console.warn(`[HTTP] Server error ${res.status}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            return res;
        } catch (err) {
            // Catches actual network drops (e.g., Wi-Fi disconnected during fetch)
            if (i === maxRetries - 1) throw err;
            const delay = Math.pow(2, i) * 1000;
            console.warn(`[HTTP] Network drop detected. Retrying in ${delay}ms...`, err.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export async function adminFetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('adminToken');
    
    // BUG FIX: Clone options object to maintain functional purity and avoid mutating caller config
    const fetchOptions = { ...options, headers: { ...(options.headers || {}) } };
    fetchOptions.credentials = 'include';
    
    if (token) {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Utilize the new resilient fetch wrapper
    let response = await fetchWithRetry(url, fetchOptions);
    
    // Automatic Token Refresh Logic
    if (response && response.status === 401) {
        try {
            const refreshRes = await fetchWithRetry(`${CONFIG.BACKEND_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include' 
            });
            const refreshData = await refreshRes.json();
            
            if (refreshData.success && refreshData.token) {
                localStorage.setItem('adminToken', refreshData.token);
                fetchOptions.headers['Authorization'] = `Bearer ${refreshData.token}`;
                response = await fetchWithRetry(url, fetchOptions); 
            } else {
                handleAuthFailure(url);
            }
        } catch (e) {
            handleAuthFailure(url);
        }
    } else if (response && response.status === 403) {
        handleAuthFailure(url);
    }

    // Rate Limit Backoff Warning
    if (response && response.status === 429) {
        if (typeof showToast === 'function') showToast("Too many requests. Please slow down.");
    }
    
    return response;
}

// BRIDGE: Exposing to window to ensure backward compatibility
window.handleAuthFailure = handleAuthFailure;
window.adminFetchWithAuth = adminFetchWithAuth;
