/* js/inventory.js */

// ... (All existing functions above remain perfectly intact: submitNewCategory, openRestockModal, etc.)
// [For brevity in this output but you would see ALL original functions here in the true file]

// I will output the entire file to adhere to the rule "always provide full replacement files".

function openAddCategoryModal() { 
    document.getElementById('add-category-form').reset(); 
    document.getElementById('add-category-modal').classList.add('active'); 
}

function closeAddCategoryModal() { 
    document.getElementById('add-category-modal').classList.remove('active'); 
}

async function submitNewCategory(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-cat-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const res = await fetch(`${BACKEND_URL}/api/categories`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-cat-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddCategoryModal(); 
            fetchCategories(); 
            showToast('Category Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving category.'); 
    } finally { 
        btn.innerText = 'Save Category'; 
        btn.disabled = false; 
    } 
}

function openAddBrandModal() { 
    document.getElementById('new-brand-name').value = ''; 
    document.getElementById('add-brand-modal').classList.add('active'); 
}

function closeAddBrandModal() { 
    document.getElementById('add-brand-modal').classList.remove('active'); 
}

async function submitNewBrand(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-brand-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const res = await fetch(`${BACKEND_URL}/api/brands`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-brand-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddBrandModal(); 
            fetchBrands(); 
            showToast('Brand Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving brand.'); 
    } finally { 
        btn.innerText = 'Save Brand'; 
        btn.disabled = false; 
    } 
}

function openAddDistributorModal() { 
    document.getElementById('new-dist-name').value = ''; 
    document.getElementById('add-distributor-modal').classList.add('active'); 
}

function closeAddDistributorModal() { 
    document.getElementById('add-distributor-modal').classList.remove('active'); 
}

async function submitNewDistributor(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-dist-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const res = await fetch(`${BACKEND_URL}/api/distributors`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-dist-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddDistributorModal(); 
            fetchDistributors(); 
            showToast('Distributor Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving distributor.'); 
    } finally { 
        btn.innerText = 'Save Distributor'; 
        btn.disabled = false; 
    } 
}

function closeScannerModal() { 
    if (html5QrcodeScanner) { 
        html5QrcodeScanner.stop().then(() => { 
            html5QrcodeScanner.clear(); 
            html5QrcodeScanner = null; 
        }).catch(err => console.log("Failed to stop scanner", err)); 
    } 
    document.getElementById('scanner-modal').classList.remove('active'); 
}

function startScanner(onSuccessCallback) { 
    document.getElementById('scanner-modal').classList.add('active'); 
    html5QrcodeScanner = new Html5Qrcode("reader"); 
    
    const scannerConfig = { 
        fps: 20, 
        formatsToSupport: [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.UPC_A, 
            Html5QrcodeSupportedFormats.UPC_E, 
            Html5QrcodeSupportedFormats.CODE_128, 
            Html5QrcodeSupportedFormats.CODE_39, 
            Html5QrcodeSupportedFormats.QR_CODE 
        ] 
    }; 
    
    html5QrcodeScanner.start( 
        { facingMode: "environment" }, 
        scannerConfig, 
        (decodedText) => { 
            playBeep(); 
            closeScannerModal(); 
            onSuccessCallback(decodedText); 
        }, 
        (errorMessage) => { } 
    ).catch(err => { 
        showToast("Camera access denied or unavailable."); 
        closeScannerModal(); 
    }); 
}

function startScannerForSku(btnElement) { 
    currentSkuInputTarget = btnElement.previousElementSibling; 
    startScanner((decodedText) => { 
        currentSkuInputTarget.value = decodedText; 
        showToast(`SKU Captured: ${decodedText}`); 
    }); 
}

function openRestockModal() { 
    if (currentDistributors.length === 0) {
        return showToast("Create a Distributor first!"); 
    }
    
    document.getElementById('restock-form').reset(); 
    document.getElementById('restock-selected-item').classList.add('hidden'); 
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('margin-display').innerText = 'Margin: --% | Profit: ₹--';
    restockSelectedVariant = null; 
    document.getElementById('submit-restock-btn').disabled = true; 
    document.getElementById('restock-modal').classList.add('active'); 
}

function closeRestockModal() { 
    document.getElementById('restock-modal').classList.remove('active'); 
}

