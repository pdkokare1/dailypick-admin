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

// --- PHASE 4 GLOBAL STATE ---
let globalStoreSettings = {};

// --- OPTIMIZED: Kiosk Mode Screen Wake Lock ---
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
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
    if (wakeLock === null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// --- NEW FUNCTIONALITY: Prevent Accidental Tab Closure ---
window.addEventListener('beforeunload', function (e) {
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
                
                // FIX: Successfully log connection to verify the backend is holding the line open
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

    const adminOnlyElements = document.querySelectorAll('.admin-only');

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

        adminOnlyElements.forEach(el => el.style.display = 'none');
        
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

        adminOnlyElements.forEach(el => el.style.display = 'inline-flex');
    }
}

function initializeApp() {
    console.log("Initializing app modules...");
    if (typeof window.fetchGlobalSettings === 'function') window.fetchGlobalSettings(); 
    if (typeof fetchCategories === 'function') fetchCategories(); 
    if (typeof fetchBrands === 'function') fetchBrands();
    if (typeof fetchDistributors === 'function') fetchDistributors();
    if (typeof fetchPromotions === 'function') fetchPromotions(); 
    if (typeof fetchOrders === 'function') fetchOrders();
    
    window.setupRealtimeConnection();
    requestWakeLock(); 

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

// ==========================================
// PHASE 3 LOGIC ADDITIONS
// ==========================================

window.openStaffModal = async function() {
    document.getElementById('staff-modal').classList.add('active');
    await fetchStaff();
};

window.closeStaffModal = function() {
    document.getElementById('staff-modal').classList.remove('active');
};

window.fetchStaff = async function() {
    const container = document.getElementById('staff-list-container');
    container.innerHTML = '<p class="empty-state">Loading staff...</p>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/users/staff`); 
        if (!res.ok) throw new Error('Failed to load staff');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(user => {
                const roleBadgeColor = user.role === 'Admin' ? '#8b5cf6' : '#10b981';
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">${user.name}</p>
                            <p style="font-size: 12px; color: var(--text-muted); font-weight: 600;">@${user.username}</p>
                        </div>
                        <span style="background: ${roleBadgeColor}20; color: ${roleBadgeColor}; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800;">${user.role}</span>
                    </div>
                `;
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            container.innerHTML = '<p class="empty-state">No active staff found.</p>';
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Error: ${e.message}</p>`;
    }
};

window.submitNewStaff = async function(e) {
    e.preventDefault();
    const name = document.getElementById('new-staff-name').value.trim();
    const username = document.getElementById('new-staff-username').value.trim();
    const pin = document.getElementById('new-staff-pin').value.trim();
    const role = document.getElementById('new-staff-role').value;

    if (!name || !username || pin.length !== 4) {
        showToast("Please provide valid details. PIN must be 4 digits.");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, pin, role })
        });
        const data = await res.json();
        if (data.success) {
            showToast("User created successfully!");
            document.getElementById('new-staff-name').value = '';
            document.getElementById('new-staff-username').value = '';
            document.getElementById('new-staff-pin').value = '';
            await fetchStaff();
        } else {
            showToast(data.message || "Failed to create user");
        }
    } catch (e) {
        showToast("Network Error: Could not save user.");
    }
};

window.openPromotionsModal = async function() {
    document.getElementById('promotions-modal').classList.add('active');
    await fetchPromotionsList();
};

window.closePromotionsModal = function() {
    document.getElementById('promotions-modal').classList.remove('active');
};

window.fetchPromotionsList = async function() {
    const container = document.getElementById('promotions-list-container');
    container.innerHTML = '<p class="empty-state">Loading active promotions...</p>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/promotions`); 
        if (!res.ok) throw new Error('Failed to load promotions');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(promo => {
                const isPercentage = promo.discountType === 'percentage';
                const discountText = isPercentage ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`;
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-weight: 800; font-size: 15px; margin-bottom: 4px; color: #BE185D;">${promo.code}</p>
                            <p style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Min Order: ₹${promo.minOrderValue || 0}</p>
                        </div>
                        <span style="background: #FBCFE8; color: #9D174D; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800;">${discountText}</span>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">No active promotions.</p>';
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Error: ${e.message}</p>`;
    }
};

window.submitNewPromotion = async function(e) {
    e.preventDefault();
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    const type = document.getElementById('promo-type').value;
    const value = parseFloat(document.getElementById('promo-value').value);
    const minOrder = parseFloat(document.getElementById('promo-min-order').value) || 0;

    if (!code || isNaN(value)) {
        showToast("Valid code and discount value required.");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/promotions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discountType: type, discountValue: value, minOrderValue: minOrder })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Promotion launched!");
            document.getElementById('promo-code').value = '';
            document.getElementById('promo-value').value = '';
            document.getElementById('promo-min-order').value = '';
            await fetchPromotionsList();
            if (typeof fetchPromotions === 'function') fetchPromotions(); 
        } else {
            showToast(data.message || "Failed to create promo");
        }
    } catch (e) {
        showToast("Network Error: Could not save promo.");
    }
};

