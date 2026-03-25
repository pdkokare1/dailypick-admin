/* app.js */

// --- NEW: Global Fetch Interceptor ---
// This silently attaches the JWT token to every backend request without needing to rewrite every file
// FIXED: Bound to window to prevent "Illegal Invocation" crashes
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
        // Prevent looping if the 401 is from the auth endpoint itself
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
    const overlay = document.getElementById('pin-login-overlay');
    
    if (savedUser) {
        console.log("Found saved session:", savedUser);
        currentUser = JSON.parse(savedUser);
        
        // Optimistically load the app so the UI doesn't freeze
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('locked-login'); // FREEZE FIX
        applyRoleRestrictions();
        initializeApp();

        // Background check to verify the session hasn't been tampered with
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/verify?id=${currentUser._id || currentUser.id}`);
            const result = await res.json();
            
            // If the backend says this user is invalid or their role doesn't match, kick them out
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
        if (overlay) overlay.style.display = 'flex';
        document.body.classList.add('locked-login'); // FREEZE FIX
    }
});

// Keyboard support for PIN entry
document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('pin-login-overlay');
    // Ensure we don't capture keydown if the user is typing in the username input
    if (overlay && overlay.style.display !== 'none' && document.activeElement.id !== 'login-username') {
        if (e.key >= '0' && e.key <= '9') {
            window.handlePinInput(e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            window.clearPinInput();
        }
    }
});

// Explicitly bind functions to window so inline HTML onclicks never fail
window.handlePinInput = function(num) {
    console.log("PIN input received:", num);
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDisplay();
    }
    if (currentPin.length === 4) {
        window.submitPinLogin();
    }
};

window.clearPinInput = function() {
    console.log("Clearing PIN input");
    currentPin = '';
    updatePinDisplay();
};

function updatePinDisplay() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`pin-dot-${i}`);
        if (dot) {
            if (i <= currentPin.length) {
                const dynamicColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                dot.style.background = dynamicColor || '#3b82f6'; 
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
        console.log("Login response:", result);
        
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('dailypick_user', JSON.stringify(currentUser));
            
            // --- NEW: Save the secure token to local storage ---
            if (result.token) {
                localStorage.setItem('adminToken', result.token);
            }
            
            const overlay = document.getElementById('pin-login-overlay');
            if (overlay) overlay.style.display = 'none';
            document.body.classList.remove('locked-login'); // FREEZE FIX
            
            // Clear inputs for security
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
    
    // --- NEW: Clear the secure token on logout ---
    localStorage.removeItem('adminToken');
    
    // Close the secure stream if active
    if (window.adminStreamController) {
        window.adminStreamController.abort();
        window.adminStreamController = null;
    }
    
    currentUser = null;
    const overlay = document.getElementById('pin-login-overlay');
    if (overlay) overlay.style.display = 'flex';
    document.body.classList.add('locked-login'); // FREEZE FIX
    window.clearPinInput();
    
    // Hide user displays
    const display = document.getElementById('current-user-display');
    if (display) display.style.display = 'none';
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'none';
};

// Enforce Role-Based Access Control (RBAC)
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

// Proceed with standard initialization after auth is cleared
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

// --- Phase 6 PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully with scope: ', registration.scope);
            })
            .catch(err => {
                console.error('Service Worker registration failed: ', err);
            });
    });
}
