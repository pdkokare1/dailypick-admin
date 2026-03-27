/* js/inventory.js */

let searchTimeout;
let inventoryPage = 1;
let currentFilters = { search: '', category: 'All', brand: 'All', distributor: 'All', stockStatus: 'All', sort: 'createdAt_desc' };
let selectedInventory = new Set();
let html5QrcodeScanner = null;

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
        document.getElementById('inventory-feed').innerHTML = '<p class="empty-state">Fetching catalog...</p>';
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
            
            updateInventoryDashboard(); 
            
            renderInventory(dataToRender.length < 30); 
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

function renderInventory(isLastPage = true) {
    const invFeedEl = document.getElementById('inventory-feed');
    if (!invFeedEl) return;

    if (inventoryPage === 1) {
        invFeedEl.innerHTML = '';
    }
    
    if (currentInventory.length === 0) { 
        invFeedEl.innerHTML = '<p class="empty-state">No products found.</p>'; 
        document.getElementById('load-more-btn').classList.add('hidden'); 
        return; 
    }
    
    const itemsToRender = inventoryPage === 1 
        ? currentInventory 
        : currentInventory.slice((inventoryPage - 1) * 30);

    itemsToRender.forEach(p => {
        const card = document.createElement('div'); 
        card.classList.add('inventory-card');
        
        if (!p.isActive) card.classList.add('inactive');
        
        const checkboxHtml = `<input type="checkbox" class="order-checkbox" ${selectedInventory.has(p._id) ? 'checked' : ''} onclick="toggleInventorySelection('${p._id}', event)">`;
        
        const thumb = p.imageUrl 
            ? `<img src="${p.imageUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right:12px;">` 
            : `<div style="width:40px; height:40px; border-radius:8px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:20px; margin-right:12px;">📦</div>`;
        
        const vCount = p.variants ? p.variants.length : 0;
        let totalStock = 0;
        let lowestStockFlag = 'healthy'; 
        
        if (p.variants) {
            p.variants.forEach(v => {
                const dStock = getDisplayStock(v); 
                totalStock += dStock;
                if (dStock <= 0) {
                    lowestStockFlag = 'out';
                } else if (lowestStockFlag !== 'out' && dStock <= (v.lowStockThreshold || 5)) {
                    lowestStockFlag = 'low';
                }
            });
        }
        
        let stockBadge = `<span class="badge-healthy">Stock: ${totalStock}</span>`;
        if (lowestStockFlag === 'out') stockBadge = `<span class="badge-out">Out of Stock</span>`;
        else if (lowestStockFlag === 'low') stockBadge = `<span class="badge-low">Low Stock (${totalStock})</span>`;

        const variantsHtml = (p.variants || []).map(v => {
            let lastCost = 0;
            if (v.purchaseHistory && v.purchaseHistory.length > 0) {
                lastCost = v.purchaseHistory[v.purchaseHistory.length - 1].purchasingPrice;
            }
            let marginHtml = '';
            if (lastCost > 0 && v.price > 0) {
                const marginPercentage = (((v.price - lastCost) / v.price) * 100).toFixed(1);
                marginHtml = `<span class="margin-badge">${marginPercentage}% Margin</span>`;
            }

            let expiryHtml = '';
            if (v.expiryDate) {
                const exp = new Date(v.expiryDate);
                const daysLeft = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft <= 30 && daysLeft >= 0) {
                    expiryHtml = `<span style="background:#fef2f2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; margin-left:8px; border: 1px solid #fecaca;">⚠️ Exp: ${daysLeft} days</span>`;
                } else if (daysLeft < 0) {
                    expiryHtml = `<span style="background:#991b1b; color:white; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; margin-left:8px;">❌ EXPIRED</span>`;
                } else {
                    expiryHtml = `<span style="color:var(--text-muted); font-size:9px; margin-left:8px;">Exp: ${exp.toLocaleDateString()}</span>`;
                }
            }

            let runwayDays = v.daysOfStock !== undefined ? v.daysOfStock : calculateStockRunway(v);
            let runwayHtml = '';
            const dStock = getDisplayStock(v);
            
            if (runwayDays !== null && runwayDays !== undefined) {
                if (dStock > 15 && runwayDays > 30) {
                    runwayHtml = `<span style="background:#f3f4f6; color:#4b5563; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; margin-left:8px; border: 1px solid #e5e7eb;">🕸️ Dead Stock</span>`;
                } else if (dStock > 0 && runwayDays <= 3) {
                    runwayHtml = `<span style="background:#fef2f2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; margin-left:8px; border: 1px solid #fecaca;">🔥 ${runwayDays} Days Left</span>`;
                } else if (dStock > 0 && v.averageDailySales && v.averageDailySales > 2) {
                    runwayHtml = `<span style="background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; margin-left:8px; border: 1px solid #a7f3d0;">📈 High Velocity</span>`;
                } else if (dStock > 0 && runwayDays < 999) {
                    runwayHtml = `<span style="color:var(--text-muted); font-size:9px; margin-left:8px;">${runwayDays} Days Left</span>`;
                }
            }

            return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #F8FAFC; border-radius: 8px; margin-bottom: 4px; font-size: 12px;" onclick="event.stopPropagation()">
                <span>${v.weightOrVolume} ${expiryHtml} ${runwayHtml}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="color: var(--text-muted);">₹</span>
                    <input class="inline-edit-input" type="number" value="${v.price}" onkeydown="saveInlineEdit('${p._id}', '${v._id}', 'price', this, event)" title="Press Enter to save">
                    ${marginHtml}
                    <span style="color: var(--text-muted); margin-left: 8px;">Qty:</span>
                    <input class="inline-edit-input" type="number" value="${dStock}" onkeydown="saveInlineEdit('${p._id}', '${v._id}', 'stock', this, event)" title="Press Enter to save">
                    <button class="quick-restock-btn" onclick="openRestockHistory('${p._id}', '${v._id}', event)" title="Restock History">🕒</button>
                    <button class="quick-restock-btn" onclick="quickRestock('${p._id}', '${v._id}', event)" title="Quick Restock">📦</button>
                    <button class="quick-restock-btn" style="color: #dc2626; border-color: #fca5a5; background: #fef2f2;" onclick="openRTVModal('${p._id}', '${v._id}', event)" title="Return to Vendor (RTV)">🔙</button>
                </div>
            </div>
            `;
        }).join('');

        card.innerHTML = `
            <div style="display:flex; align-items:center; width:100%; justify-content:space-between;">
                <div style="display:flex; align-items:center;">
                    ${checkboxHtml}
                    ${thumb}
                    <div class="inv-info">
                        <h4 style="margin-bottom: 2px;">${p.name}</h4>
                        <div style="display:flex; align-items:center;">
                            <span class="inv-meta" style="font-size: 11px; color: var(--text-muted);">${vCount} Variant${vCount !== 1 ? 's' : ''}</span>
                            ${stockBadge}
                            ${vCount > 0 ? `<button class="variant-collapse-btn" onclick="toggleVariantView('${p._id}', event)">▼ Edit Inline</button>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    <button class="edit-btn" onclick="openEditProductModal('${p._id}', event)">Full Edit</button>
                    <button class="toggle-switch ${p.isActive ? 'active' : ''}" onclick="toggleProductStatus('${p._id}', this, event)"></button>
                    <button class="danger-btn-small" style="margin-left: 8px; padding: 4px 8px; font-size: 10px; border-radius: 4px;" onclick="archiveProduct('${p._id}', event)" title="Soft Delete Product">🗑️ Archive</button>
                </div>
            </div>
            <div style="width: 100%; margin-top: 10px; display: none;" id="variants-${p._id}">
                ${variantsHtml}
            </div>
        `;
        
        card.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && !e.target.classList.contains('toggle-switch') && e.target.tagName !== 'INPUT') {
                openEditProductModal(p._id, e);
            }
        };

        invFeedEl.appendChild(card);
    });

    const loadBtn = document.getElementById('load-more-btn');
    if (isLastPage || isLowStockFilterActive || isOutStockFilterActive || isDeadStockFilterActive) {
        loadBtn.classList.add('hidden');
    } else {
        loadBtn.classList.remove('hidden');
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateInventoryDashboard() {
    let outOfStock = 0;
    let lowStock = 0;
    let deadStock = 0; 
    let totalValue = 0;

    currentInventory.forEach(p => {
        if(p.variants) {
            p.variants.forEach(v => {
                const dStock = getDisplayStock(v);
                if (dStock <= 0) outOfStock++;
                else if (dStock <= (v.lowStockThreshold || 5)) lowStock++;
                else if (dStock > 15) deadStock++; 

                totalValue += (dStock * v.price);
            });
        }
    });
    
    const outCard = document.getElementById('stat-out-stock').parentElement;
    if(outOfStock > 0) outCard.classList.add('alert');
    else outCard.classList.remove('alert');

    document.getElementById('stat-out-stock').innerText = outOfStock;
    document.getElementById('stat-low-stock').innerText = lowStock;
    document.getElementById('stat-dead-stock').innerText = deadStock; 
    document.getElementById('stat-total-value').innerText = `₹${totalValue.toFixed(2)}`;
    
    if(document.getElementById('overview-view').classList.contains('active') && typeof renderOverview === 'function') {
        renderOverview(); 
    }
}

function toggleInventorySelection(id, event) {
    event.stopPropagation();
    if (selectedInventory.has(id)) {
        selectedInventory.delete(id);
    } else {
        selectedInventory.add(id);
    }
    updateInventoryBulkUI();
}

function updateInventoryBulkUI() {
    const btn = document.getElementById('inv-bulk-btn');
    const priceBtn = document.getElementById('inv-bulk-price-btn');
    const assignBtn = document.getElementById('inv-bulk-assign-btn'); 
    const printBtn = document.getElementById('inv-bulk-print-btn'); 
    
    if (selectedInventory.size > 0) {
        if(btn) { btn.innerText = `Deactivate Selected (${selectedInventory.size})`; btn.style.display = 'inline-flex'; }
        if(priceBtn) { priceBtn.innerText = `Edit Prices (${selectedInventory.size})`; priceBtn.style.display = 'inline-flex'; }
        if(assignBtn) { assignBtn.innerText = `Move (${selectedInventory.size})`; assignBtn.style.display = 'inline-flex'; }
        if(printBtn) { printBtn.innerText = `🖨️ Labels (${selectedInventory.size})`; printBtn.style.display = 'inline-flex'; }
    } else { 
        if(btn) btn.style.display = 'none';
        if(priceBtn) priceBtn.style.display = 'none';
        if(assignBtn) assignBtn.style.display = 'none';
        if(printBtn) printBtn.style.display = 'none';
    }
}

function toggleVariantView(productId, event) {
    event.stopPropagation();
    const el = document.getElementById(`variants-${productId}`);
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
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
            showToast(`Product ${product.isActive ? 'Activated' : 'Deactivated'}`);
        }
    } catch(e) { showToast('Network Error'); }
}

async function archiveProduct(id, event) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to permanently hide this product?")) return;
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${id}/archive`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            showToast("Product Archived.");
            fetchInventory();
        }
    } catch(e) { showToast("Error archiving product."); }
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