window.openBulkImportModal = function() {
    document.getElementById('bulk-import-modal').classList.add('active');
    document.getElementById('bulk-import-results').innerHTML = '';
};

window.closeBulkImportModal = function() {
    document.getElementById('bulk-import-modal').classList.remove('active');
    document.getElementById('bulk-csv-upload').value = '';
};

window.downloadSampleCSV = function() {
    const csvContent = "data:text/csv;charset=utf-8,Name,Category,Brand,Distributor,Barcode/SKU,Cost Price,Selling Price,Stock,Weight/Volume\nSample Apple,Fruits,,Supplier A,1001,40,50,100,1kg\nSample Milk,Dairy,FreshCo,,1002,25,30,50,500ml";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "DailyPick_Bulk_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.submitBulkImport = async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('bulk-csv-upload');
    const btn = document.getElementById('bulk-import-submit-btn');
    const resultsDiv = document.getElementById('bulk-import-results');

    if (fileInput.files.length === 0) {
        showToast("Please select a CSV file.");
        return;
    }

    const file = fileInput.files[0];
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
        showToast("Invalid file format. Please upload a .csv file.");
        return;
    }

    btn.innerText = "Processing...";
    btn.disabled = true;
    resultsDiv.innerHTML = '<span style="color:#0ea5e9;">Uploading and processing. Do not close this window...</span>';

    try {
        const formData = new FormData();
        formData.append('csvFile', file);

        const res = await fetch(`${BACKEND_URL}/api/products/bulk`, {
            method: 'POST',
            body: formData 
        });

        const data = await res.json();
        if (data.success) {
            resultsDiv.innerHTML = `<span style="color:#10b981;">✅ Import Successful! Loaded ${data.count || 'multiple'} items.</span>`;
            showToast("Bulk import successful.");
            if (typeof fetchInventory === 'function') fetchInventory(); 
            fileInput.value = '';
        } else {
            resultsDiv.innerHTML = `<span style="color:#ef4444;">❌ Error: ${data.message || 'Data formatting issue.'}</span>`;
            showToast("Import failed. Check format.");
        }
    } catch (e) {
        console.error(e);
        resultsDiv.innerHTML = `<span style="color:#ef4444;">❌ Network Error during upload.</span>`;
        showToast("Network Error.");
    } finally {
        btn.innerHTML = `<i data-lucide="upload-cloud" class="icon-sm"></i> Start Import`;
        btn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ==========================================
// PHASE 4 LOGIC ADDITIONS
// ==========================================

// --- GLOBAL SETTINGS ---
window.fetchGlobalSettings = async function() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/settings`);
        const data = await res.json();
        if (data.success && data.data) {
            globalStoreSettings = data.data;
        }
    } catch (e) {
        console.warn("Could not fetch global settings", e);
    }
};

window.openSettingsModal = async function() {
    document.getElementById('global-settings-modal').classList.add('active');
    await window.fetchGlobalSettings();
    document.getElementById('settings-store-name').value = globalStoreSettings.storeName || 'DAILYPICK.';
    document.getElementById('settings-store-address').value = globalStoreSettings.storeAddress || '';
    document.getElementById('settings-contact-phone').value = globalStoreSettings.contactPhone || '';
    document.getElementById('settings-gstin').value = globalStoreSettings.gstin || '';
    document.getElementById('settings-receipt-footer').value = globalStoreSettings.receiptFooterMessage || 'Thank you for shopping with us!';
    document.getElementById('settings-loyalty-value').value = globalStoreSettings.loyaltyPointValue || 100;
};

window.closeSettingsModal = function() {
    document.getElementById('global-settings-modal').classList.remove('active');
};

window.submitSettings = async function(e) {
    e.preventDefault();
    const payload = {
        storeName: document.getElementById('settings-store-name').value,
        storeAddress: document.getElementById('settings-store-address').value,
        contactPhone: document.getElementById('settings-contact-phone').value,
        gstin: document.getElementById('settings-gstin').value,
        receiptFooterMessage: document.getElementById('settings-receipt-footer').value,
        loyaltyPointValue: Number(document.getElementById('settings-loyalty-value').value) || 100
    };

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            globalStoreSettings = data.data;
            showToast("Global settings updated!");
            closeSettingsModal();
        } else {
            showToast("Failed to save settings.");
        }
    } catch (e) {
        showToast("Network Error.");
    }
};

// --- SECURITY AUDITS ---
window.openSecurityAuditModal = async function() {
    document.getElementById('security-audit-modal').classList.add('active');
    await window.fetchAuditLogs();
};

window.closeSecurityAuditModal = function() {
    document.getElementById('security-audit-modal').classList.remove('active');
};

window.fetchAuditLogs = async function() {
    const container = document.getElementById('audit-logs-container');
    container.innerHTML = '<p class="empty-state">Loading logs...</p>';
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/audit?limit=50`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(log => {
                const time = new Date(log.createdAt).toLocaleString();
                const actionColor = log.action.includes('FAILED') ? '#ef4444' : '#3b82f6';
                let detailsHtml = '';
                if (log.details) {
                    detailsHtml = `<p style="font-size: 10px; color: var(--text-muted); margin-top: 4px; font-family: monospace;">${JSON.stringify(log.details)}</p>`;
                }
                container.innerHTML += `
                    <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; border-left: 3px solid ${actionColor};">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size: 13px; color: ${actionColor};">${log.action}</strong>
                            <span style="font-size: 11px; color: var(--text-muted);">${time}</span>
                        </div>
                        <p style="font-size: 12px; font-weight: 600; margin-top: 4px;">User: @${log.username || 'System'}</p>
                        <p style="font-size: 11px; color: var(--text-main); margin-top: 2px;">Target: ${log.targetType} (${log.targetId})</p>
                        ${detailsHtml}
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">No audit logs found.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color:#ef4444;">Error loading logs.</p>';
    }
};

// --- STOCK TRANSFER ---
window.openStockTransferModal = async function() {
    document.getElementById('stock-transfer-modal').classList.add('active');
    document.getElementById('transfer-selected-item').classList.add('hidden');
    document.getElementById('submit-transfer-btn').disabled = true;
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/stores`);
        const data = await res.json();
        if (data.success) {
            const fromSelect = document.getElementById('transfer-from-store');
            const toSelect = document.getElementById('transfer-to-store');
            let options = '<option value="">Select Store...</option>';
            data.data.forEach(s => {
                options += `<option value="${s._id}">${s.name} (${s.location})</option>`;
            });
            fromSelect.innerHTML = options;
            toSelect.innerHTML = options;
        }
    } catch (e) {
        console.error("Failed to load stores for transfer", e);
    }
};

