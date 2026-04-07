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
let globalStoreSettings = {};
let wakeLock = null;

// OPTIMIZED: Centralized modal utility to reduce DOM manipulation boilerplate.
window.toggleModal = function(modalId, forceState) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (forceState !== undefined) {
            forceState ? modal.classList.add('active') : modal.classList.remove('active');
        } else {
            modal.classList.toggle('active');
        }
    }
};

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock released');
            });
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
// PHASE 3 LOGIC (Staff, Promos, Bulk Import)
// ==========================================

window.openStaffModal = async function() {
    window.toggleModal('staff-modal', true);
    await fetchStaff();
};

window.closeStaffModal = function() {
    window.toggleModal('staff-modal', false);
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
    window.toggleModal('promotions-modal', true);
    await fetchPromotionsList();
};

window.closePromotionsModal = function() {
    window.toggleModal('promotions-modal', false);
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
    window.toggleModal('bulk-import-modal', true);
    document.getElementById('bulk-import-results').innerHTML = '';
};

window.closeBulkImportModal = function() {
    window.toggleModal('bulk-import-modal', false);
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
// PHASE 4 LOGIC (Settings, Audits, Transfers)
// ==========================================

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
    window.toggleModal('global-settings-modal', true);
    await window.fetchGlobalSettings();
    document.getElementById('settings-store-name').value = globalStoreSettings.storeName || 'DAILYPICK.';
    document.getElementById('settings-store-address').value = globalStoreSettings.storeAddress || '';
    document.getElementById('settings-contact-phone').value = globalStoreSettings.contactPhone || '';
    document.getElementById('settings-gstin').value = globalStoreSettings.gstin || '';
    document.getElementById('settings-receipt-footer').value = globalStoreSettings.receiptFooterMessage || 'Thank you for shopping with us!';
    document.getElementById('settings-loyalty-value').value = globalStoreSettings.loyaltyPointValue || 100;
};

