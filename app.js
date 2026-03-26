/* app.js */

const originalFetch = window.fetch.bind(window);
window.fetch = async function(resource, config = {}) {
    if (typeof resource === 'string' && typeof BACKEND_URL !== 'undefined' && resource.startsWith(BACKEND_URL)) {
        const token = localStorage.getItem('adminToken');
        if (token) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }
    
    const response = await originalFetch(resource, config);

    if (response.status === 401 || response.status === 403) {
        if (typeof resource === 'string' && !resource.includes('/api/auth/')) {
            console.warn('Unauthorized intercept. Session expired or revoked.');
            if (typeof window.logoutUser === 'function') {
                window.logoutUser();
                if (typeof showToast === 'function') showToast("Session expired. Please log in again.");
            }
        }
    }

    if (response.status === 429) {
        console.warn('Rate limit exceeded.');
        if (typeof showToast === 'function') showToast("Too many requests. Please slow down.");
    }
    
    return response;
};

let currentUser = null;
let currentPin = '';
let realtimeSocket = null; 
let realtimeReconnectTimeout = null;

// --- NEW FUNCTIONALITY: Kiosk Mode Screen Wake Lock ---
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock released');
            });
            console.log('Screen Wake Lock acquired - Kiosk Mode Active');
        }
    } catch (err) {
        console.warn(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// --- NEW FUNCTIONALITY: Prevent Accidental Tab Closure ---
window.addEventListener('beforeunload', function (e) {
    // If cart is not empty OR a shift is currently open, warn the user before closing
    if ((typeof posCart !== 'undefined' && posCart.length > 0) || (typeof currentActiveShift !== 'undefined' && currentActiveShift !== null)) {
        e.preventDefault();
        e.returnValue = 'You have an active transaction or open shift. Are you sure you want to leave?';
    }
});

window.setupRealtimeConnection = function() {
    if (realtimeSocket && realtimeSocket.readyState <= 1) return; 

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/api/ws/pos?token=${token}`;
    
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

document.addEventListener("DOMContentLoaded", async () => {
    console.log("App initializing, checking for saved session...");
    const savedUser = localStorage.getItem('dailypick_user');
    const loginContainer = document.getElementById('pin-login-container');
    const appContainer = document.getElementById('app-container');
    
    if (savedUser) {
        console.log("Found saved session:", savedUser);
        currentUser = JSON.parse(savedUser);
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        applyRoleRestrictions();
        initializeApp();

        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/verify?id=${currentUser._id || currentUser.id}`);
            const result = await res.json();
            
            if (!res.ok || !result.success || result.data.role !== currentUser.role) {
                console.warn("Session verification failed. Role mismatch or invalid user. Forcing logout.");
                window.logoutUser();
                if (typeof showToast === 'function') showToast("Session invalid. Please log in again.");
            }
        } catch (e) {
            console.warn("Could not reach background verification endpoint. Trusting local session temporarily.", e);
        }
        
    } else {
        console.log("No session found. Showing PIN login.");
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }
});

// --- NEW FUNCTIONALITY: Hardware Scanner Protection ---
document.addEventListener('keydown', (e) => {
    const loginContainer = document.getElementById('pin-login-container');
    if (loginContainer && loginContainer.style.display !== 'none' && document.activeElement.id !== 'login-username') {
        if (e.key >= '0' && e.key <= '9') {
            window.handlePinInput(e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            window.clearPinInput();
        }
    }

    // Intercept dangerous browser shortcuts fired by rapid USB scanners
    if ((e.ctrlKey || e.metaKey) && ['p', 's', 'j', 'g', 'f', 'o'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        console.warn(`Blocked potentially dangerous scanner shortcut: Ctrl+${e.key}`);
    }
});

window.handlePinInput = function(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDisplay();
    }
    if (currentPin.length === 4) {
        window.submitPinLogin();
    }
};

window.clearPinInput = function() {
    currentPin = '';
    updatePinDisplay();
};

function updatePinDisplay() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`pin-dot-${i}`);
        if (dot) {
            if (i <= currentPin.length) {
                const dynamicColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
                dot.style.background = dynamicColor || '#062C1E'; 
            } else {
                dot.style.background = 'transparent';
            }
        }
    }
}

window.submitPinLogin = async function() {
    console.log("Submitting PIN to backend...");
    
    const usernameInput = document.getElementById('login-username');
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!username) {
        if (typeof showToast === 'function') showToast("Please enter your Username");
        window.clearPinInput();
        if (usernameInput) usernameInput.focus();
        return;
    }

    try {
        if (typeof BACKEND_URL === 'undefined') {
            console.error("BACKEND_URL is not defined! Check state.js");
            if (typeof showToast === 'function') showToast("System Error: Backend URL missing");
            window.clearPinInput();
            return;
        }

        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, pin: currentPin })
        });
        
        const result = await res.json();
        
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('dailypick_user', JSON.stringify(currentUser));
            
            if (result.token) {
                localStorage.setItem('adminToken', result.token);
            }
            
            window.showLocationSelection();
            
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Invalid Username or PIN');
            window.clearPinInput();
        }
    } catch (e) {
        console.error("Login fetch error:", e);
        if (typeof showToast === 'function') showToast('Error connecting to server.');
        window.clearPinInput();
    }
};