window.closeStockTransferModal = function() {
    document.getElementById('stock-transfer-modal').classList.remove('active');
    document.getElementById('transfer-search').value = '';
    document.getElementById('transfer-search-results').innerHTML = '';
    document.getElementById('transfer-qty').value = '';
};

window.searchTransferItem = function() {
    const query = document.getElementById('transfer-search').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('transfer-search-results');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }

    let resultsHTML = '';
    const matches = currentInventory.filter(p => p.name.toLowerCase().includes(query) || (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(query)))).slice(0, 5);

    matches.forEach(p => {
        if (p.variants) {
            p.variants.forEach(v => {
                resultsHTML += `
                    <div class="restock-result-item" onclick="selectTransferItem('${p._id}', '${v._id}', '${p.name.replace(/'/g, "\\'")}', '${v.weightOrVolume}')">
                        <strong>${p.name}</strong> <span style="color:var(--text-muted); font-size:12px;">(${v.weightOrVolume})</span>
                        <div style="font-size:11px; color:#10b981;">Total Stock: ${v.stock}</div>
                    </div>
                `;
            });
        }
    });

    resultsDiv.innerHTML = resultsHTML || '<div style="padding:12px; font-size:12px;">No matches found</div>';
};

window.selectTransferItem = function(pId, vId, pName, vName) {
    document.getElementById('transfer-product-id').value = pId;
    document.getElementById('transfer-variant-id').value = vId;
    document.getElementById('transfer-item-name').innerText = pName;
    document.getElementById('transfer-item-variant').innerText = vName;
    
    document.getElementById('transfer-search-results').innerHTML = '';
    document.getElementById('transfer-search').value = '';
    
    document.getElementById('transfer-selected-item').classList.remove('hidden');
    window.validateTransferStores();
};

window.validateTransferStores = function() {
    const pId = document.getElementById('transfer-product-id').value;
    const fromS = document.getElementById('transfer-from-store').value;
    const toS = document.getElementById('transfer-to-store').value;
    const btn = document.getElementById('submit-transfer-btn');
    
    if (pId && fromS && toS && fromS !== toS) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
};

window.submitStockTransfer = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-transfer-btn');
    btn.disabled = true;
    btn.innerText = 'Transferring...';

    const payload = {
        productId: document.getElementById('transfer-product-id').value,
        variantId: document.getElementById('transfer-variant-id').value,
        fromStoreId: document.getElementById('transfer-from-store').value,
        toStoreId: document.getElementById('transfer-to-store').value,
        quantity: Number(document.getElementById('transfer-qty').value)
    };

    if (payload.fromStoreId === payload.toStoreId) {
        showToast("Source and destination must be different.");
        btn.disabled = false;
        btn.innerText = 'Transfer Stock';
        return;
    }

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast("Stock transferred successfully!");
            closeStockTransferModal();
            if (typeof fetchInventory === 'function') fetchInventory();
        } else {
            showToast(data.message || "Failed to transfer stock.");
        }
    } catch (err) {
        showToast("Network Error.");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Transfer Stock';
    }
};
