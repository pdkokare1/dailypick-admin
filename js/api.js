// NEW: Added to store active promotions from Phase 1
let currentPromotions = []; 

// MODIFIED: Added parameter for exponential backoff logic
function connectAdminLiveStream(reconnectAttempts = 0) {
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
    
    adminEventSource.onerror = () => {
        console.warn("SSE Connection lost. Reconnecting...");
        adminEventSource.close();
        adminEventSource = null;
        
        // NEW: Exponential backoff calculation (max 30 seconds)
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(() => connectAdminLiveStream(reconnectAttempts + 1), delay);
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
    }
}

// --- NEW: PHASE 2 FUNCTION ---
async function fetchPromotions() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/promotions?all=false`);
        const result = await res.json();
        if (result.success) {
            currentPromotions = result.data;
        }
    } catch (e) {
        console.error("Error loading promotions", e);
    }
}
// -----------------------------
