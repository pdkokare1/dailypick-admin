/* app.js */

// Encapsulated DailyPick Admin Application Controller
const DailyPickApp = (function() {
    // --- Private State ---
    let currentUser = null;
    let currentPin = '';
    let globalStoreSettings = {};
    let wakeLock = null;

    // --- Private Methods ---
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

    function setupEventListeners() {
        
        // --- NEW: PARTNER GATEWAY ROUTING ---
        window.selectPartnerRole = function(role) {
            const gateway = document.getElementById('partner-gateway-step');
            const pinEntry = document.getElementById('pin-entry-step');
            if (gateway && pinEntry) {
                gateway.style.display = 'none';
                pinEntry.style.display = 'block';
            }
            
            const titleEl = document.getElementById('login-role-title');
            if (titleEl) {
                if (role === 'Shop') titleEl.textContent = 'Local Shop Terminal';
                else if (role === 'Enterprise') titleEl.textContent = 'Enterprise Hub Login';
                else if (role === 'Distributor') titleEl.textContent = 'Distributor Portal';
                else if (role === 'Delivery_Agent') titleEl.textContent = 'Fleet Rider Login';
            }
            window.intendedLoginRole = role;
        };

        window.backToGateway = function() {
            const gateway = document.getElementById('partner-gateway-step');
            const pinEntry = document.getElementById('pin-entry-step');
            if (gateway && pinEntry) {
                pinEntry.style.display = 'none';
                gateway.style.display = 'block';
            }
            window.intendedLoginRole = null;
        };

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

        async function initializeSession() {
            console.log("App initializing, checking for saved session...");
            const savedUser = localStorage.getItem('dailypick_user');
            const loginContainer = document.getElementById('pin-login-container');
            const appContainer = document.getElementById('app-container');
            
            if (savedUser) {
                console.log("Found saved session:", savedUser);
                
                // Maintain global reference for cross-file compatibility
                window.currentUser = JSON.parse(savedUser);
                currentUser = window.currentUser;
                
                if (loginContainer) loginContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = 'block';
                
                if (typeof window.applyRoleRestrictions === 'function') window.applyRoleRestrictions();
                
                try {
                    const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/auth/verify?id=${window.currentUser._id || window.currentUser.id}`);
                    
                    if (res.status === 401 || res.status === 403) {
                        console.warn("Session definitively invalid. Forcing logout.");
                        if (typeof window.logoutUser === 'function') window.logoutUser();
                        return; 
                    }

                    const result = await res.json();
                    
                    if (!res.ok || !result.success || !result.data || result.data.role !== window.currentUser.role) {
                        console.warn("Session verification failed. Role mismatch or invalid user. Forcing logout.");
                        if (typeof window.logoutUser === 'function') window.logoutUser();
                        if (typeof showToast === 'function') showToast("Session invalid. Please log in again.");
                        return; 
                    }

                    window.initializeApp();

                } catch (e) {
                    console.warn("Could not reach background verification endpoint. Trusting local session temporarily.", e);
                    window.initializeApp(); 
                }
                
            } else {
                console.log("No session found. Showing Partner Gateway.");
                if (loginContainer) loginContainer.style.display = 'flex';
                if (appContainer) appContainer.style.display = 'none';
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeSession);
        } else {
            initializeSession();
        }

        document.addEventListener('keydown', (e) => {
            const loginContainer = document.getElementById('pin-login-container');
            if (loginContainer && loginContainer.style.display !== 'none' && document.activeElement.id !== 'login-username') {
                if (e.key >= '0' && e.key <= '9') {
                    if (typeof window.handlePinInput === 'function') window.handlePinInput(e.key);
                } else if (e.key === 'Backspace' || e.key === 'Delete') {
                    if (typeof window.clearPinInput === 'function') window.clearPinInput();
                }
            }

            if ((e.ctrlKey || e.metaKey) && ['p', 's', 'j', 'g', 'f', 'o'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                console.warn(`Blocked potentially dangerous scanner shortcut: Ctrl+${e.key}`);
            }
        });

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
    }

    // --- Public API ---
    return {
        init: function() {
            setupEventListeners();
            
            // Expose initializeApp globally as before to ensure other scripts don't break
            window.initializeApp = function() {
                
                if (!window.currentUser) return;

                // --- NEW: STRICT ROLE-BASED DATA FENCING ---
                
                // 1. Rider Dashboard Isolation (Saves Mobile Battery & Data)
                if (window.currentUser.role === 'Delivery_Agent') {
                    const nav = document.querySelector('.bottom-nav');
                    const headerSearch = document.querySelector('.header-search-container');
                    
                    if (nav) nav.style.display = 'none';
                    if (headerSearch) headerSearch.style.display = 'none';
                    
                    document.getElementById('header-subtitle').textContent = 'Fleet Operations';
                    if (typeof showToast === 'function') showToast("Rider Mode Active (GPS Tracking Initiated)");
                    
                    // Bail early so POS/Inventory fetchers do not run for riders
                    return; 
                }

                // 2. Global Startup Configuration (Applies to Cashier, Admin, Enterprise)
                if (typeof window.fetchGlobalSettings === 'function') window.fetchGlobalSettings(); 
                if (typeof window.setupRealtimeConnection === 'function') window.setupRealtimeConnection();
                requestWakeLock(); 
                if (typeof checkCurrentShift === 'function') checkCurrentShift();

                // 3. Fenced Data Fetching
                if (window.currentUser.role === 'Admin' || window.currentUser.role === 'StoreAdmin') {
                    // Full access fetch
                    if (typeof window.fetchBootstrapData === 'function') {
                        window.fetchBootstrapData();
                    } else {
                        if (typeof fetchCategories === 'function') fetchCategories(); 
                        if (typeof fetchBrands === 'function') fetchBrands();
                        if (typeof fetchDistributors === 'function') fetchDistributors();
                        if (typeof fetchPromotions === 'function') fetchPromotions(); 
                    }
                    if (typeof fetchOrders === 'function') fetchOrders();
                    if (typeof renderOverview === 'function') renderOverview(); 
                } 
                else if (window.currentUser.role === 'Cashier') {
                    // Cashiers only fetch what is strictly necessary to run the POS register
                    if (typeof fetchCategories === 'function') fetchCategories(); 
                    // INTENTIONALLY OMITTED: fetchOrders(), fetchAnalytics(), fetchCustomers().
                }
                else if (window.currentUser.role === 'Enterprise' || window.currentUser.role === 'Distributor') {
                    // Specific partner fetches will initialize their dedicated portlets.
                    if (typeof renderOverview === 'function') renderOverview(); 
                }
            };
        }
    };
})();

// Initialize the application lifecycle
DailyPickApp.init();