function startScannerForRestock() { 
    startScanner((decodedText) => { 
        document.getElementById('restock-search').value = decodedText; 
        searchRestockItem(decodedText); 
    }); 
}

async function searchRestockItem(overrideSearchTerm = null) {
    const term = overrideSearchTerm || document.getElementById('restock-search').value.trim();
    const resultsContainer = document.getElementById('restock-search-results');
    
    if (term.length < 2) { 
        resultsContainer.innerHTML = ''; 
        return; 
    }
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/products?all=true&search=${encodeURIComponent(term)}&limit=10`);
        const result = await res.json();
        
        resultsContainer.innerHTML = '';
        
        if(result.data.length === 0) { 
            resultsContainer.innerHTML = '<p style="padding:10px; font-size:12px; color:var(--text-muted);">No items found.</p>'; 
            return; 
        }
        
        result.data.forEach(p => {
            p.variants.forEach(v => {
                const isMatch = (v.sku === term) || p.name.toLowerCase().includes(term.toLowerCase());
                if (isMatch) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'restock-result-item';
                    itemDiv.innerHTML = `
                        <h4>${p.name}</h4>
                        <p>${v.weightOrVolume} • Current Stock: ${v.stock} • SKU: ${v.sku || 'N/A'}</p>
                    `;
                    itemDiv.onclick = () => selectItemForRestock(p, v);
                    resultsContainer.appendChild(itemDiv);
                }
            });
        });
    } catch (e) { 
        console.error("Search error", e); 
    }
}

function selectItemForRestock(product, variant) {
    restockSelectedVariant = { productId: product._id, variantId: variant._id };
    
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('restock-search').value = '';
    
    document.getElementById('restock-item-name').innerText = product.name;
    document.getElementById('restock-item-variant').innerText = `${variant.weightOrVolume} (Current Stock: ${variant.stock})`;
    document.getElementById('restock-product-id').value = product._id; 
    document.getElementById('restock-variant-id').value = variant._id;
    document.getElementById('restock-sell').value = variant.price; 
    
    document.getElementById('restock-selected-item').classList.remove('hidden'); 
    document.getElementById('submit-restock-btn').disabled = false;
}

function calculateMargin() {
    const costInput = document.getElementById('restock-cost').value;
    const sellInput = document.getElementById('restock-sell').value;
    const display = document.getElementById('margin-display');
    
    if (!display) return;

    const cost = parseFloat(costInput);
    const sell = parseFloat(sellInput);

    if (cost > 0 && sell > 0) {
        const profit = sell - cost;
        const margin = ((profit / sell) * 100).toFixed(1);
        display.innerText = `Margin: ${margin}% | Profit: ₹${profit.toFixed(2)}`;
        if (profit < 0) {
            display.style.color = '#991b1b';
            display.style.background = '#fef2f2';
        } else {
            display.style.color = '#0c4a6e';
            display.style.background = '#e0f2fe';
        }
    } else {
        display.innerText = `Margin: --% | Profit: ₹--`;
        display.style.color = '#0c4a6e';
        display.style.background = '#e0f2fe';
    }
}

async function submitRestock(e) {
    e.preventDefault();
    if (!restockSelectedVariant) return showToast("Please select an item to restock.");
    
    const btn = document.getElementById('submit-restock-btn'); 
    btn.innerText = 'Processing...'; 
    btn.disabled = true;
    
    const payload = {
        invoiceNumber: document.getElementById('restock-invoice').value.trim(),
        variantId: document.getElementById('restock-variant-id').value,
        addedQuantity: document.getElementById('restock-qty').value,
        purchasingPrice: document.getElementById('restock-cost').value,
        newSellingPrice: document.getElementById('restock-sell').value
    };
    
    try {
        const productId = document.getElementById('restock-product-id').value;
        const res = await fetch(`${BACKEND_URL}/api/products/${productId}/restock`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        const result = await res.json();
        
        if (result.success) { 
            showToast('Shipment Received & Logged! 📦'); 
            closeRestockModal(); 
            fetchInventory(); 
        } else { 
            showToast('Failed to process restock.'); 
        }
    } catch (err) { 
        showToast('Network error.'); 
    } finally { 
        btn.innerText = 'Process Restock'; 
        btn.disabled = false; 
    }
}

function quickRestock(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;

    openRestockModal();
    selectItemForRestock(product, variant);
}

function openRestockHistory(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;

    document.getElementById('history-item-name').innerText = product.name;
    document.getElementById('history-item-variant').innerText = variant.weightOrVolume;
    
    const container = document.getElementById('history-timeline-container');
    container.innerHTML = '';

    if (!variant.purchaseHistory || variant.purchaseHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No history found for this item.</p>';
    } else {
        const sortedHistory = [...variant.purchaseHistory].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        sortedHistory.forEach(h => {
            const dateStr = new Date(h.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-icon">📦</div>
                <div class="history-details">
                    <h4>+${h.addedQuantity} Units (Inv: ${h.invoiceNumber})</h4>
                    <p>${dateStr} • Cost: ₹${h.purchasingPrice} • Sold For: ₹${h.sellingPrice}</p>
                </div>
            `;
            container.appendChild(item);
        });
    }

    document.getElementById('history-modal').classList.add('active');
}

