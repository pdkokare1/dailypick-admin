/* js/utils/httpClient.js */
import { CONFIG } from '../core/config.js';

export function handleAuthFailure(url) {
    console.warn('Authentication failed for:', url);
    if (typeof showToast === 'function') showToast('Session Expired or Access Denied. Please log in again.');
}

export async function adminFetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('adminToken');
    
    options.headers = options.headers || {};
    options.credentials = 'include';
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    let response = await fetch(url, options);
    
    // Automatic Token Refresh Logic
    if (response.status === 401) {
        try {
            const refreshRes = await fetch(`${CONFIG.BACKEND_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include' 
            });
            const refreshData = await refreshRes.json();
            
            if (refreshData.success && refreshData.token) {
                localStorage.setItem('adminToken', refreshData.token);
                options.headers['Authorization'] = `Bearer ${refreshData.token}`;
                response = await fetch(url, options); 
            } else {
                handleAuthFailure(url);
            }
        } catch (e) {
            handleAuthFailure(url);
        }
    } else if (response.status === 403) {
        handleAuthFailure(url);
    }

    // Rate Limit Backoff Warning
    if (response.status === 429) {
        if (typeof showToast === 'function') showToast("Too many requests. Please slow down.");
    }
    
    return response;
}

// BRIDGE: Exposing to window to ensure backward compatibility
window.handleAuthFailure = handleAuthFailure;
window.adminFetchWithAuth = adminFetchWithAuth;
