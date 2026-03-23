// NEW: Added to store active promotions from Phase 1
let currentPromotions = []; 

// MODIFIED: Removed custom exponential backoff logic to rely on native browser auto-reconnect
function connectAdminLiveStream() {
    if (adminEventSource) return; 
    
    adminEventSource = new EventSource(`${BACKEND_URL}/api/orders/stream/admin`);
    
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
        // DELETED: adminEventSource.close() and setTimeout exponential backoff logic.
        // EFFECT: Prevents duplicate "ghost" streams. The browser's native EventSource automatically reconnects.
        console.warn("SSE Connection interrupted. Browser is handling auto-reconnection...", error);
    };
}

// DRY Optimization: Helper function to populate select dropdowns
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

async function fetchCategories() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`);
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

async function fetchBrands() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/brands`);
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

async function fetchDistributors() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/distributors`);
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

async function fetchPromotions() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/promotions?all=false`);
        const result = await res.json();
        if (result.success) {
            currentPromotions = result.data;
        }
    } catch (e) {
        console.error("Error loading promotions", e);
        if (typeof showToast === 'function') showToast("Error loading promotions from server");
    }
}

// --- NEW: CSV Data Export Connectors ---
function exportOrdersCSV() {
    window.open(`${BACKEND_URL}/api/orders/export`, '_blank');
}

function exportCustomersCSV() {
    window.open(`${BACKEND_URL}/api/customers/export`, '_blank');
}

function exportInventoryCSV() {
    window.open(`${BACKEND_URL}/api/products/export`, '_blank');
}

// --- NEW: Soft Deletes (Archive) API Call ---
async function archiveProduct(id, event) {
    if(event) event.stopPropagation();
    if(!confirm("Are you sure you want to archive this product? It will be hidden from the store without breaking historical sales data.")) return;
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${id}/archive`, { method: 'PUT' });
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
