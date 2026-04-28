/* js/api.js */
import { CONFIG } from './core/config.js';
import { adminFetchWithAuth as originalAdminFetch } from './utils/httpClient.js';
import { connectAdminLiveStream } from './services/liveStreamService.js';

// --- AGGREGATOR GLOBAL SECURITY ---
// Intercept the base authenticated fetcher to ensure every request 
// securely broadcasts the Store Owner's Tenant ID to the backend via headers.
window.adminFetchWithAuth = async function(url, options = {}) {
    options.headers = options.headers || {};
    const tenantId = localStorage.getItem('dailypick_storeId');
    if (tenantId) {
        options.headers['x-tenant-id'] = tenantId;
    }
    return originalAdminFetch(url, options);
};

let currentPromotions = []; 

function populateDropdowns(data, selectConfigs) {
    selectConfigs.forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;

        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        if (data.length === 0 && config.emptyHTML) {
            select.insertAdjacentHTML('beforeend', config.emptyHTML); 
        } else if (config.defaultHTML) {
            select.insertAdjacentHTML('beforeend', config.defaultHTML);
        }

        const fragment = document.createDocumentFragment();
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.textContent = item.name; 
            fragment.appendChild(option);
        });
        select.appendChild(fragment);
    });
}

async function fetchDropdownData(endpoint, errorMessage, successCallback) {
    try {
        const res = await window.adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/${endpoint}`);
        const result = await res.json();
        if (result.success) {
            successCallback(result.data);
        }
    } catch (e) {
        console.error(errorMessage, e);
        if (typeof showToast === 'function') showToast(errorMessage);
    }
}

async function fetchBootstrapData() {
    try {
        const res = await window.adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/bootstrap`);
        const result = await res.json();
        
        if (result.success && result.data) {
            const d = result.data;

            if(typeof currentCategories !== 'undefined') window.currentCategories = d.categories;
            populateDropdowns(d.categories, [
                { id: 'new-category', emptyHTML: '<option value="" disabled selected>No Categories Created</option>' },
                { id: 'inventory-cat-filter', defaultHTML: '<option value="All">All Categories</option>' }
            ]);

            if(typeof currentBrands !== 'undefined') window.currentBrands = d.brands;
            populateDropdowns(d.brands, [
                { id: 'new-brand', defaultHTML: '<option value="">Select Brand (Optional)</option>' },
                { id: 'inventory-brand-filter', defaultHTML: '<option value="All">All Brands</option>' }
            ]);

            if(typeof currentDistributors !== 'undefined') window.currentDistributors = d.distributors;
            populateDropdowns(d.distributors, [
                { id: 'new-distributor', defaultHTML: '<option value="">Select Distributor (Optional)</option>' },
                { id: 'restock-distributor', defaultHTML: '<option value="">Select a Distributor</option>' },
                { id: 'inventory-dist-filter', defaultHTML: '<option value="All">All Distributors</option>' }
            ]);

            currentPromotions = d.promotions;
            window.currentPromotions = d.promotions;
        }
    } catch (e) {
        console.error('Error loading bootstrap payload', e);
        if (typeof showToast === 'function') showToast('Error loading initial data from server.');
    }
}

async function fetchCategories() {
    await fetchDropdownData('categories', 'Error loading categories from server', (data) => {
        if(typeof currentCategories !== 'undefined') window.currentCategories = data;
        populateDropdowns(data, [
            { id: 'new-category', emptyHTML: '<option value="" disabled selected>No Categories Created</option>' },
            { id: 'inventory-cat-filter', defaultHTML: '<option value="All">All Categories</option>' }
        ]);
    });
}

async function fetchBrands() {
    await fetchDropdownData('brands', 'Error loading brands from server', (data) => {
        if(typeof currentBrands !== 'undefined') window.currentBrands = data;
        populateDropdowns(data, [
            { id: 'new-brand', defaultHTML: '<option value="">Select Brand (Optional)</option>' },
            { id: 'inventory-brand-filter', defaultHTML: '<option value="All">All Brands</option>' }
        ]);
    });
}

async function fetchDistributors() {
    await fetchDropdownData('distributors', 'Error loading distributors from server', (data) => {
        if(typeof currentDistributors !== 'undefined') window.currentDistributors = data;
        populateDropdowns(data, [
            { id: 'new-distributor', defaultHTML: '<option value="">Select Distributor (Optional)</option>' },
            { id: 'restock-distributor', defaultHTML: '<option value="">Select a Distributor</option>' },
            { id: 'inventory-dist-filter', defaultHTML: '<option value="All">All Distributors</option>' }
        ]);
    });
}

async function fetchPromotions() {
    await fetchDropdownData('promotions?all=false', 'Error loading promotions from server', (data) => {
        currentPromotions = data;
        window.currentPromotions = data;
    });
}

function downloadCSV(endpoint) { window.open(`${CONFIG.BACKEND_URL}/api/${endpoint}`, '_blank'); }
function exportOrdersCSV() { downloadCSV('orders/export'); }
function exportCustomersCSV() { downloadCSV('customers/export'); }
function exportInventoryCSV() { downloadCSV('products/export'); }

async function archiveProduct(id, event) {
    if(event) event.stopPropagation();
    if(!confirm("Are you sure you want to archive this product? It will be hidden from the store without breaking historical sales data.")) return;
    
    const idempotencyKey = 'ARCHIVE-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    
    try {
        const res = await window.adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/products/${id}/archive`, { 
            method: 'PUT',
            headers: {
                'Idempotency-Key': idempotencyKey
            }
        });
        const result = await res.json();
        if(result.success) {
            if(typeof showToast === 'function') showToast("Product archived securely.");
            if(typeof fetchInventory === 'function') {
                window.inventoryPage = 1;
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

// --- NEW: PHASE 4 CATALOG APPROVAL (SUPERADMIN) ---
async function approveMasterProduct(masterProductId) {
    if (!confirm("Approve this product for the Global Gamut Catalog?")) return;
    const idempotencyKey = 'APPROVE-' + Date.now();
    try {
        const res = await window.adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/master-catalog/${masterProductId}/approve`, {
            method: 'PUT',
            headers: { 'Idempotency-Key': idempotencyKey }
        });
        const result = await res.json();
        if (result.success) {
            if(typeof showToast === 'function') showToast("Product Approved! Now available to all stores.");
        } else {
            if(typeof showToast === 'function') showToast(result.message || 'Error approving.');
        }
    } catch(e) {
        console.error(e);
    }
}

// --- NEW: PHASE 4 ENTERPRISE MANUAL SYNC ---
async function triggerEnterpriseSync() {
    const idempotencyKey = 'SYNC-' + Date.now();
    try {
        const res = await window.adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/enterprise/inventory/sync`, {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey }
        });
        const result = await res.json();
        if(typeof showToast === 'function') showToast(result.message || "Sync command sent.");
    } catch(e) {
        console.error(e);
    }
}

// BRIDGE: Exposing all API repository functions to global scope
window.populateDropdowns = populateDropdowns;
window.fetchDropdownData = fetchDropdownData;
window.fetchBootstrapData = fetchBootstrapData; 
window.fetchCategories = fetchCategories;
window.fetchBrands = fetchBrands;
window.fetchDistributors = fetchDistributors;
window.fetchPromotions = fetchPromotions;
window.exportOrdersCSV = exportOrdersCSV;
window.exportCustomersCSV = exportCustomersCSV;
window.exportInventoryCSV = exportInventoryCSV;
window.archiveProduct = archiveProduct;
window.approveMasterProduct = approveMasterProduct;
window.triggerEnterpriseSync = triggerEnterpriseSync;
