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
                    
                    // FIX: Explicitly intercept dead tokens before attempting to parse JSON to prevent ghost sessions
                    if (res.status === 401 || res.status === 403) {
                        console.warn("Session definitively invalid. Forcing logout.");
                        if (typeof window.logoutUser === 'function') window.logoutUser();
                        return; // Stop initialization
                    }

                    const result = await res.json();
                    
                    // FIX: Added safe check for !result.data to prevent TypeError null pointer crashes
                    if (!res.ok || !result.success || !result.data || result.data.role !== window.currentUser.role) {
                        console.warn("Session verification failed. Role mismatch or invalid user. Forcing logout.");
                        if (typeof window.logoutUser === 'function') window.logoutUser();
                        if (typeof showToast === 'function') showToast("Session invalid. Please log in again.");
                        return; // Stop initialization
                    }

                    // Only initialize the app data after verifying the session is 100% valid
                    window.initializeApp();

                } catch (e) {
                    console.warn("Could not reach background verification endpoint. Trusting local session temporarily.", e);
                    // Safe to boot app here because we only hit this if the server is literally unreachable (offline PWA mode)
                    window.initializeApp(); 
                }
                
            } else {
                console.log("No session found. Showing PIN login.");
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
                if (typeof window.fetchGlobalSettings === 'function') window.fetchGlobalSettings(); 
                
                // OPTIMIZATION: Trigger the single master Bootstrap payload instead of 4 separate fetches
                if (typeof window.fetchBootstrapData === 'function') {
                    window.fetchBootstrapData();
                } else {
                    // Fail-safe fallback in case api.js hasn't loaded yet
                    if (typeof fetchCategories === 'function') fetchCategories(); 
                    if (typeof fetchBrands === 'function') fetchBrands();
                    if (typeof fetchDistributors === 'function') fetchDistributors();
                    if (typeof fetchPromotions === 'function') fetchPromotions(); 
                }
                
                if (typeof fetchOrders === 'function') fetchOrders();
                
                // Now calls the decoupled service
                if (typeof window.setupRealtimeConnection === 'function') window.setupRealtimeConnection();
                requestWakeLock(); 

                if (window.currentUser && window.currentUser.role === 'Admin') {
                    if (typeof renderOverview === 'function') renderOverview(); 
                }
                
                if (typeof checkCurrentShift === 'function') checkCurrentShift();
            };
        }
    };
})();

// Initialize the application lifecycle
DailyPickApp.init();
