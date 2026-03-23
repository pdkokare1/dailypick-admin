// NEW: Added to store active promotions from Phase 1
let currentPromotions = []; 

// --- NEW: Authentication Wrapper for Admin Requests ---
async function adminFetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('adminToken'); // Assumes token is saved here on login
    
    // Initialize headers if they don't exist
    options.headers = options.headers || {};
    
    // Attach JWT Token
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, options);
    
    // Global Error Intercepting for Security
    if (response.status === 401 || response.status === 403) {
        console.warn('Authentication failed for:', url);
        if (typeof showToast === 'function') {
            showToast('Session Expired or Access Denied. Please log in again.');
        }
    }
    
    return response;
}

// MODIFIED: Appended token to URL because EventSource cannot send Headers
function connectAdminLiveStream() {
    if (adminEventSource) return; 
    
    const token = localStorage.getItem('adminToken') || '';
    adminEventSource = new EventSource(`${BACKEND_URL}/api/orders/stream/admin?token=${token}`);
    
    adminEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER') {
            currentOrders.unshift(data.order);
            updateDashboard();
            playNewOrderAudio(); 
            showToast('🚨 New Order Arrived!');
        }
    };
    
    adminEventSource.onerror = (error) => {
        console.warn("SSE Connection interrupted. Browser is handling auto-reconnection...", error);
    };
}

function populateDropdowns(data, selectConfigs) {
    selectConfigs.forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;

        select.innerHTML = (data.length === 0 && config.emptyHTML) 
            ? config.emptyHTML 
            : (config.defaultHTML || '');

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.innerText = item.name;
            select.appendChild(option);
        });
    });
}

// MODIFIED: Now uses adminFetchWithAuth
async function fetchCategories() {
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        
        if (result.success) { 
            currentCategories = result.data;
            populateDropdowns(currentCategories, [
                { id: 'new-category', emptyHTML: '<option value="" disabled selected>No Categories Created</option>' },
                { id: 'inventory-cat-filter', defaultHTML: '<option value="All">All Categories</option>' }
            ]);
        }
    } catch (e) { 
        console.error("Error loading categories", e); 
        if (typeof showToast === 'function') showToast("Error loading categories from server");
    }
}

// MODIFIED: Now uses adminFetchWithAuth
async function fetchBrands() {
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/brands`);
        const result = await res.json();
        
        if (result.success) {
            currentBrands = result.data;
            populateDropdowns(currentBrands, [
                { id: 'new-brand', defaultHTML: '<option value="">Select Brand (Optional)</option>' },
                { id: 'inventory-brand-filter', defaultHTML: '<option value="All">All Brands</option>' }
            ]);
        }
    } catch (e) { 
        console.error("Error loading brands", e); 
        if (typeof showToast === 'function') showToast("Error loading brands from server");
    }
}

// MODIFIED: Now uses adminFetchWithAuth
async function fetchDistributors() {
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        
        if (result.success) {
            currentDistributors = result.data;
            populateDropdowns(currentDistributors, [
                { id: 'new-distributor', defaultHTML: '<option value="">Select Distributor (Optional)</option>' },
                { id: 'restock-distributor', defaultHTML: '<option value="">Select a Distributor</option>' },
                { id: 'inventory-dist-filter', defaultHTML: '<option value="All">All Distributors</option>' }
            ]);
        }
    } catch (e) { 
        console.error("Error loading distributors", e); 
        if (typeof showToast === 'function') showToast("Error loading distributors from server");
    }
}

// MODIFIED: Now uses adminFetchWithAuth
async function fetchPromotions() {
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/promotions?all=false`);
        const result = await res.json();
        if (result.success) {
            currentPromotions = result.data;
        }
    } catch (e) {
        console.error("Error loading promotions", e);
        if (typeof showToast === 'function') showToast("Error loading promotions from server");
    }
}

function exportOrdersCSV() {
    window.open(`${BACKEND_URL}/api/orders/export`, '_blank');
}

function exportCustomersCSV() {
    window.open(`${BACKEND_URL}/api/customers/export`, '_blank');
}

function exportInventoryCSV() {
    window.open(`${BACKEND_URL}/api/products/export`, '_blank');
}

// MODIFIED: Now uses adminFetchWithAuth
async function archiveProduct(id, event) {
    if(event) event.stopPropagation();
    if(!confirm("Are you sure you want to archive this product? It will be hidden from the store without breaking historical sales data.")) return;
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/products/${id}/archive`, { method: 'PUT' });
        const result = await res.json();
        if(result.success) {
            if(typeof showToast === 'function') showToast("Product archived securely.");
            if(typeof fetchInventory === 'function') {
                inventoryPage = 1;
                fetchInventory();
            }
        } else {
            if(typeof showToast === 'function') showToast(result.message || 'Error archiving.');
        }
    } catch (e) {
        console.error("Archive error", e);
        if(typeof showToast === 'function') showToast("Error archiving product.");
    }
}
