/* js/inventory.js */

var searchTimeout;
var currentFilters = { search: '', category: 'All', brand: 'All', distributor: 'All', stockStatus: 'All', sort: 'createdAt_desc' };

function getDisplayStock(variant) {
    if (typeof currentStoreId === 'undefined' || !currentStoreId) return variant.stock; 
    if (variant.locationInventory && Array.isArray(variant.locationInventory)) {
        const loc = variant.locationInventory.find(l => l.storeId === currentStoreId);
        if (loc) return loc.stock;
    }
    return 0; 
}

function calculateStockRunway(variant) {
    if (!variant.purchaseHistory || variant.purchaseHistory.length < 2) return null;
    
    const sorted = [...variant.purchaseHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);
    
    const daysElapsed = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const totalQtyBought = sorted.reduce((sum, h) => sum + h.addedQuantity, 0);
    
    const velocity = totalQtyBought / daysElapsed;
    if (velocity <= 0) return null;
    
    const dStock = getDisplayStock(variant);
    return Math.ceil(dStock / velocity);
}

function toggleSpecialFilter(type) {
    let turningOff = false;
    if (type === 'out' && isOutStockFilterActive) turningOff = true;
    if (type === 'low' && isLowStockFilterActive) turningOff = true;
    if (type === 'dead' && isDeadStockFilterActive) turningOff = true;

    isLowStockFilterActive = false;
    isOutStockFilterActive = false;
    isDeadStockFilterActive = false;
    
    document.getElementById('card-out-stock').style.border = '1px solid rgba(0,0,0,0.04)';
    document.getElementById('card-low-stock').style.border = '1px solid rgba(0,0,0,0.04)';
    document.getElementById('card-dead-stock').style.border = '1px solid rgba(0,0,0,0.04)';
    
    const lowStockBtn = document.getElementById('low-stock-btn');
    if(lowStockBtn) {
        lowStockBtn.style.background = '#FEF2F2';
        lowStockBtn.style.color = '#DC2626';
    }

    if (!turningOff) {
        if (type === 'out') {
            isOutStockFilterActive = true;
            document.getElementById('card-out-stock').style.border = '2px solid #DC2626';
        } else if (type === 'low') {
            isLowStockFilterActive = true;
            document.getElementById('card-low-stock').style.border = '2px solid #D97706';
            if(lowStockBtn) {
                lowStockBtn.style.background = '#DC2626';
                lowStockBtn.style.color = 'white';
            }
        } else if (type === 'dead') {
            isDeadStockFilterActive = true;
            document.getElementById('card-dead-stock').style.border = '2px solid #D97706';
        }
    }
    
    inventoryPage = 1;
    applyInventoryFilters();
}

function toggleLowStockFilter() {
    if (isLowStockFilterActive) {
        toggleSpecialFilter('clear');
    } else {
        toggleSpecialFilter('low');
    }
}

function debounceInventorySearch() { 
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(() => {
        inventorySearchTerm = document.getElementById('inventory-search-input').value.trim();
        inventoryPage = 1;
        fetchInventory();
    }, 500); 
}

function applyInventoryFilters() { 
    inventorySearchTerm = document.getElementById('inventory-search-input').value.trim(); 
    inventoryCategoryFilter = document.getElementById('inventory-cat-filter').value; 
    
    const brandDrop = document.getElementById('inventory-brand-filter');
    const distDrop = document.getElementById('inventory-dist-filter');
    inventoryBrandFilter = brandDrop ? brandDrop.value : 'All';
    inventoryDistributorFilter = distDrop ? distDrop.value : 'All';

    const sortDrop = document.getElementById('inventory-sort');
    if(sortDrop) currentFilters.sort = sortDrop.value;

    inventoryPage = 1; 
    fetchInventory(); 
}

