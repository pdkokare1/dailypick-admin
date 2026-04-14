/* js/state.js */

// NOTE: BACKEND_URL, CLOUDINARY constants, and IndexedDB logic have been safely
// migrated to js/core/config.js and js/services/offlineQueueManager.js.
// They are injected into the window object by those modules to prevent breaking legacy code.

let currentInventory = [];
let currentOrders = [];
let currentCategories = [];
let currentBrands = [];
let currentDistributors = [];
let currentCustomers = [];
let allHistoricalOrders = []; 
let allHistoricalExpenses = []; 

let activeOrder = null;
let posCart = [];
let posContinuousScanner = null;
let posScanCooldown = false;

let html5QrcodeScanner = null;
let currentSkuInputTarget = null;
let restockSelectedVariant = null;

let inventoryPage = 1;
let inventorySearchTerm = '';
let inventoryCategoryFilter = 'All';
let inventoryBrandFilter = 'All';
let inventoryDistributorFilter = 'All';

let isLowStockFilterActive = false;
let isOutStockFilterActive = false;
let isDeadStockFilterActive = false;
let selectedInventory = new Set();

// --- Multi-Store State Variables ---
let currentStoreId = localStorage.getItem('dailypick_storeId') || null;
let currentRegisterId = localStorage.getItem('dailypick_registerId') || null;
let availableStores = [];
let availableRegisters = [];

// --- OPTIMIZED: Global Garbage Collector for SPA Memory Leaks ---
function flushTransientMemory() {
    // Release active order lock if modal is closed to free up object references
    activeOrder = null;
    
    // Clear out unused DOM buffers
    if (typeof globalBarcodeBuffer !== 'undefined') globalBarcodeBuffer = '';
    
    // Clear potentially orphaned selection sets if not on their respective views
    const isOrdersView = document.getElementById('orders-view')?.classList.contains('active');
    const isInventoryView = document.getElementById('inventory-view')?.classList.contains('active');
    
    if (!isOrdersView && typeof selectedOrders !== 'undefined' && selectedOrders instanceof Set) {
        selectedOrders.clear();
        if(typeof updateBulkDispatchUI === 'function') updateBulkDispatchUI();
    }
    
    if (!isInventoryView && typeof selectedInventory !== 'undefined' && selectedInventory instanceof Set) {
        selectedInventory.clear();
        if(typeof updateInventoryBulkUI === 'function') updateInventoryBulkUI();
    }
}

// Ensure garbage collector is globally available to ui.js
window.flushTransientMemory = flushTransientMemory;
