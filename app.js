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
                
                // ENTERPRISE OPTIMIZATION: Optimistic UI Boot.
                // Immediately grant access to the POS using the cached token, eliminating network lag on startup.
                window.initializeApp();

                // BACKGROUND TASK: Verify the session securely without blocking the main thread.
                window.adminFetchWithAuth(`${window.BACKEND_URL}/api/auth/verify?id=${window.currentUser._id || window.currentUser.id}`)
                    .then(async (res) => {
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
                        }
                    })
                    .catch(e => {
                        console.warn("Could not reach background verification endpoint. Trusting local session temporarily.", e);
                    });
                
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
            
            window.initializeApp = function() {
                
                if (!window.currentUser) return;

                // --- PHASE 3: STRICT DATA FENCING FOR OPERATIONAL ENGINES ---
                
                // 1. Last Mile Fleet Engine
                if (window.currentUser.role === 'Delivery_Agent') {
                    const nav = document.querySelector('.bottom-nav');
                    const headerSearch = document.querySelector('.header-search-container');
                    
                    if (nav) nav.style.display = 'none';
                    if (headerSearch) headerSearch.style.display = 'none';
                    
                    document.getElementById('header-subtitle').textContent = 'Fleet Operations';
                    if (typeof showToast === 'function') showToast("Rider Mode Active (GPS Tracking Initiated)");
                    
                    // Route strictly to the platform delivery queue via the backend
                    if (typeof fetchOrders === 'function') {
                        // In production, this would append `?fulfillmentType=PLATFORM_DELIVERY` to the API call
                        fetchOrders(); 
                    }
                    if (typeof window.switchView === 'function') window.switchView('orders');
                    return; 
                }

                // 2. B2B Wholesale Portal Engine
                if (window.currentUser.role === 'Distributor') {
                    const nav = document.querySelector('.bottom-nav');
                    const headerSearch = document.querySelector('.header-search-container');
                    
                    if (nav) nav.style.display = 'none';
                    if (headerSearch) headerSearch.style.display = 'none';

                    document.getElementById('header-subtitle').textContent = 'B2B Wholesale Portal';
                    if (typeof showToast === 'function') showToast("Supplier Dashboard Active");
                    
                    // Ensure Distributors only fetch their own POs, bypassing B2C logic
                    if (typeof fetchOrders === 'function') {
                        // Uses the newly created B2B route
                        window.currentFetchOrderUrlOverride = `${window.BACKEND_URL}/api/distributors/${window.currentUser.distributorId || window.currentUser._id}/orders`;
                        fetchOrders();
                    }
                    if (typeof window.switchView === 'function') window.switchView('orders');
                    return;
                }

                // 3. Global Startup Configuration (Applies to Cashier, Admin, Enterprise)
                if (typeof window.fetchGlobalSettings === 'function') window.fetchGlobalSettings(); 
                if (typeof window.setupRealtimeConnection === 'function') window.setupRealtimeConnection();
                requestWakeLock(); 
                if (typeof checkCurrentShift === 'function') checkCurrentShift();

                // 4. Fenced Data Fetching
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
                }
                else if (window.currentUser.role === 'Enterprise') {
                    // 5. Strict RBAC & Conditional UI for Enterprise
                    const navPos = document.getElementById('nav-pos');
                    const navCust = document.getElementById('nav-customers');
                    const shiftBtn = document.querySelector('button[onclick="openShiftModal()"]');
                    
                    if (navPos) navPos.classList.add('hidden');
                    if (navCust) navCust.classList.add('hidden');
                    if (shiftBtn) shiftBtn.classList.add('hidden');

                    if (typeof renderOverview === 'function') renderOverview(); 
                }
            };
        }
    };
})();

// Initialize the application lifecycle
DailyPickApp.init();
