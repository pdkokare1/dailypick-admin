/* js/state.js */

const GlobalState = (function() {
    // --- Enterprise State Container ---
    let state = {
        currentInventory: [],
        currentOrders: [],
        currentCategories: [],
        currentBrands: [],
        currentDistributors: [],
        currentCustomers: [],
        allHistoricalOrders: [], 
        allHistoricalExpenses: [], 

        activeOrder: null,
        posCart: [],
        posContinuousScanner: null,
        posScanCooldown: false,

        html5QrcodeScanner: null,
        currentSkuInputTarget: null,
        restockSelectedVariant: null,

        inventoryPage: 1,
        inventorySearchTerm: '',
        inventoryCategoryFilter: 'All',
        inventoryBrandFilter: 'All',
        inventoryDistributorFilter: 'All',

        isLowStockFilterActive: false,
        isOutStockFilterActive: false,
        isDeadStockFilterActive: false,
        selectedInventory: new Set(),

        currentStoreId: localStorage.getItem('dailypick_storeId') || null,
        currentRegisterId: localStorage.getItem('dailypick_registerId') || null,
        availableStores: [],
        availableRegisters: []
    };

    // --- OPTIMIZED: Global Garbage Collector ---
    function flushTransientMemory() {
        state.activeOrder = null;
        if (typeof globalBarcodeBuffer !== 'undefined') globalBarcodeBuffer = '';
        
        const isOrdersView = document.getElementById('orders-view')?.classList.contains('active');
        const isInventoryView = document.getElementById('inventory-view')?.classList.contains('active');
        
        if (!isOrdersView && typeof selectedOrders !== 'undefined' && selectedOrders instanceof Set) {
            selectedOrders.clear();
            if(typeof updateBulkDispatchUI === 'function') updateBulkDispatchUI();
        }
        
        if (!isInventoryView && state.selectedInventory instanceof Set) {
            state.selectedInventory.clear();
            if(typeof updateInventoryBulkUI === 'function') updateInventoryBulkUI();
        }
    }

    return {
        init: function() {
            // Mapping to window to ensure NO existing code breaks
            Object.keys(state).forEach(key => {
                window[key] = state[key];
            });
            // SECURITY FIX: Freeze critical state functions to prevent third-party overwrites
            window.flushTransientMemory = Object.freeze(flushTransientMemory);
        }
    };
})();

GlobalState.init();
