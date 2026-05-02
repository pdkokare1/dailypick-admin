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

// ============================================================================
// --- NEW: PILLAR A - LOCAL SHOP GLOBAL CATALOG IMPORT ---
// ============================================================================

window.openGlobalCatalogImporter = function() {
    const modal = document.getElementById('global-catalog-importer-modal');
    if(modal) modal.classList.add('active');
    const results = document.getElementById('global-catalog-search-results');
    if (results) results.innerHTML = '<p class="empty-state">Search the Master Catalog to add items instantly.</p>';
};

window.closeGlobalCatalogImporter = function() {
    const modal = document.getElementById('global-catalog-importer-modal');
    if(modal) modal.classList.remove('active');
};

// OPTIMIZATION: Debounced Global Catalog Search to prevent API spam
let globalCatalogSearchTimeout;
window.searchGlobalCatalog = async function(query) {
    clearTimeout(globalCatalogSearchTimeout);
    
    const resultsContainer = document.getElementById('global-catalog-search-results');
    if (!query || query.length < 3) {
        if (resultsContainer) resultsContainer.innerHTML = '<p class="empty-state">Type at least 3 characters...</p>';
        return;
    }

    if (resultsContainer) resultsContainer.innerHTML = '<p class="empty-state">Searching Single Source of Truth...</p>';
    
    globalCatalogSearchTimeout = setTimeout(async () => {
        try {
            const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
            const res = await fetchFn(`${BACKEND_URL}/api/b2b/catalog?search=${encodeURIComponent(query)}`);
            const result = await res.json();

            if (result.success && result.data && result.data.length > 0) {
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                    const frag = document.createDocumentFragment();
                    
                    result.data.forEach(p => {
                        const div = document.createElement('div');
                        div.style.background = 'white';
                        div.style.border = '1px solid #E2E8F0';
                        div.style.padding = '12px';
                        div.style.borderRadius = '8px';
                        div.style.marginBottom = '8px';
                        div.style.display = 'flex';
                        div.style.justifyContent = 'space-between';
                        div.style.alignItems = 'center';
                        
                        div.innerHTML = `
                            <div>
                                <h4 style="margin:0; font-size: 14px; color: var(--primary);">${p.name}</h4>
                                <p style="margin:4px 0 0 0; font-size: 12px; color: var(--text-muted);">${p.category} | ${p.variants ? p.variants.length : 0} Variants</p>
                            </div>
                            <button class="primary-btn-small" onclick='importGlobalItem(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Import</button>
                        `;
                        frag.appendChild(div);
                    });
                    resultsContainer.appendChild(frag);
                }
            } else {
                if (resultsContainer) resultsContainer.innerHTML = '<p class="empty-state">No master products found. Consider submitting a request.</p>';
            }
        } catch (e) {
            if (resultsContainer) resultsContainer.innerHTML = '<p class="empty-state" style="color:red;">Error searching catalog.</p>';
        }
    }, 400); // 400ms debounce
};

window.importGlobalItem = function(masterProduct) {
    closeGlobalCatalogImporter();
    if (typeof openAddProductModal === 'function') {
        openAddProductModal();
        // Pre-fill the form with Master Product data securely without overriding existing state
        setTimeout(() => {
            const nameInput = document.getElementById('new-name');
            const catInput = document.getElementById('new-category');
            
            if(nameInput) nameInput.value = masterProduct.name;
            if(catInput) {
                const optionExists = Array.from(catInput.options).some(opt => opt.value === masterProduct.category);
                if (optionExists) catInput.value = masterProduct.category;
            }
            
            // Show a visual lock banner indicating it's an imported product
            const detailsSection = document.getElementById('custom-product-details');
            if(detailsSection) {
                detailsSection.insertAdjacentHTML('afterbegin', `
                    <div style="background: #ECFDF5; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #A7F3D0;">
                        <p style="font-size: 12px; color: #065F46; font-weight: 600;">✅ Locked to Master Catalog ID: ${masterProduct._id}</p>
                    </div>
                `);
            }
            
            if (typeof showToast === 'function') showToast("Master product details loaded. Please set your local stock and price.");
        }, 300);
    }
};

// ============================================================================
// --- NEW: PILLAR B - DISTRIBUTOR WHOLESALE SUBMISSION ---
// ============================================================================

window.openDistributorSubmissionModal = function() {
    const modal = document.getElementById('distributor-submission-modal');
    if(modal) modal.classList.add('active');
};

window.closeDistributorSubmissionModal = function() {
    const modal = document.getElementById('distributor-submission-modal');
    if(modal) modal.classList.remove('active');
};

window.submitWholesaleItem = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('submit-wholesale-btn');
    if (btn) { btn.innerText = 'Submitting...'; btn.disabled = true; }

    const name = document.getElementById('wholesale-name').value;
    const category = document.getElementById('wholesale-category').value;
    const hsnCode = document.getElementById('wholesale-hsn').value;
    const bulkPriceRs = document.getElementById('wholesale-bulk-price').value;
    const minOrderQty = document.getElementById('wholesale-moq').value;

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/b2b/distributor-submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                category,
                isActive: false,
                variants: [{
                    weightOrVolume: 'Wholesale Unit',
                    hsnCode: hsnCode,
                    price: bulkPriceRs,
                    stock: 9999 // High threshold for wholesale dropship logic
                }],
                wholesaleMeta: { minOrderQty, bulkPriceRs }
            })
        });
        
        const result = await res.json();
        if (result.success) {
            if (typeof showToast === 'function') showToast("Item submitted to HQ for verification.");
            closeDistributorSubmissionModal();
            event.target.reset();
        } else {
            if (typeof showToast === 'function') showToast(result.message || "Submission failed.");
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("Network error during submission.");
    } finally {
        if (btn) { btn.innerText = 'Submit to Global Catalog'; btn.disabled = false; }
    }
};