async function fetchInventory(isLoadMore = false) {
    if (!isLoadMore) {
        inventoryPage = 1;
        const invFeed = document.getElementById('inventory-feed');
        if(invFeed) invFeed.innerHTML = '<p class="empty-state">Fetching catalog...</p>';
    }
    
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) { 
        loadBtn.innerText = 'Loading...'; 
        loadBtn.disabled = true; 
    }

    try {
        let queryUrl = `${BACKEND_URL}/api/products?all=true&page=${inventoryPage}&limit=30`;
        if (inventorySearchTerm) queryUrl += `&search=${encodeURIComponent(inventorySearchTerm)}`;
        if (inventoryCategoryFilter !== 'All') queryUrl += `&category=${encodeURIComponent(inventoryCategoryFilter)}`;
        if (inventoryBrandFilter !== 'All') queryUrl += `&brand=${encodeURIComponent(inventoryBrandFilter)}`;
        if (inventoryDistributorFilter !== 'All') queryUrl += `&distributor=${encodeURIComponent(inventoryDistributorFilter)}`;

        if (isOutStockFilterActive) queryUrl += `&stockStatus=out`;
        else if (isLowStockFilterActive) queryUrl += `&stockStatus=low`;
        else if (isDeadStockFilterActive) queryUrl += `&stockStatus=dead`;

        if (currentFilters.sort) queryUrl += `&sort=${currentFilters.sort}`;

        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(queryUrl);
        const result = await res.json();
        
        if (result.success) { 
            let dataToRender = result.data;

            if (inventoryPage === 1) {
                currentInventory = dataToRender;
            } else {
                currentInventory = [...currentInventory, ...dataToRender];
            }
            
            if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard(); 
            if (typeof renderInventory === 'function') renderInventory(dataToRender.length < 30); 
        }
    } catch (e) { 
        if (inventoryPage === 1 && document.getElementById('inventory-feed')) {
            document.getElementById('inventory-feed').innerHTML = '<p class="empty-state">Error loading inventory.</p>'; 
        }
    } finally { 
        if (loadBtn) { 
            loadBtn.innerText = 'Load More Products'; 
            loadBtn.disabled = false; 
        } 
    }
}

function loadMoreInventory() { 
    inventoryPage++; 
    fetchInventory(true); 
}

function toggleInventorySelection(id, event) {
    event.stopPropagation();
    if (typeof selectedInventory !== 'undefined') {
        if (selectedInventory.has(id)) {
            selectedInventory.delete(id);
        } else {
            selectedInventory.add(id);
        }
        if (typeof updateInventoryBulkUI === 'function') updateInventoryBulkUI();
    }
}

async function toggleProductStatus(id, btnElement, event) {
    event.stopPropagation();
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' });
        const result = await res.json();
        if(result.success) {
            const product = currentInventory.find(p => p._id === id);
            if(product) product.isActive = !product.isActive;
            
            if(product.isActive) {
                btnElement.classList.add('active');
                btnElement.closest('.inventory-card').classList.remove('inactive');
            } else {
                btnElement.classList.remove('active');
                btnElement.closest('.inventory-card').classList.add('inactive');
            }
            if (typeof showToast === 'function') showToast(`Product ${product.isActive ? 'Activated' : 'Deactivated'}`);
        }
    } catch(e) { 
        if (typeof showToast === 'function') showToast('Network Error'); 
    }
}

async function archiveProduct(id, event) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to permanently hide this product?")) return;
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${id}/archive`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            if (typeof showToast === 'function') showToast("Product Archived.");
            fetchInventory();
        }
    } catch(e) { 
        if (typeof showToast === 'function') showToast("Error archiving product."); 
    }
}

const invSentinel = document.getElementById('inventory-scroll-sentinel');
if (invSentinel) {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !document.getElementById('load-more-btn').classList.contains('hidden') && document.getElementById('inventory-view').classList.contains('active')) {
            loadMoreInventory();
        }
    }, { rootMargin: '200px' });
    observer.observe(invSentinel);
}
