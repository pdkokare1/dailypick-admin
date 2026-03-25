/* app.js */

// --- NEW: Global Fetch Interceptor ---
// This silently attaches the JWT token to every backend request without needing to rewrite every file
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

    // --- SECURITY: Unified Session Expiration ---
    if (response.status === 401 || response.status === 403) {
        if (typeof resource === 'string' && !resource.includes('/api/auth/')) {
            console.warn('Unauthorized intercept. Session expired or revoked.');
            if (typeof window.logoutUser === 'function') {
                window.logoutUser();
                if (typeof showToast === 'function') showToast("Session expired. Please log in again.");
            }
        }
    }
    
    return response;
};

let currentUser = null;
let currentPin = '';

// Intercept app initialization to enforce Security PIN
document.addEventListener("DOMContentLoaded", async () => {
    console.log("App initializing, checking for saved session...");
    const savedUser = localStorage.getItem('dailypick_user');
    const loginContainer = document.getElementById('pin-login-container');
    const appContainer = document.getElementById('app-container');
    
    if (savedUser) {
        console.log("Found saved session:", savedUser);
        currentUser = JSON.parse(savedUser);
        
        // Hide login, show app
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        applyRoleRestrictions();
        initializeApp();

        // Background check to verify the session hasn't been tampered with
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
        // Show login, hide app completely
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }
});

// Keyboard support for PIN entry
document.addEventListener('keydown', (e) => {
    const loginContainer = document.getElementById('pin-login-container');
    if (loginContainer && loginContainer.style.display !== 'none' && document.activeElement.id !== 'login-username') {
        if (e.key >= '0' && e.key <= '9') {
            window.handlePinInput(e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            window.clearPinInput();
        }
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
            
            const loginContainer = document.getElementById('pin-login-container');
            const appContainer = document.getElementById('app-container');
            
            if (loginContainer) loginContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            
            if (usernameInput) usernameInput.value = '';
            window.clearPinInput();

            applyRoleRestrictions();
            initializeApp();
            if (typeof showToast === 'function') showToast(`Welcome, ${currentUser.name}!`);
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

window.logoutUser = function() {
    console.log("Logging out user...");
    localStorage.removeItem('dailypick_user');
    localStorage.removeItem('adminToken');
    
    if (window.adminStreamController) {
        window.adminStreamController.abort();
        window.adminStreamController = null;
    }
    
    currentUser = null;
    
    const loginContainer = document.getElementById('pin-login-container');
    const appContainer = document.getElementById('app-container');
    
    if (loginContainer) loginContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    
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