window.showLocationSelection = async function() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/stores`);
        if (res.ok) {
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                document.getElementById('pin-entry-step').style.display = 'none';
                document.getElementById('location-selection-step').style.display = 'block';
                
                const storeSelect = document.getElementById('login-store-select');
                storeSelect.innerHTML = '<option value="">Select Store...</option>';
                data.data.forEach(s => {
                    storeSelect.innerHTML += `<option value="${s._id}">${s.name} (${s.location})</option>`;
                });
                return; 
            }
        }
    } catch (e) {}

    window.finalizeLogin();
};

window.fetchRegistersForStore = async function(storeId) {
    if (!storeId) return;
    try {
        const res = await fetch(`${BACKEND_URL}/api/stores/${storeId}/registers`);
        if (res.ok) {
            const data = await res.json();
            const regSelect = document.getElementById('login-register-select');
            regSelect.innerHTML = '<option value="">Select Register...</option>';
            if (data.data) {
                data.data.forEach(r => {
                    regSelect.innerHTML += `<option value="${r._id}">${r.name}</option>`;
                });
            }
        }
    } catch (e) { console.error("Error fetching registers", e); }
};

window.finalizeLogin = function() {
    const storeSelect = document.getElementById('login-store-select');
    const regSelect = document.getElementById('login-register-select');
    
    if (storeSelect && storeSelect.value) {
        currentStoreId = storeSelect.value;
        localStorage.setItem('dailypick_storeId', currentStoreId);
    }
    if (regSelect && regSelect.value) {
        currentRegisterId = regSelect.value;
        localStorage.setItem('dailypick_registerId', currentRegisterId);
    }

    const loginContainer = document.getElementById('pin-login-container');
    const appContainer = document.getElementById('app-container');
    const usernameInput = document.getElementById('login-username');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
    
    if (usernameInput) usernameInput.value = '';
    window.clearPinInput();

    applyRoleRestrictions();
    initializeApp();
    if (typeof showToast === 'function') showToast(`Welcome, ${currentUser.name}!`);
};

window.logoutUser = function() {
    console.log("Logging out user...");
    localStorage.removeItem('dailypick_user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('dailypick_storeId');
    localStorage.removeItem('dailypick_registerId');
    
    if (realtimeSocket) {
        realtimeSocket.onclose = null; 
        realtimeSocket.close();
        realtimeSocket = null;
    }
    if (realtimeReconnectTimeout) clearTimeout(realtimeReconnectTimeout);
    
    // Release wake lock if held
    if (wakeLock !== null) {
        wakeLock.release().then(() => wakeLock = null);
    }

    if (window.adminStreamController) {
        window.adminStreamController.abort();
        window.adminStreamController = null;
    }
    
    currentUser = null;
    currentStoreId = null;
    currentRegisterId = null;
    
    const loginContainer = document.getElementById('pin-login-container');
    const appContainer = document.getElementById('app-container');
    
    if (loginContainer) loginContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    
    const pinStep = document.getElementById('pin-entry-step');
    const locStep = document.getElementById('location-selection-step');
    if (pinStep) pinStep.style.display = 'block';
    if (locStep) locStep.style.display = 'none';

    window.clearPinInput();
    
    const display = document.getElementById('current-user-display');
    if (display) display.style.display = 'none';
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'none';
};

function applyRoleRestrictions() {
    const display = document.getElementById('current-user-display');
    if (display) {
        display.innerText = `${currentUser.name} (${currentUser.role})`;
        display.style.display = 'block';
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'block';

    if (currentUser.role === 'Cashier') {
        const navOverview = document.getElementById('nav-overview');
        const navInventory = document.getElementById('nav-inventory');
        const navAnalytics = document.getElementById('nav-analytics');
        const navCustomers = document.getElementById('nav-customers');
        
        if (navOverview) navOverview.style.display = 'none';
        if (navInventory) navInventory.style.display = 'none';
        if (navAnalytics) navAnalytics.style.display = 'none';
        if (navCustomers) navCustomers.style.display = 'none';
        
        const eodBtn = document.getElementById('eod-report-btn');
        if (eodBtn) eodBtn.style.display = 'none';
        
        if (typeof switchView === 'function') switchView('pos'); 
    } else {
        const navOverview = document.getElementById('nav-overview');
        const navInventory = document.getElementById('nav-inventory');
        const navAnalytics = document.getElementById('nav-analytics');
        const navCustomers = document.getElementById('nav-customers');
        
        if (navOverview) navOverview.style.display = 'flex';
        if (navInventory) navInventory.style.display = 'flex';
        if (navAnalytics) navAnalytics.style.display = 'flex';
        if (navCustomers) navCustomers.style.display = 'flex';
        
        const eodBtn = document.getElementById('eod-report-btn');
        if (eodBtn) eodBtn.style.display = 'inline-block';
    }
}

function initializeApp() {
    console.log("Initializing app modules...");
    if (typeof fetchCategories === 'function') fetchCategories(); 
    if (typeof fetchBrands === 'function') fetchBrands();
    if (typeof fetchDistributors === 'function') fetchDistributors();
    if (typeof fetchPromotions === 'function') fetchPromotions(); 
    if (typeof fetchOrders === 'function') fetchOrders();
    
    window.setupRealtimeConnection();
    requestWakeLock(); // Trigger Kiosk Screen Lock

    if (currentUser && currentUser.role === 'Admin') {
        if (typeof renderOverview === 'function') renderOverview(); 
    }
    
    if (typeof checkCurrentShift === 'function') checkCurrentShift();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully');
            })
            .catch(err => {
                console.error('Service Worker registration failed: ', err);
            });
    });
}
