// js/api.js

let currentPromotions = []; 

async function adminFetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('adminToken');
    
    options.headers = options.headers || {};
    options.credentials = 'include';
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    let response = await fetch(url, options);
    
    if (response.status === 401) {
        try {
            const refreshRes = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include' 
            });
            const refreshData = await refreshRes.json();
            
            if (refreshData.success && refreshData.token) {
                localStorage.setItem('adminToken', refreshData.token);
                options.headers['Authorization'] = `Bearer ${refreshData.token}`;
                response = await fetch(url, options); 
            } else {
                console.warn('Authentication failed for:', url);
                if (typeof showToast === 'function') showToast('Session Expired or Access Denied. Please log in again.');
            }
        } catch (e) {
            console.warn('Authentication failed for:', url);
            if (typeof showToast === 'function') showToast('Session Expired or Access Denied. Please log in again.');
        }
    } else if (response.status === 403) {
        console.warn('Authentication failed for:', url);
        if (typeof showToast === 'function') showToast('Session Expired or Access Denied. Please log in again.');
    }

    if (response.status === 429) {
        if (typeof showToast === 'function') showToast("Too many requests. Please slow down.");
    }
    
    return response;
}

let sseRetryCount = 0;

async function connectAdminLiveStream() {
    if (window.adminStreamController) return; 

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    window.adminStreamController = new AbortController();

    try {
        const response = await fetch(`${BACKEND_URL}/api/orders/stream/admin`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include',
            signal: window.adminStreamController.signal
        });

        if (!response.ok) throw new Error('Stream connection failed due to authorization or server error');

        console.log("🟢 Live Order Stream Connected (Secured)");
        sseRetryCount = 0; 

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === ':' || !dataStr) continue; 

                    try {
                        const data = JSON.parse(dataStr);
                        if (data.message) continue;

                        if (data.type === 'NEW_ORDER') {
                            currentOrders.unshift(data.order);
                            if (typeof updateDashboard === 'function') updateDashboard();
                            if (typeof playNewOrderAudio === 'function') playNewOrderAudio(); 
                            if (typeof showToast === 'function') showToast('🚨 New Order Arrived!');
                        } else if (data.type === 'EXPIRY_WARNING') {
                            if (typeof showToast === 'function') showToast(data.message);
                        }
                    } catch (e) {
                        console.error("Error parsing stream data:", e);
                    }
                }
            }
        }
    } catch (error) {
        sseRetryCount++;
        const retryDelay = Math.min(1000 * (2 ** sseRetryCount), 30000); 
        console.warn(`⚠️ Live Stream disconnected. Reconnecting in ${retryDelay/1000}s...`);
        
        window.adminStreamController = null;
        setTimeout(connectAdminLiveStream, retryDelay);
    }
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

// NEW: Abstracted Data Fetcher
async function fetchDropdownData(endpoint, errorMessage, successCallback) {
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/${endpoint}`);
        const result = await res.json();
        if (result.success) {
            successCallback(result.data);
        }
    } catch (e) {
        console.error(errorMessage, e);
        if (typeof showToast === 'function') showToast(errorMessage);
    }
}

async function fetchCategories() {
    await fetchDropdownData('categories', 'Error loading categories from server', (data) => {
        currentCategories = data;
        populateDropdowns(currentCategories, [
            { id: 'new-category', emptyHTML: '<option value="" disabled selected>No Categories Created</option>' },
            { id: 'inventory-cat-filter', defaultHTML: '<option value="All">All Categories</option>' }
        ]);
    });
}

async function fetchBrands() {
    await fetchDropdownData('brands', 'Error loading brands from server', (data) => {
        currentBrands = data;
        populateDropdowns(currentBrands, [
            { id: 'new-brand', defaultHTML: '<option value="">Select Brand (Optional)</option>' },
            { id: 'inventory-brand-filter', defaultHTML: '<option value="All">All Brands</option>' }
        ]);
    });
}

async function fetchDistributors() {
    await fetchDropdownData('distributors', 'Error loading distributors from server', (data) => {
        currentDistributors = data;
        populateDropdowns(currentDistributors, [
            { id: 'new-distributor', defaultHTML: '<option value="">Select Distributor (Optional)</option>' },
            { id: 'restock-distributor', defaultHTML: '<option value="">Select a Distributor</option>' },
            { id: 'inventory-dist-filter', defaultHTML: '<option value="All">All Distributors</option>' }
        ]);
    });
}

async function fetchPromotions() {
    await fetchDropdownData('promotions?all=false', 'Error loading promotions from server', (data) => {
        currentPromotions = data;
    });
}

function exportOrdersCSV() { window.open(`${BACKEND_URL}/api/orders/export`, '_blank'); }
function exportCustomersCSV() { window.open(`${BACKEND_URL}/api/customers/export`, '_blank'); }
function exportInventoryCSV() { window.open(`${BACKEND_URL}/api/products/export`, '_blank'); }

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
