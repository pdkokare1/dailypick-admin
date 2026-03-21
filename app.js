/* app.js */

let currentUser = null;
let currentPin = '';

// Intercept app initialization to enforce Security PIN
document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem('dailypick_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('pin-login-overlay').style.display = 'none';
        applyRoleRestrictions();
        initializeApp();
    } else {
        document.getElementById('pin-login-overlay').style.display = 'flex';
    }
});

function handlePinInput(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDisplay();
    }
    if (currentPin.length === 4) {
        submitPinLogin();
    }
}

function clearPinInput() {
    currentPin = '';
    updatePinDisplay();
}

function updatePinDisplay() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`pin-dot-${i}`);
        if (i <= currentPin.length) {
            dot.style.background = 'var(--primary)';
        } else {
            dot.style.background = 'transparent';
        }
    }
}

async function submitPinLogin() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin })
        });
        const result = await res.json();
        
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('dailypick_user', JSON.stringify(currentUser));
            document.getElementById('pin-login-overlay').style.display = 'none';
            applyRoleRestrictions();
            initializeApp();
            showToast(`Welcome, ${currentUser.name}!`);
        } else {
            showToast(result.message || 'Invalid PIN');
            clearPinInput();
        }
    } catch (e) {
        showToast('Error connecting to server.');
        clearPinInput();
    }
}

function logoutUser() {
    localStorage.removeItem('dailypick_user');
    currentUser = null;
    document.getElementById('pin-login-overlay').style.display = 'flex';
    clearPinInput();
}

// Enforce Role-Based Access Control (RBAC)
function applyRoleRestrictions() {
    const display = document.getElementById('current-user-display');
    display.innerText = `${currentUser.name} (${currentUser.role})`;
    display.style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';

    if (currentUser.role === 'Cashier') {
        // Lock out sensitive views
        document.getElementById('nav-overview').style.display = 'none';
        document.getElementById('nav-inventory').style.display = 'none';
        document.getElementById('nav-analytics').style.display = 'none';
        document.getElementById('nav-customers').style.display = 'none';
        
        // Hide the manual EOD report button from overview just in case
        const eodBtn = document.getElementById('eod-report-btn');
        if(eodBtn) eodBtn.style.display = 'none';
        
        switchView('pos'); // Force them directly to the Register
    } else {
        // Admin gets full access
        document.getElementById('nav-overview').style.display = 'flex';
        document.getElementById('nav-inventory').style.display = 'flex';
        document.getElementById('nav-analytics').style.display = 'flex';
        document.getElementById('nav-customers').style.display = 'flex';
        
        const eodBtn = document.getElementById('eod-report-btn');
        if(eodBtn) eodBtn.style.display = 'inline-block';
    }
}

// Proceed with standard initialization after auth is cleared
function initializeApp() {
    fetchCategories(); 
    fetchBrands();
    fetchDistributors();
    if(typeof fetchPromotions !== 'undefined') fetchPromotions(); 
    fetchOrders();
    
    if (currentUser && currentUser.role === 'Admin') {
        renderOverview(); 
    }
    
    // Check if the physical cash drawer is currently marked "Open"
    if(typeof checkCurrentShift === 'function') checkCurrentShift();
}
