/* js/views/inventoryView.js */

window.renderInventory = function(isLastPage = true) {
    const invFeedEl = document.getElementById('inventory-feed');
    if (!invFeedEl) return;

    if (typeof inventoryPage !== 'undefined' && inventoryPage === 1) {
        invFeedEl.innerHTML = '';
    }
    
    if (typeof currentInventory === 'undefined' || currentInventory.length === 0) { 
        invFeedEl.innerHTML = '<p class="empty-state">No products found.</p>'; 
        const loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.classList.add('hidden'); 
        return; 
    }
    
    const itemsToRender = inventoryPage === 1 
        ? currentInventory 
        : currentInventory.slice((inventoryPage - 1) * 30);

    // OPTIMIZATION: DOM Virtualization (Chunked Rendering)
    let index = 0;
    const chunkSize = 50;

    function renderNextChunk() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + chunkSize, itemsToRender.length);

        for (; index < end; index++) {
            const p = itemsToRender[index];
            const card = document.createElement('div'); 
            card.classList.add('inventory-card');
            
            if (!p.isActive) card.classList.add('inactive');
            
            const checkboxHtml = `<input type="checkbox" class="order-checkbox" ${typeof selectedInventory !== 'undefined' && selectedInventory.has(p._id) ? 'checked' : ''} onclick="if(typeof toggleInventorySelection === 'function') toggleInventorySelection('${p._id}', event)">`;
            
            const thumb = p.imageUrl 
                ? `<img src="${p.imageUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right:12px;">` 
                : `<div style="width:40px; height:40px; border-radius:8px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:20px; margin-right:12px;">📦</div>`;
            
            const vCount = p.variants ? p.variants.length : 0;
            let totalStock = 0;
            let lowestStockFlag = 'healthy'; 
            
            if (p.variants) {
                p.variants.forEach(v => {
                    const dStock = typeof getDisplayStock === 'function' ? getDisplayStock(v) : v.stock; 
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

                let runwayDays = v.daysOfStock !== undefined ? v.daysOfStock : (typeof calculateStockRunway === 'function' ? calculateStockRunway(v) : null);
                let runwayHtml = '';
                const dStock = typeof getDisplayStock === 'function' ? getDisplayStock(v) : v.stock;
                
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
                        <input class="inline-edit-input" type="number" value="${v.price}" onkeydown="if(typeof saveInlineEdit === 'function') saveInlineEdit('${p._id}', '${v._id}', 'price', this, event)" title="Press Enter to save">
                        ${marginHtml}
                        <span style="color: var(--text-muted); margin-left: 8px;">Qty:</span>
                        <input class="inline-edit-input" type="number" value="${dStock}" onkeydown="if(typeof saveInlineEdit === 'function') saveInlineEdit('${p._id}', '${v._id}', 'stock', this, event)" title="Press Enter to save">
                        <button class="quick-restock-btn" onclick="if(typeof openRestockHistory === 'function') openRestockHistory('${p._id}', '${v._id}', event)" title="Restock History">🕒</button>
                        <button class="quick-restock-btn" onclick="if(typeof quickRestock === 'function') quickRestock('${p._id}', '${v._id}', event)" title="Quick Restock">📦</button>
                        <button class="quick-restock-btn" style="color: #dc2626; border-color: #fca5a5; background: #fef2f2;" onclick="if(typeof openRTVModal === 'function') openRTVModal('${p._id}', '${v._id}', event)" title="Return to Vendor (RTV)">🔙</button>
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
                                ${vCount > 0 ? `<button class="variant-collapse-btn" onclick="if(typeof toggleVariantView === 'function') toggleVariantView('${p._id}', event)">▼ Edit Inline</button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center;">
                        <button class="edit-btn" onclick="if(typeof openEditProductModal === 'function') openEditProductModal('${p._id}', event)">Full Edit</button>
                        <button class="toggle-switch ${p.isActive ? 'active' : ''}" onclick="if(typeof toggleProductStatus === 'function') toggleProductStatus('${p._id}', this, event)"></button>
                        <button class="danger-btn-small" style="margin-left: 8px; padding: 4px 8px; font-size: 10px; border-radius: 4px;" onclick="if(typeof archiveProduct === 'function') archiveProduct('${p._id}', event)" title="Soft Delete Product">🗑️ Archive</button>
                    </div>
                </div>
                <div style="width: 100%; margin-top: 10px; display: none;" id="variants-${p._id}">
                    ${variantsHtml}
                </div>
            `;
            
            card.onclick = (e) => {
                if(e.target.tagName !== 'BUTTON' && !e.target.classList.contains('toggle-switch') && e.target.tagName !== 'INPUT') {
                    if (typeof openEditProductModal === 'function') openEditProductModal(p._id, e);
                }
            };

            fragment.appendChild(card);
        }

        invFeedEl.appendChild(fragment);

        if (index < itemsToRender.length) {
            requestAnimationFrame(renderNextChunk);
        } else {
            // Execution block for the final chunk rendering
            const loadBtn = document.getElementById('load-more-btn');
            if (loadBtn) {
                if (isLastPage || (typeof isLowStockFilterActive !== 'undefined' && isLowStockFilterActive) || (typeof isOutStockFilterActive !== 'undefined' && isOutStockFilterActive) || (typeof isDeadStockFilterActive !== 'undefined' && isDeadStockFilterActive)) {
                    loadBtn.classList.add('hidden');
                } else {
                    loadBtn.classList.remove('hidden');
                }
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    requestAnimationFrame(renderNextChunk);
};

window.updateInventoryDashboard = function() {
    if (typeof currentInventory === 'undefined') return;

    let outOfStock = 0;
    let lowStock = 0;
    let deadStock = 0; 
    let totalValue = 0;

    currentInventory.forEach(p => {
        if(p.variants) {
            p.variants.forEach(v => {
                const dStock = typeof getDisplayStock === 'function' ? getDisplayStock(v) : v.stock;
                if (dStock <= 0) outOfStock++;
                else if (dStock <= (v.lowStockThreshold || 5)) lowStock++;
                else if (dStock > 15) deadStock++; 

                totalValue += (dStock * v.price);
            });
        }
    });
    
    const outCardEl = document.getElementById('stat-out-stock');
    if (outCardEl) {
        const outCard = outCardEl.parentElement;
        if(outOfStock > 0) outCard.classList.add('alert');
        else outCard.classList.remove('alert');

        document.getElementById('stat-out-stock').innerText = outOfStock;
        document.getElementById('stat-low-stock').innerText = lowStock;
        document.getElementById('stat-dead-stock').innerText = deadStock; 
        document.getElementById('stat-total-value').innerText = `₹${totalValue.toFixed(2)}`;
    }
    
    const overviewView = document.getElementById('overview-view');
    if(overviewView && overviewView.classList.contains('active') && typeof renderOverview === 'function') {
        renderOverview(); 
    }
};

window.updateInventoryBulkUI = function() {
    const btn = document.getElementById('inv-bulk-btn');
    const priceBtn = document.getElementById('inv-bulk-price-btn');
    const assignBtn = document.getElementById('inv-bulk-assign-btn'); 
    const printBtn = document.getElementById('inv-bulk-print-btn'); 
    
    if (typeof selectedInventory !== 'undefined' && selectedInventory.size > 0) {
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
};

window.toggleVariantView = function(productId, event) {
    event.stopPropagation();
    const el = document.getElementById(`variants-${productId}`);
    if (el) {
        if (el.style.display === 'none') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }
};
