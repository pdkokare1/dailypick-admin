/* app.js */

let currentUser = null;
let currentPin = '';

// Intercept app initialization to enforce Security PIN
document.addEventListener("DOMContentLoaded", () => {
    console.log("App initializing, checking for saved session...");
    const savedUser = localStorage.getItem('dailypick_user');
    const overlay = document.getElementById('pin-login-overlay');
    
    if (savedUser) {
        console.log("Found saved session:", savedUser);
        currentUser = JSON.parse(savedUser);
        if (overlay) overlay.style.display = 'none';
        applyRoleRestrictions();
        initializeApp();
    } else {
        console.log("No session found. Showing PIN login.");
        if (overlay) overlay.style.display = 'flex';
    }
});

// Keyboard support for PIN entry
document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('pin-login-overlay');
    if (overlay && overlay.style.display !== 'none') {
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
                // MODIFIED: dynamically reads CSS variable with a safe hardcoded fallback
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
            body: JSON.stringify({ pin: currentPin })
        });
        
        const result = await res.json();
        console.log("Login response:", result);
        
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('dailypick_user', JSON.stringify(currentUser));
            const overlay = document.getElementById('pin-login-overlay');
            if (overlay) overlay.style.display = 'none';
            applyRoleRestrictions();
            initializeApp();
            if (typeof showToast === 'function') showToast(`Welcome, ${currentUser.name}!`);
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Invalid PIN');
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
    currentUser = null;
    const overlay = document.getElementById('pin-login-overlay');
    if (overlay) overlay.style.display = 'flex';
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