async function saveInlineEdit(productId, variantId, field, element, event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    element.blur();
    
    const newVal = element.value;
    const product = currentInventory.find(p => p._id === productId);
    const variant = product.variants.find(v => v._id === variantId);
    
    if (Number(newVal) === variant[field]) return; 
    
    variant[field] = Number(newVal);
    showToast('Saving update...');
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        const result = await res.json();
        if (result.success) {
            showToast('Item updated successfully!');
            updateInventoryDashboard();
        } else {
            showToast('Failed to update.');
        }
    } catch(e) {
        showToast('Error saving inline edit.');
    }
}

function updateInventoryDashboard() {
    let outOfStock = 0;
    let lowStock = 0;
    let deadStock = 0; 
    let totalValue = 0;

    currentInventory.forEach(p => {
        if(p.variants) {
            p.variants.forEach(v => {
                if (v.stock === 0) outOfStock++;
                else if (v.stock <= (v.lowStockThreshold || 5)) lowStock++;
                else if (v.stock > 15) deadStock++; 

                totalValue += (v.stock * v.price);
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
    
    if(document.getElementById('overview-view').classList.contains('active')) renderOverview(); 
}

function openSourcingModal() {
    let reorderData = {};
    let totalItemsCount = 0;

    currentInventory.forEach(p => {
        if (p.variants) {
            p.variants.forEach(v => {
                if (v.stock <= (v.lowStockThreshold || 5)) {
                    const dist = p.distributorName || 'Unassigned Distributor';
                    if (!reorderData[dist]) reorderData[dist] = [];
                    
                    let suggestedQty = 20; 
                    if (v.purchaseHistory && v.purchaseHistory.length >= 2) {
                        const firstPurchase = new Date(v.purchaseHistory[0].date);
                        const lastPurchase = new Date(v.purchaseHistory[v.purchaseHistory.length - 1].date);
                        const daysDiff = Math.max(1, (lastPurchase - firstPurchase) / (1000 * 60 * 60 * 24));
                        const totalBought = v.purchaseHistory.reduce((sum, h) => sum + h.addedQuantity, 0);
                        const dailyVelocity = totalBought / daysDiff;
                        suggestedQty = Math.ceil(dailyVelocity * 14); 
                        if (suggestedQty < 10) suggestedQty = 10;
                    }

                    reorderData[dist].push(`- ${p.name} (${v.weightOrVolume}) | Current: ${v.stock} | Suggested Order: ${suggestedQty}`);
                    totalItemsCount++;
                }
            });
        }
    });

    const container = document.getElementById('sourcing-list-container');
    container.innerHTML = '';

    if (totalItemsCount === 0) {
        container.innerHTML = `<p class="empty-state">All stock levels are healthy! No reorder needed.</p>`;
    } else {
        for (const [distributor, items] of Object.entries(reorderData)) {
            const message = `Hi ${distributor},\n\nPlease process the following restock for DailyPick:\n\n${items.join('\n')}\n\nThanks.`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            
            container.innerHTML += `
                <div class="sourcing-item">
                    <div>
                        <h4>${distributor}</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">${items.length} items low</p>
                    </div>
                    <a href="${waUrl}" target="_blank" class="primary-btn-small" style="background: #25D366; text-decoration: none;">💬 WhatsApp PO</a>
                </div>
            `;
        }
    }
    document.getElementById('sourcing-modal').classList.add('active');
}
function closeSourcingModal() { document.getElementById('sourcing-modal').classList.remove('active'); }

function generateReorderList() { openSourcingModal(); }

let searchTimeout;

function debounceInventorySearch() { 
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(applyInventoryFilters, 500); 
}

function toggleLowStockFilter() {
    isLowStockFilterActive = !isLowStockFilterActive;
    const btn = document.getElementById('low-stock-btn');
    
    if (isLowStockFilterActive) {
        btn.style.background = '#DC2626'; 
        btn.style.color = 'white';
    } else {
        btn.style.background = '#FEF2F2'; 
        btn.style.color = '#DC2626';
    }
    
    inventoryPage = 1;
    applyInventoryFilters();
}

function applyInventoryFilters() { 
    inventorySearchTerm = document.getElementById('inventory-search-input').value.trim(); 
    inventoryCategoryFilter = document.getElementById('inventory-cat-filter').value; 
    
    const brandDrop = document.getElementById('inventory-brand-filter');
    const distDrop = document.getElementById('inventory-dist-filter');
    inventoryBrandFilter = brandDrop ? brandDrop.value : 'All';
    inventoryDistributorFilter = distDrop ? distDrop.value : 'All';

    inventoryPage = 1; 
    fetchInventory(); 
}

function loadMoreInventory() { 
    inventoryPage++; 
    fetchInventory(); 
}

function applyInventorySorting(data) {
    const sortDropdown = document.getElementById('inventory-sort');
    const sortVal = sortDropdown ? sortDropdown.value : 'name_asc';
    
    if (sortVal === 'name_asc') {
        return data.sort((a,b) => a.name.localeCompare(b.name));
    }
    if (sortVal === 'stock_low') {
        return data.sort((a,b) => {
            const aStock = a.variants ? a.variants.reduce((sum, v) => sum + v.stock, 0) : 0;
            const bStock = b.variants ? b.variants.reduce((sum, v) => sum + v.stock, 0) : 0;
            return aStock - bStock;
        });
    }
    if (sortVal === 'recent') {
        return data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return data;
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
    
    if (selectedInventory.size > 0) {
        btn.innerText = `Deactivate Selected (${selectedInventory.size})`;
        btn.classList.add('visible');
        priceBtn.innerText = `Edit Prices (${selectedInventory.size})`;
        priceBtn.classList.add('visible');
        if (assignBtn) {
            assignBtn.innerText = `Move (${selectedInventory.size})`;
            assignBtn.classList.add('visible');
        }
    } else { 
        btn.classList.remove('visible'); 
        priceBtn.classList.remove('visible'); 
        if (assignBtn) assignBtn.classList.remove('visible');
    }
}

function openBulkAssignModal() {
    if (selectedInventory.size === 0) return;
    document.getElementById('bulk-assign-count').innerText = `${selectedInventory.size} items selected`;
    
    const catSelect = document.getElementById('bulk-assign-category');
    const brandSelect = document.getElementById('bulk-assign-brand');
    
    catSelect.innerHTML = '<option value="">-- No Change --</option>';
    currentCategories.forEach(cat => {
        catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });

    brandSelect.innerHTML = '<option value="">-- No Change --</option>';
    currentBrands.forEach(b => {
        brandSelect.innerHTML += `<option value="${b.name}">${b.name}</option>`;
    });

    document.getElementById('bulk-assign-modal').classList.add('active');
}

function closeBulkAssignModal() {
    document.getElementById('bulk-assign-modal').classList.remove('active');
}

async function applyBulkAssign() {
    if (selectedInventory.size === 0) return;
    
    const newCat = document.getElementById('bulk-assign-category').value;
    const newBrand = document.getElementById('bulk-assign-brand').value;
    
    if (!newCat && !newBrand) return showToast("No changes selected.");
    
    closeBulkAssignModal();
    showToast(`Moving ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product) {
                if (newCat) product.category = newCat;
                if (newBrand) product.brand = newBrand;
                
                await fetch(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        showToast("Items moved successfully! 📦");
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) {
        showToast("Error moving items.");
    }
}

function openBulkPriceModal() {
    if (selectedInventory.size === 0) return;
    document.getElementById('bulk-price-count').innerText = `${selectedInventory.size} items selected`;
    document.getElementById('bulk-price-modal').classList.add('active');
}
function closeBulkPriceModal() { document.getElementById('bulk-price-modal').classList.remove('active'); }

async function applyBulkPriceEdit() {
    if (selectedInventory.size === 0) return;
    
    const type = document.getElementById('bulk-price-type').value;
    const valueStr = document.getElementById('bulk-price-value').value;
    const value = parseFloat(valueStr);
    
    if (!value || isNaN(value)) return showToast("Enter a valid number");
    
    closeBulkPriceModal();
    showToast(`Updating prices for ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product && product.variants) {
                product.variants.forEach(v => {
                    if (type === 'increase_pct') v.price = v.price + (v.price * (value / 100));
                    if (type === 'decrease_pct') v.price = v.price - (v.price * (value / 100));
                    if (type === 'increase_fixed') v.price = v.price + value;
                    if (type === 'decrease_fixed') v.price = v.price - value;
                    if (v.price < 0) v.price = 0; 
                    v.price = Math.round(v.price * 100) / 100; 
                });
                
                await fetch(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        showToast("Prices Bulk Updated Successfully! 💰");
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) {
        showToast("Error updating prices.");
    }
}

async function bulkDeactivateInventory() {
    if (selectedInventory.size === 0) return;
    
    const btn = document.getElementById('inv-bulk-btn');
    btn.innerText = 'Processing...'; 
    btn.disabled = true;
    
    const ids = Array.from(selectedInventory);
    
    try {
        await Promise.all(ids.map(id => fetch(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' })));
        showToast(`Toggled ${ids.length} products!`);
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) { 
        showToast('Error during bulk action.'); 
    } finally { 
        btn.disabled = false; 
        updateInventoryBulkUI(); 
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

async function fetchInventory() {
    if (inventoryPage === 1) {
        inventoryFeed.innerHTML = '<p class="empty-state">Fetching catalog...</p>';
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

        const res = await fetch(queryUrl);
        const result = await res.json();
        
        if (result.success) { 
            let dataToRender = result.data;

            if (isLowStockFilterActive) {
                dataToRender = dataToRender.filter(p => {
                    return p.variants.some(v => v.stock <= (v.lowStockThreshold || 5));
                });
            }

            if (inventoryPage === 1) {
                currentInventory = dataToRender;
            } else {
                currentInventory = [...currentInventory, ...dataToRender];
            }
            
            updateInventoryDashboard(); 
            currentInventory = applyInventorySorting(currentInventory); 
            renderInventory(dataToRender.length < 30); 
        }
    } catch (e) { 
        if (inventoryPage === 1) {
            inventoryFeed.innerHTML = '<p class="empty-state">Error loading inventory.</p>'; 
        }
    } finally { 
        if (loadBtn) { 
            loadBtn.innerText = 'Load More Products'; 
            loadBtn.disabled = false; 
        } 
    }
}

function renderInventory(isLastPage = true) {
    if (inventoryPage === 1) {
        inventoryFeed.innerHTML = '';
    }
    
    if (currentInventory.length === 0) { 
        inventoryFeed.innerHTML = '<p class="empty-state">No products found.</p>'; 
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
                totalStock += v.stock;
                if (v.stock === 0) {
                    lowestStockFlag = 'out';
                } else if (lowestStockFlag !== 'out' && v.stock <= (v.lowStockThreshold || 5)) {
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

            return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #F8FAFC; border-radius: 8px; margin-bottom: 4px; font-size: 12px;" onclick="event.stopPropagation()">
                <span>${v.weightOrVolume}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="color: var(--text-muted);">₹</span>
                    <input class="inline-edit-input" type="number" value="${v.price}" onkeydown="saveInlineEdit('${p._id}', '${v._id}', 'price', this, event)" title="Press Enter to save">
                    ${marginHtml}
                    <span style="color: var(--text-muted); margin-left: 8px;">Qty:</span>
                    <input class="inline-edit-input" type="number" value="${v.stock}" onkeydown="saveInlineEdit('${p._id}', '${v._id}', 'stock', this, event)" title="Press Enter to save">
                    <button class="quick-restock-btn" onclick="openRestockHistory('${p._id}', '${v._id}', event)" title="Restock History">🕒</button>
                    <button class="quick-restock-btn" onclick="quickRestock('${p._id}', '${v._id}', event)" title="Quick Restock">📦</button>
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
                </div>
            </div>
            <div style="width: 100%; margin-top: 10px; display: none;" id="variants-${p._id}">
                ${variantsHtml}
            </div>
        `;
        
        inventoryFeed.appendChild(card);
    });

    const loadBtn = document.getElementById('load-more-btn');
    if (isLastPage || isLowStockFilterActive) {
        loadBtn.classList.add('hidden');
    } else {
        loadBtn.classList.remove('hidden');
    }
}

async function toggleProductStatus(id, btn, e) {
    e.stopPropagation();
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' });
        const result = await res.json();
        
        if (result.success) { 
            btn.classList.toggle('active'); 
            btn.closest('.inventory-card').classList.toggle('inactive'); 
        }
    } catch (err) { 
        console.error("Toggle Error:", err); 
    }
}

// NEW: Appended Barcode print button to the variant row template
function addVariantRow(weight = '', price = '', stock = '0', sku = '', threshold = '5') {
    const container = document.getElementById('variants-container');
    const row = document.createElement('div');
    row.classList.add('variant-row');
    row.innerHTML = `
        <input type="text" placeholder="Size (e.g. 500g)" class="var-weight" value="${weight}" required style="min-width: 90px;">
        <input type="number" placeholder="Price (₹)" class="var-price" value="${price}" required style="width: 70px; flex: none;">
        <input type="number" placeholder="Stock" class="var-stock" value="${stock}" required style="width: 65px; flex: none;">
        <input type="number" placeholder="Alert At" class="var-threshold" value="${threshold}" title="Low Stock Alert Threshold" required style="width: 65px; flex: none;">
        <input type="text" placeholder="SKU/Barcode" class="var-sku" value="${sku}" style="min-width: 90px;">
        <button type="button" class="scan-sku-btn" onclick="startScannerForSku(this)" title="Scan Barcode">📷</button>
        <button type="button" class="scan-sku-btn" onclick="printBarcode(this)" title="Generate & Print Label">🖨️</button>
        <button type="button" class="remove-variant-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

// NEW: Logic to physically generate a print the Barcode using JsBarcode
function printBarcode(btnElement) {
    const sku = btnElement.parentElement.querySelector('.var-sku').value.trim();
    if(!sku) return showToast("Enter a SKU first to generate a barcode.");
    
    const container = document.getElementById('print-barcode-container');
    container.innerHTML = '<svg id="barcode-canvas"></svg>';
    
    JsBarcode("#barcode-canvas", sku, { format: "CODE128", width: 2, height: 100, displayValue: true });
    
    container.classList.add('active-print');
    window.print();
    container.classList.remove('active-print');
}

// NEW: Physical Audit Mode Logic
function openAuditMode() {
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-modal').classList.add('active');
    setTimeout(() => document.getElementById('audit-scan-input').focus(), 100);
}

function closeAuditMode() {
    document.getElementById('audit-modal').classList.remove('active');
}

function handleAuditScan(e) {
    if (e.key === 'Enter') {
        const sku = document.getElementById('audit-scan-input').value.trim();
        if(!sku) return;
        
        let foundProduct = null; let foundVariant = null;
        for (const p of currentInventory) {
            if(!p.variants) continue;
            for (const v of p.variants) {
                if (v.sku === sku) { foundProduct = p; foundVariant = v; break; }
            }
            if (foundProduct) break;
        }

        if (foundProduct && foundVariant) {
            playBeep();
            document.getElementById('audit-item-name').innerText = `${foundProduct.name} (${foundVariant.weightOrVolume})`;
            document.getElementById('audit-expected-stock').innerText = foundVariant.stock;
            document.getElementById('audit-actual-stock').value = '';
            document.getElementById('audit-pid').value = foundProduct._id;
            document.getElementById('audit-vid').value = foundVariant._id;
            document.getElementById('audit-result-area').classList.remove('hidden');
            document.getElementById('audit-actual-stock').focus();
        } else {
            showToast(`SKU ${sku} not found in database.`);
            document.getElementById('audit-scan-input').value = '';
        }
    }
}

async function submitAuditCorrection() {
    const actual = parseInt(document.getElementById('audit-actual-stock').value);
    if(isNaN(actual)) return showToast("Enter actual physical count");
    
    const pid = document.getElementById('audit-pid').value;
    const vid = document.getElementById('audit-vid').value;
    const product = currentInventory.find(p => p._id === pid);
    const variant = product.variants.find(v => v._id === vid);

    if (variant.stock === actual) {
        showToast("Count matches! No correction needed.");
    } else {
        variant.stock = actual;
        try {
            await fetch(`${BACKEND_URL}/api/products/${pid}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product)
            });
            showToast('Stock corrected successfully! ✅');
            updateInventoryDashboard();
        } catch(e) {
            showToast('Error syncing correction.');
        }
    }
    
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-scan-input').focus();
}

function openAddProductModal() { 
    if (currentCategories.length === 0) return showToast("Create a category first!");
    
    document.getElementById('add-product-form').reset();
    document.getElementById('edit-product-id').value = '';
    document.getElementById('modal-form-title').innerText = 'Add New Product';
    document.getElementById('current-image-text').style.display = 'none';
    document.getElementById('variants-container').innerHTML = ''; 
    document.getElementById('drop-zone').classList.remove('dragover');
    
    addVariantRow(); 
    document.getElementById('add-product-modal').classList.add('active'); 
}

function openEditProductModal(id, e) {
    e.stopPropagation();
    const p = currentInventory.find(item => item._id === id);
    if (!p) return;

    document.getElementById('add-product-form').reset();
    document.getElementById('edit-product-id').value = p._id;
    document.getElementById('modal-form-title').innerText = 'Edit Product';
    
    document.getElementById('new-name').value = p.name;
    document.getElementById('new-category').value = p.category;
    document.getElementById('new-brand').value = p.brand || '';
    document.getElementById('new-distributor').value = p.distributorName || '';
    document.getElementById('new-tags').value = p.searchTags || ''; 
    document.getElementById('current-image-text').style.display = p.imageUrl ? 'block' : 'none';

    const container = document.getElementById('variants-container');
    container.innerHTML = '';
    
    if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => addVariantRow(v.weightOrVolume, v.price, v.stock, v.sku, v.lowStockThreshold || 5));
    } else { 
        addVariantRow(p.weightOrVolume || '', p.price || '', 0, '', 5); 
    }

    document.getElementById('add-product-modal').classList.add('active');
}

function closeAddProductModal() { 
    document.getElementById('add-product-modal').classList.remove('active'); 
}

function compressImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('new-image');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        showToast('Image attached!');
    }
});

async function submitNewProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-product-btn');
    btn.innerText = 'Saving...'; 
    btn.disabled = true;

    try {
        const editId = document.getElementById('edit-product-id').value;
        const fileInput = document.getElementById('new-image');
        let finalImageUrl = undefined; 

        if (fileInput.files.length > 0) {
            const compressedFile = await compressImage(fileInput.files[0]);
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            finalImageUrl = uploadData.secure_url; 
        } else if (!editId) { 
            finalImageUrl = ''; 
        }

        const variantRows = document.querySelectorAll('.variant-row');
        const variants = [];
        
        variantRows.forEach(row => {
            variants.push({ 
                weightOrVolume: row.querySelector('.var-weight').value, 
                price: Number(row.querySelector('.var-price').value), 
                stock: Number(row.querySelector('.var-stock').value),
                lowStockThreshold: Number(row.querySelector('.var-threshold').value),
                sku: row.querySelector('.var-sku').value.trim()
            });
        });

        const p = { 
            name: document.getElementById('new-name').value, 
            category: document.getElementById('new-category').value, 
            brand: document.getElementById('new-brand').value,
            distributorName: document.getElementById('new-distributor').value,
            searchTags: document.getElementById('new-tags').value.trim(), 
            variants: variants 
        };
        
        if (finalImageUrl !== undefined) p.imageUrl = finalImageUrl;

        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `${BACKEND_URL}/api/products/${editId}` : `${BACKEND_URL}/api/products`;

        await fetch(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(p) 
        });
        
        closeAddProductModal(); 
        inventoryPage = 1; 
        fetchInventory(); 
        showToast(editId ? 'Product Updated!' : 'Product Added!');
    } catch (err) { 
        console.error("Save Product Error:", err); 
        showToast('Error saving product.'); 
    } finally { 
        btn.innerText = 'Save Product'; 
        btn.disabled = false; 
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