window.closeSettingsModal = function() {
    window.toggleModal('global-settings-modal', false);
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

window.openSecurityAuditModal = async function() {
    window.toggleModal('security-audit-modal', true);
    await window.fetchAuditLogs();
};

window.closeSecurityAuditModal = function() {
    window.toggleModal('security-audit-modal', false);
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

window.openStockTransferModal = async function() {
    window.toggleModal('stock-transfer-modal', true);
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
    window.toggleModal('stock-transfer-modal', false);
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


// ==========================================
// PHASE 5 LOGIC (AI Forecast, PDF POs, P&L)
// ==========================================

// --- AI Demand Forecasting ---
window.openAIForecastModal = async function() {
    window.toggleModal('ai-forecast-modal', true);
    await window.generateAIForecast();
};

window.closeAIForecastModal = function() {
    window.toggleModal('ai-forecast-modal', false);
};

window.generateAIForecast = async function() {
    const container = document.getElementById('ai-forecast-container');
    
    // Reset to loading state
    container.innerHTML = `
        <div class="skeleton" style="height: 60px;"></div>
        <div class="skeleton" style="height: 60px;"></div>
        <div class="skeleton" style="height: 60px;"></div>
    `;

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/forecast`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success && data.data && data.data.recommendations) {
            container.innerHTML = '';
            
            if (data.data.recommendations.length === 0) {
                container.innerHTML = `<p class="empty-state" style="color: #10b981;">${data.data.message || 'Inventory is healthy. No critical action needed.'}</p>`;
                return;
            }

            data.data.recommendations.forEach(rec => {
                let badgeColor = rec.priority === 'CRITICAL' ? '#ef4444' : (rec.priority === 'HIGH' ? '#f59e0b' : '#3b82f6');
                
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; border-left: 4px solid ${badgeColor};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <strong style="font-size:15px; color:var(--text-main);">${rec.itemName}</strong>
                            <span style="background:${badgeColor}20; color:${badgeColor}; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px;">${rec.priority}</span>
                        </div>
                        <p style="font-size:13px; font-weight:700; color:var(--primary); margin-bottom:4px;"><i data-lucide="zap" class="icon-sm"></i> Action: ${rec.suggestedAction}</p>
                        <p style="font-size:12px; color:var(--text-muted); line-height:1.4;">${rec.reasoning}</p>
                    </div>
                `;
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            container.innerHTML = `<p class="empty-state" style="color:#ef4444;">${data.message || 'Could not generate forecast.'}</p>`;
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Network Error while contacting AI Engine.</p>`;
    }
};

// --- PDF Purchase Orders (B2B Sourcing Override) ---
// Overriding the existing openSourcingModal to inject the PDF generator button
window.openSourcingModal = function() {
    const listContainer = document.getElementById('sourcing-list-container');
    listContainer.innerHTML = '';
    
    let supplierMap = {};
    
    currentInventory.forEach(p => {
        if(p.variants) {
            p.variants.forEach(v => {
                if(v.stock <= (v.lowStockThreshold || 5)) {
                    let dist = p.distributorName || 'Unassigned Supplier';
                    if(!supplierMap[dist]) supplierMap[dist] = [];
                    supplierMap[dist].push(`${p.name} (${v.weightOrVolume}) - Current Stock: ${v.stock}`);
                }
            });
        }
    });
    
    if(Object.keys(supplierMap).length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Inventory is healthy. No items require sourcing.</p>';
    } else {
        Object.keys(supplierMap).forEach(dist => {
            const items = supplierMap[dist];
            const safeItemsJson = JSON.stringify(items).replace(/"/g, '&quot;');
            
            const msg = `Hi ${dist},%0AWe need to restock the following items for our supermarket:%0A%0A` + items.map(i => `- ${i}`).join('%0A') + `%0A%0APlease arrange delivery ASAP.`;
            
            listContainer.innerHTML += `
                <div class="sourcing-item">
                    <div>
                        <h4 style="font-size:14px; margin-bottom:4px;">${dist}</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">${items.length} items to order</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="primary-btn-small" style="background:#ef4444; color:white; border:none;" onclick="generatePDFPO('${dist}', ${safeItemsJson})" title="Download PDF PO"><i data-lucide="file-text" class="icon-sm" style="margin:0;"></i></button>
                        <a href="https://wa.me/?text=${msg}" target="_blank" class="whatsapp-btn" style="margin:0;"><i data-lucide="message-circle" class="icon-sm"></i> WhatsApp</a>
                    </div>
                </div>
            `;
        });
    }
    
    window.toggleModal('sourcing-modal', true);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.generatePDFPO = function(distributorName, itemsList) {
    if (typeof window.jspdf === 'undefined') {
        return showToast("PDF Library is still loading...");
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let storeName = (globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
    let storeAddress = (globalStoreSettings && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "Retail Supermarket";
    let gstin = (globalStoreSettings && globalStoreSettings.gstin) ? globalStoreSettings.gstin : "N/A";
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PURCHASE ORDER", 105, 20, null, null, "center");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Buyer: ${storeName}`, 14, 35);
    doc.text(`Address: ${storeAddress}`, 14, 40);
    doc.text(`GSTIN: ${gstin}`, 14, 45);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Supplier: ${distributorName}`, 140, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 40);
    doc.text(`PO Ref: PO-${Date.now().toString().slice(-6)}`, 140, 45);
    
    const tableData = itemsList.map((itemStr, index) => {
        // Parse the string "Product Name (Variant) - Current Stock: X"
        const parts = itemStr.split(' - Current Stock: ');
        return [
            index + 1,
            parts[0] || itemStr,
            "10 (Suggested)", // Default suggestion for PO
            "__________" // Blank line for supplier to fill price
        ];
    });

    doc.autoTable({
        startY: 55,
        head: [['#', 'Item Description', 'Requested Qty', 'Unit Price']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [6, 44, 30] }, // Match UI Primary Color
        styles: { fontSize: 10 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 60;
    doc.text("Authorized Signature: _______________________", 14, finalY + 30);
    
    doc.save(`PO_${distributorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast(`PDF Generated for ${distributorName}`);
};

// --- Advanced Financials P&L Export ---
window.exportPnLReport = async function() {
    if (typeof window.jspdf === 'undefined') return showToast("PDF Library loading...");
    
    showToast("Calculating Financials...");
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        // Fetch 30-day P&L
        const d = new Date();
        const endDate = d.toISOString();
        d.setDate(d.getDate() - 30);
        const startDate = d.toISOString();
        
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/pnl?startDate=${startDate}&endDate=${endDate}`);
        const data = await res.json();
        
        if (!data.success || !data.data) {
            return showToast("Failed to fetch financial data.");
        }
        
        const metrics = data.data;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let storeName = (globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(`${storeName} - Financial Report (P&L)`, 105, 20, null, null, "center");
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Report Period: Last 30 Days (${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()})`, 105, 28, null, null, "center");
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 105, 33, null, null, "center");

        const tableData = [
            ['Gross Revenue (Sales)', `Rs. ${metrics.totalRevenue.toFixed(2)}`],
            ['Cost of Goods Sold (COGS)', `- Rs. ${metrics.totalCOGS.toFixed(2)}`],
            ['Taxes Collected (GST)', `- Rs. ${metrics.totalTax.toFixed(2)}`],
            ['Discounts Provided', `- Rs. ${metrics.totalDiscounts.toFixed(2)}`],
            ['Gross Profit', `Rs. ${metrics.grossProfit.toFixed(2)}`],
            ['Operational Expenses', `- Rs. ${metrics.totalExpenses.toFixed(2)}`],
            ['Net Profit / Loss', `Rs. ${metrics.netProfit.toFixed(2)}`]
        ];

        doc.autoTable({
            startY: 45,
            head: [['Financial Metric', 'Value (INR)']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }, 
            styles: { fontSize: 11, cellPadding: 6 },
            didParseCell: function(data) {
                if (data.row.index === 4 || data.row.index === 6) { // Bold Profit Rows
                    data.cell.styles.fontStyle = 'bold';
                    if (data.row.index === 6) {
                        data.cell.styles.textColor = metrics.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68];
                    }
                }
            }
        });
        
        doc.save(`${storeName.replace(/\s+/g, '_')}_PnL_Report.pdf`);
        showToast("P&L Report Downloaded!");

    } catch (e) {
        showToast("Error generating P&L.");
    }
};
