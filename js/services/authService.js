/* js/services/authService.js */

const AuthManager = (function() {
    // --- Private Methods & Logic ---

    const handlePinInput = function(num) {
        window.currentPin = window.currentPin || '';
        
        if (window.currentPin.length < 4) {
            window.currentPin += num;
            updatePinDisplay();
        }
        if (window.currentPin.length === 4) {
            submitPinLogin();
        }
    };

    const clearPinInput = function() {
        // SECURITY FIX: Explicit nullification ensures immediate V8 garbage collection of sensitive strings
        window.currentPin = null;
        window.currentPin = '';
        updatePinDisplay();
    };

    const updatePinDisplay = function() {
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`pin-dot-${i}`);
            if (dot) {
                if (i <= (window.currentPin || '').length) {
                    const dynamicColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
                    dot.style.background = dynamicColor || '#062C1E'; 
                } else {
                    dot.style.background = 'transparent';
                }
            }
        }
    };

    const submitPinLogin = async function() {
        const usernameInput = document.getElementById('login-username');
        const username = usernameInput ? usernameInput.value.trim() : '';

        if (!username) {
            if (typeof showToast === 'function') showToast("Please enter your Username");
            clearPinInput();
            if (usernameInput) usernameInput.focus();
            return;
        }

        try {
            if (typeof window.BACKEND_URL === 'undefined') {
                if (typeof showToast === 'function') showToast("System Error: Backend URL missing");
                clearPinInput();
                return;
            }

            const res = await fetch(`${window.BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: username, pin: window.currentPin })
            });
            
            const result = await res.json();
            
            if (result.success) {
                window.currentUser = result.data;
                localStorage.setItem('dailypick_user', JSON.stringify(window.currentUser));
                
                if (result.token) {
                    localStorage.setItem('adminToken', result.token);
                }
                
                showLocationSelection();
                
            } else {
                if (typeof showToast === 'function') showToast(result.message || 'Invalid Username or PIN');
                clearPinInput();
            }
        } catch (e) {
            console.error("Login fetch error:", e);
            if (typeof showToast === 'function') showToast('Error connecting to server.');
            clearPinInput();
        }
    };

    const showLocationSelection = async function() {
        try {
            const res = await fetch(`${window.BACKEND_URL}/api/stores`, {
                credentials: 'include' 
            });
            if (res.ok) {
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    document.getElementById('pin-entry-step').style.display = 'none';
                    document.getElementById('location-selection-step').style.display = 'block';
                    
                    const storeSelect = document.getElementById('login-store-select');
                    
                    storeSelect.innerHTML = '';
                    const defaultOpt = document.createElement('option');
                    defaultOpt.value = "";
                    defaultOpt.textContent = "Select Store...";
                    storeSelect.appendChild(defaultOpt);

                    const fragment = document.createDocumentFragment();
                    data.data.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s._id;
                        opt.textContent = `${s.name} (${s.location})`;
                        fragment.appendChild(opt);
                    });
                    storeSelect.appendChild(fragment);
                    return; 
                }
            }
        } catch (e) {}

        finalizeLogin();
    };

    const fetchRegistersForStore = async function(storeId) {
        if (!storeId) return;
        try {
            const res = await fetch(`${window.BACKEND_URL}/api/stores/${storeId}/registers`, {
                credentials: 'include' 
            });
            if (res.ok) {
                const data = await res.json();
                const regSelect = document.getElementById('login-register-select');
                
                regSelect.innerHTML = '';
                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.textContent = "Select Register...";
                regSelect.appendChild(defaultOpt);

                if (data.data) {
                    const fragment = document.createDocumentFragment();
                    data.data.forEach(r => {
                        const opt = document.createElement('option');
                        opt.value = r._id;
                        opt.textContent = r.name;
                        fragment.appendChild(opt);
                    });
                    regSelect.appendChild(fragment);
                }
            }
        } catch (e) { console.error("Error fetching registers", e); }
    };

    const finalizeLogin = function() {
        const storeSelect = document.getElementById('login-store-select');
        const regSelect = document.getElementById('login-register-select');
        
        if (storeSelect && storeSelect.value) {
            window.currentStoreId = storeSelect.value;
            localStorage.setItem('dailypick_storeId', window.currentStoreId);
        }
        if (regSelect && regSelect.value) {
            window.currentRegisterId = regSelect.value;
            localStorage.setItem('dailypick_registerId', window.currentRegisterId);
        }

        const loginContainer = document.getElementById('pin-login-container');
        const appContainer = document.getElementById('app-container');
        const usernameInput = document.getElementById('login-username');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        
        if (usernameInput) usernameInput.value = '';
        clearPinInput();

        applyRoleRestrictions();
        if (typeof window.initializeApp === 'function') window.initializeApp();
        if (typeof showToast === 'function') showToast(`Welcome, ${window.currentUser.name}!`);
    };

    const logoutUser = function() {
        localStorage.removeItem('dailypick_user');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('dailypick_storeId');
        localStorage.removeItem('dailypick_registerId');
        
        if (typeof window.realtimeSocket !== 'undefined' && window.realtimeSocket) {
            window.realtimeSocket.onclose = null; 
            window.realtimeSocket.close();
            window.realtimeSocket = null;
        }
        if (typeof window.realtimeReconnectTimeout !== 'undefined') clearTimeout(window.realtimeReconnectTimeout);
        
        if (typeof window.wakeLock !== 'undefined' && window.wakeLock !== null) {
            window.wakeLock.release().then(() => window.wakeLock = null);
        }

        window.currentUser = null;
        window.currentStoreId = null;
        window.currentRegisterId = null;
        
        // SECURE HARD RESET: Force a full page reload to rebuild the DOM for the next user
        // This is necessary because applyRoleRestrictions() completely deletes unauthorized DOM nodes.
        window.location.reload();
    };

    const applyRoleRestrictions = function() {
        if (!window.currentUser) return;
        const display = document.getElementById('current-user-display');
        if (display) {
            display.innerText = `${window.currentUser.name} (${window.currentUser.role})`;
            display.style.display = 'block';
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'block';

        const adminOnlyElements = document.querySelectorAll('.admin-only');

        if (window.currentUser.role === 'Cashier') {
            const navOverview = document.getElementById('nav-overview');
            const navInventory = document.getElementById('nav-inventory');
            const navAnalytics = document.getElementById('nav-analytics');
            const navCustomers = document.getElementById('nav-customers');
            
            // SECURITY UPGRADE: Hard DOM Removal to prevent developer tools bypass
            if (navOverview) navOverview.remove();
            if (navInventory) navInventory.remove();
            if (navAnalytics) navAnalytics.remove();
            if (navCustomers) navCustomers.remove();
            
            const eodBtn = document.getElementById('eod-report-btn');
            if (eodBtn) eodBtn.remove();

            adminOnlyElements.forEach(el => el.remove());

            // Empty the data-sensitive views physically from the DOM
            const analyticsView = document.getElementById('analytics-view');
            if (analyticsView) analyticsView.innerHTML = '';
            const customersView = document.getElementById('customers-view');
            if (customersView) customersView.innerHTML = '';

            if (typeof window.switchView === 'function') window.switchView('pos'); 
            
        } else {
            // Standard StoreAdmin (or higher) keeps the standard layout
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
    };

    // --- Public API Integration ---
    const publicAPI = {
        init: function() {
            window.handlePinInput = handlePinInput;
            window.clearPinInput = clearPinInput;
            window.updatePinDisplay = updatePinDisplay;
            window.submitPinLogin = submitPinLogin;
            window.showLocationSelection = showLocationSelection;
            window.fetchRegistersForStore = fetchRegistersForStore;
            window.finalizeLogin = finalizeLogin;
            window.logoutUser = logoutUser;
            window.applyRoleRestrictions = applyRoleRestrictions;
        }
    };

    // SECURITY FIX: Freeze object to prevent logic hijacking
    return Object.freeze(publicAPI);
})();

// Bootstrap the module
AuthManager.init();
