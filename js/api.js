/* js/api.js */
import { CONFIG } from './core/config.js';
import { adminFetchWithAuth } from './utils/httpClient.js';
import { connectAdminLiveStream } from './services/liveStreamService.js';

let currentPromotions = []; 

function populateDropdowns(data, selectConfigs) {
    selectConfigs.forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;

        select.innerHTML = (data.length === 0 && config.emptyHTML) 
            ? config.emptyHTML 
            : (config.defaultHTML || '');

        const fragment = document.createDocumentFragment();
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.innerText = item.name;
            fragment.appendChild(option);
        });
        select.appendChild(fragment);
    });
}

// Abstracted Data Fetcher
async function fetchDropdownData(endpoint, errorMessage, successCallback) {
    try {
        const res = await adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/${endpoint}`);
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

// OPTIMIZED: Abstracted CSV downloads
function downloadCSV(endpoint) { window.open(`${CONFIG.BACKEND_URL}/api/${endpoint}`, '_blank'); }
function exportOrdersCSV() { downloadCSV('orders/export'); }
function exportCustomersCSV() { downloadCSV('customers/export'); }
function exportInventoryCSV() { downloadCSV('products/export'); }

async function archiveProduct(id, event) {
    if(event) event.stopPropagation();
    if(!confirm("Are you sure you want to archive this product? It will be hidden from the store without breaking historical sales data.")) return;
    
    try {
        const res = await adminFetchWithAuth(`${CONFIG.BACKEND_URL}/api/products/${id}/archive`, { method: 'PUT' });
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

// BRIDGE: Exposing all API repository functions to global scope
window.populateDropdowns = populateDropdowns;
window.fetchDropdownData = fetchDropdownData;
window.fetchCategories = fetchCategories;
window.fetchBrands = fetchBrands;
window.fetchDistributors = fetchDistributors;
window.fetchPromotions = fetchPromotions;
window.exportOrdersCSV = exportOrdersCSV;
window.exportCustomersCSV = exportCustomersCSV;
window.exportInventoryCSV = exportInventoryCSV;
window.archiveProduct = archiveProduct;
