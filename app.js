const BACKEND_URL = 'https://dailypick-backend-production-05d6.up.railway.app';

const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; 
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; 

let currentOrders = []; let currentInventory = []; let currentCategories = []; 
let currentBrands = []; let currentDistributors = []; 
let activeOrder = null; let adminEventSource = null; 

let currentOrderTab = 'All'; 
let selectedOrders = new Set();
let inventoryPage = 1;
let inventorySearchTerm = '';
let inventoryCategoryFilter = 'All';

// Scanner & Restock State
let html5QrcodeScanner = null;
let currentSkuInputTarget = null; 
let restockSelectedVariant = null; 

const dailyRevenueEl = document.getElementById('daily-revenue'); const pendingCountEl = document.getElementById('pending-count'); const ordersFeed = document.getElementById('orders-feed'); const inventoryFeed = document.getElementById('inventory-feed'); const orderModalOverlay = document.getElementById('order-modal-overlay');
const views = { orders: document.getElementById('orders-view'), inventory: document.getElementById('inventory-view') }; 
const navBtns = { orders: document.getElementById('nav-orders'), inventory: document.getElementById('nav-inventory') };

// --- CONNECTION RESILIENCE ---
function connectAdminLiveStream() {
    if (adminEventSource) return; 
    adminEventSource = new EventSource(`${BACKEND_URL}/api/orders/stream/admin`);
    adminEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER') {
            currentOrders.unshift(data.order);
            updateDashboard();
            showToast('🚨 New Order Arrived!');
        }
    };
    adminEventSource.onerror = () => {
        console.warn("SSE Connection lost. Reconnecting in 3s...");
        adminEventSource.close();
        adminEventSource = null;
        setTimeout(connectAdminLiveStream, 3000);
    };
}

function switchView(viewName) {
    document.getElementById('header-subtitle').innerText = viewName === 'orders' ? 'Live Operations Center' : 'Inventory Management';
    Object.keys(views).forEach(key => {
        if (key === viewName) { views[key].classList.add('active'); views[key].classList.remove('hidden'); navBtns[key].classList.add('active'); } 
        else { views[key].classList.remove('active'); views[key].classList.add('hidden'); navBtns[key].classList.remove('active'); }
    });
    if (viewName === 'inventory' && currentInventory.length === 0) fetchInventory();
}

// --- ORDER OPERATIONS ---
async function fetchOrders() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        if (result.success) {
            currentOrders = result.data;
            updateDashboard();
            connectAdminLiveStream(); 
        }
    } catch (e) { console.error("Order Fetch Error:", e); }
}

function setOrderTab(tab) {
    currentOrderTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    updateDashboard();
}

function toggleOrderSelection(orderId, event) {
    event.stopPropagation();
    if (selectedOrders.has(orderId)) selectedOrders.delete(orderId);
    else selectedOrders.add(orderId);
    updateBulkDispatchUI();
}

function updateBulkDispatchUI() {
    const btn = document.getElementById('bulk-dispatch-btn');
    if (selectedOrders.size > 0) {
        btn.innerText = `Dispatch Selected (${selectedOrders.size})`;
        btn.classList.add('visible');
    } else { btn.classList.remove('visible'); }
}

async function bulkDispatchOrders() {
    if (selectedOrders.size === 0) return;
    const btn = document.getElementById('bulk-dispatch-btn');
    btn.innerText = 'Dispatching...'; btn.disabled = true;
    const idsToDispatch = Array.from(selectedOrders);
    try {
        await Promise.all(idsToDispatch.map(id => fetch(`${BACKEND_URL}/api/orders/${id}/dispatch`, { method: 'PUT' })));
        showToast(`Dispatched ${idsToDispatch.length} orders! 📦`);
        currentOrders = currentOrders.filter(o => !selectedOrders.has(o._id));
        selectedOrders.clear();
        updateDashboard();
    } catch (err) { showToast('Error during bulk dispatch.'); } 
    finally { btn.disabled = false; updateBulkDispatchUI(); }
}

function updateDashboard() {
    const pending = currentOrders.filter(o => o.status === 'Order Placed');
    dailyRevenueEl.innerText = `₹${pending.reduce((s, o) => s + o.totalAmount, 0)}`;
    pendingCountEl.innerText = pending.length;
    ordersFeed.innerHTML = '';
    
    let displayOrders = pending;
    if (currentOrderTab === 'Instant') displayOrders = pending.filter(o => o.deliveryType !== 'Routine');
    if (currentOrderTab === 'Routine') displayOrders = pending.filter(o => o.deliveryType === 'Routine');

    if (displayOrders.length === 0) { ordersFeed.innerHTML = `<p class="empty-state">No pending orders in ${currentOrderTab}.</p>`; return; }
    
    displayOrders.forEach(order => {
        const isRoutine = order.deliveryType === 'Routine';
        const cardWrapper = document.createElement('div');
        cardWrapper.style.display = 'flex'; cardWrapper.style.alignItems = 'center'; cardWrapper.style.gap = '12px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.className = 'order-checkbox';
        checkbox.checked = selectedOrders.has(order._id);
        checkbox.onclick = (e) => toggleOrderSelection(order._id, e);

        const card = document.createElement('div'); card.classList.add('order-card');
        card.style.flex = '1';
        card.innerHTML = `<div class="order-info"><h4>Order #${order._id.toString().slice(-4).toUpperCase()}</h4><p class="order-meta">${order.customerName || 'Guest'} • ${isRoutine ? '📅 Routine' : '⚡ Instant'}</p></div><div class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</div>`;
        card.onclick = () => openOrderModal(order);
        
        cardWrapper.appendChild(checkbox); cardWrapper.appendChild(card);
        ordersFeed.appendChild(cardWrapper);
    });
    updateBulkDispatchUI();
}

// --- SETUP DATA: CATEGORIES, BRANDS, DISTRIBUTORS ---
async function fetchCategories() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        if (result.success) { 
            currentCategories = result.data;
            const select = document.getElementById('new-category');
            select.innerHTML = currentCategories.length === 0 ? '<option value="" disabled selected>No Categories Created</option>' : '';
            const filterSelect = document.getElementById('inventory-cat-filter');
            if(filterSelect) filterSelect.innerHTML = '<option value="All">All Categories</option>';

            currentCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name; option.innerText = cat.name;
                select.appendChild(option);
                if(filterSelect) {
                    const filterOption = document.createElement('option');
                    filterOption.value = cat.name; filterOption.innerText = cat.name;
                    filterSelect.appendChild(filterOption);
                }
            });
        }
    } catch (e) { console.error("Error loading categories", e); }
}

async function fetchBrands() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/brands`);
        const result = await res.json();
        if (result.success) {
            currentBrands = result.data;
            const select = document.getElementById('new-brand');
            select.innerHTML = '<option value="">Select Brand (Optional)</option>';
            currentBrands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name; opt.innerText = b.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error loading brands", e); }
}

async function fetchDistributors() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        if (result.success) {
            currentDistributors = result.data;
            const select = document.getElementById('new-distributor');
            const restockSelect = document.getElementById('restock-distributor');
            
            select.innerHTML = '<option value="">Select Distributor (Optional)</option>';
            restockSelect.innerHTML = '<option value="">Select a Distributor</option>';

            currentDistributors.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name; opt.innerText = d.name;
                select.appendChild(opt);
                
                const opt2 = document.createElement('option');
                opt2.value = d.name; opt2.innerText = d.name;
                restockSelect.appendChild(opt2);
            });
        }
    } catch (e) { console.error("Error loading distributors", e); }
}

function openAddCategoryModal() { document.getElementById('add-category-form').reset(); document.getElementById('add-category-modal').classList.add('active'); }
function closeAddCategoryModal() { document.getElementById('add-category-modal').classList.remove('active'); }
async function submitNewCategory(e) {
    e.preventDefault(); const btn = document.getElementById('submit-cat-btn'); btn.innerText = 'Saving...'; btn.disabled = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('new-cat-name').value.trim() }) });
        const result = await res.json();
        if (result.success) { closeAddCategoryModal(); fetchCategories(); showToast('Category Added!'); } else { showToast(result.message); }
    } catch (err) { showToast('Error saving category.'); } finally { btn.innerText = 'Save Category'; btn.disabled = false; }
}

function openAddBrandModal() { document.getElementById('new-brand-name').value = ''; document.getElementById('add-brand-modal').classList.add('active'); }
function closeAddBrandModal() { document.getElementById('add-brand-modal').classList.remove('active'); }
async function submitNewBrand(e) {
    e.preventDefault(); const btn = document.getElementById('submit-brand-btn'); btn.innerText = 'Saving...'; btn.disabled = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/brands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('new-brand-name').value.trim() }) });
        const result = await res.json();
        if (result.success) { closeAddBrandModal(); fetchBrands(); showToast('Brand Added!'); } else { showToast(result.message); }
    } catch (err) { showToast('Error saving brand.'); } finally { btn.innerText = 'Save Brand'; btn.disabled = false; }
}

function openAddDistributorModal() { document.getElementById('new-dist-name').value = ''; document.getElementById('add-distributor-modal').classList.add('active'); }
function closeAddDistributorModal() { document.getElementById('add-distributor-modal').classList.remove('active'); }
async function submitNewDistributor(e) {
    e.preventDefault(); const btn = document.getElementById('submit-dist-btn'); btn.innerText = 'Saving...'; btn.disabled = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/distributors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('new-dist-name').value.trim() }) });
        const result = await res.json();
        if (result.success) { closeAddDistributorModal(); fetchDistributors(); showToast('Distributor Added!'); } else { showToast(result.message); }
    } catch (err) { showToast('Error saving distributor.'); } finally { btn.innerText = 'Save Distributor'; btn.disabled = false; }
}

// --- OPTIMIZED BARCODE SCANNER LOGIC ---
function closeScannerModal() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => console.log("Failed to stop scanner", err));
    }
    document.getElementById('scanner-modal').classList.remove('active');
}

function playBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // Beep pitch
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function startScanner(onSuccessCallback) {
    document.getElementById('scanner-modal').classList.add('active');
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    // Highly optimized config for retail barcodes
    const scannerConfig = {
        fps: 20, // Increased to process frames faster and reduce motion blur
        // Removed qrbox: Allows scanning anywhere on the screen, better for long barcodes
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
        { facingMode: "environment" }, // Use back camera
        scannerConfig,
        (decodedText) => {
            playBeep();
            closeScannerModal();
            onSuccessCallback(decodedText);
        },
        (errorMessage) => { 
            // Library constantly throws errors while searching for a code, we safely ignore them
        }
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

// --- RESTOCK & RECEIVE SHIPMENT LOGIC ---
function openRestockModal() {
    if (currentDistributors.length === 0) return showToast("Create a Distributor first!");
    document.getElementById('restock-form').reset();
    document.getElementById('restock-selected-item').classList.add('hidden');
    document.getElementById('restock-search-results').innerHTML = '';
    restockSelectedVariant = null;
    document.getElementById('submit-restock-btn').disabled = true;
    document.getElementById('restock-modal').classList.add('active');
}

function closeRestockModal() { document.getElementById('restock-modal').classList.remove('active'); }

function startScannerForRestock() {
    startScanner((decodedText) => {
        document.getElementById('restock-search').value = decodedText;
        searchRestockItem(decodedText);
    });
}

async function searchRestockItem(overrideSearchTerm = null) {
    const term = overrideSearchTerm || document.getElementById('restock-search').value.trim();
    const resultsContainer = document.getElementById('restock-search-results');
    
    if (term.length < 2) { resultsContainer.innerHTML = ''; return; }
    
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
                    itemDiv.innerHTML = `<h4>${p.name}</h4><p>${v.weightOrVolume} • Current Stock: ${v.stock} • SKU: ${v.sku || 'N/A'}</p>`;
                    itemDiv.onclick = () => selectItemForRestock(p, v);
                    resultsContainer.appendChild(itemDiv);
                }
            });
        });
    } catch (e) { console.error("Search error", e); }
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

async function submitRestock(e) {
    e.preventDefault();
    if (!restockSelectedVariant) return showToast("Please select an item to restock.");

    const btn = document.getElementById('submit-restock-btn');
    btn.innerText = 'Processing...'; btn.disabled = true;

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
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
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
        btn.innerText = 'Process Restock'; btn.disabled = false;
    }
}

// --- INVENTORY PAGINATION & SEARCH ---
let searchTimeout;
function debounceInventorySearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyInventoryFilters, 500); }
function applyInventoryFilters() { inventorySearchTerm = document.getElementById('inventory-search-input').value.trim(); inventoryCategoryFilter = document.getElementById('inventory-cat-filter').value; inventoryPage = 1; fetchInventory(); }
function loadMoreInventory() { inventoryPage++; fetchInventory(); }

async function fetchInventory() {
    if(inventoryPage === 1) inventoryFeed.innerHTML = '<p class="empty-state">Fetching catalog...</p>';
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) { loadBtn.innerText = 'Loading...'; loadBtn.disabled = true; }

    try {
        let queryUrl = `${BACKEND_URL}/api/products?all=true&page=${inventoryPage}&limit=30`;
        if (inventorySearchTerm) queryUrl += `&search=${encodeURIComponent(inventorySearchTerm)}`;
        if (inventoryCategoryFilter !== 'All') queryUrl += `&category=${encodeURIComponent(inventoryCategoryFilter)}`;

        const res = await fetch(queryUrl);
        const result = await res.json();
        
        if (result.success) { 
            if (inventoryPage === 1) currentInventory = result.data;
            else currentInventory = [...currentInventory, ...result.data];
            renderInventory(result.data.length < 30); 
        }
    } catch (e) { if(inventoryPage === 1) inventoryFeed.innerHTML = '<p class="empty-state">Error loading inventory.</p>'; } 
    finally { if (loadBtn) { loadBtn.innerText = 'Load More Products'; loadBtn.disabled = false; } }
}

function renderInventory(isLastPage = true) {
    if (inventoryPage === 1) inventoryFeed.innerHTML = '';
    if (currentInventory.length === 0) { inventoryFeed.innerHTML = '<p class="empty-state">No products found.</p>'; document.getElementById('load-more-btn').classList.add('hidden'); return; }
    
    const itemsToRender = inventoryPage === 1 ? currentInventory : currentInventory.slice((inventoryPage - 1) * 30);

    itemsToRender.forEach(p => {
        const card = document.createElement('div'); card.classList.add('inventory-card');
        if (!p.isActive) card.classList.add('inactive');
        
        const thumb = p.imageUrl ? `<img src="${p.imageUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right:12px;">` : `<div style="width:40px; height:40px; border-radius:8px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:20px; margin-right:12px;">📦</div>`;
        const vCount = p.variants ? p.variants.length : 0;
        const totalStock = p.variants ? p.variants.reduce((sum, v) => sum + (v.stock || 0), 0) : 0;
        const metaText = vCount > 0 ? `${vCount} Variant${vCount > 1 ? 's' : ''} • Stock: ${totalStock}` : `No variants`;

        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${thumb}
                <div class="inv-info">
                    <h4>${p.name}</h4>
                    <p class="inv-meta" style="font-size: 11px; color: var(--text-muted);">${metaText}</p>
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                <button class="edit-btn" onclick="openEditProductModal('${p._id}', event)">Edit</button>
                <button class="toggle-switch ${p.isActive ? 'active' : ''}" onclick="toggleProductStatus('${p._id}', this, event)"></button>
            </div>`;
        inventoryFeed.appendChild(card);
    });

    const loadBtn = document.getElementById('load-more-btn');
    if (isLastPage) loadBtn.classList.add('hidden');
    else loadBtn.classList.remove('hidden');
}

async function toggleProductStatus(id, btn, e) {
    e.stopPropagation();
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) { btn.classList.toggle('active'); btn.closest('.inventory-card').classList.toggle('inactive'); }
    } catch (err) { console.error("Toggle Error:", err); }
}

function openOrderModal(order) {
    activeOrder = order;
    document.getElementById('modal-order-id').innerText = `Order #${order._id.toString().slice(-4).toUpperCase()}`;
    document.getElementById('modal-customer-name').innerText = order.customerName || 'Guest';
    const phoneEl = document.getElementById('modal-customer-phone');
    phoneEl.innerText = order.customerPhone || 'N/A'; phoneEl.href = `tel:${order.customerPhone || ''}`;
    document.getElementById('modal-customer-address').innerText = order.deliveryAddress || 'N/A';
    document.getElementById('modal-delivery-badge').innerHTML = `<span class="type-badge ${order.deliveryType === 'Routine' ? 'type-routine' : 'type-instant'}">${order.deliveryType} ${order.deliveryType === 'Routine' ? '(' + order.scheduleTime + ')' : ''}</span>`;
    document.getElementById('modal-total').innerText = `₹${order.totalAmount}`;
    document.getElementById('modal-payment').innerText = order.paymentMethod;
    const listEl = document.getElementById('modal-packing-list'); listEl.innerHTML = '';
    order.items.forEach(i => {
        const variantText = i.selectedVariant ? ` (${i.selectedVariant})` : '';
        const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.padding = '8px 0'; li.style.borderBottom = '1px solid #eee';
        li.innerHTML = `<span>${i.name}${variantText}</span><span class="item-qty">x${i.qty}</span>`;
        listEl.appendChild(li);
    });
    orderModalOverlay.classList.add('active');
}

function closeOrderModal() { orderModalOverlay.classList.remove('active'); }

async function markOrderDispatched() {
    if (!activeOrder) return; const targetOrderId = activeOrder._id;
    currentOrders = currentOrders.filter(o => o._id !== targetOrderId);
    selectedOrders.delete(targetOrderId);
    closeOrderModal(); updateDashboard(); showToast('Dispatching to rider... 📦');
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, { method: 'PUT' });
        const result = await res.json();
        if (!result.success) { showToast('Database Error.'); fetchOrders(); }
    } catch (e) { showToast('Network error updating database.'); fetchOrders(); }
}

function addVariantRow(weight = '', price = '', stock = '0', sku = '') {
    const container = document.getElementById('variants-container');
    const row = document.createElement('div');
    row.classList.add('variant-row');
    row.innerHTML = `
        <input type="text" placeholder="Size (e.g. 500g)" class="var-weight" value="${weight}" required style="min-width: 100px;">
        <input type="number" placeholder="Price (₹)" class="var-price" value="${price}" required style="width: 70px; flex: none;">
        <input type="number" placeholder="Stock" class="var-stock" value="${stock}" required style="width: 70px; flex: none;">
        <input type="text" placeholder="SKU/Barcode" class="var-sku" value="${sku}">
        <button type="button" class="scan-sku-btn" onclick="startScannerForSku(this)" title="Scan Barcode">📷</button>
        <button type="button" class="remove-variant-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

function openAddProductModal() { 
    if (currentCategories.length === 0) return showToast("Create a category first!");
    document.getElementById('add-product-form').reset();
    document.getElementById('edit-product-id').value = '';
    document.getElementById('modal-form-title').innerText = 'Add New Product';
    document.getElementById('current-image-text').style.display = 'none';
    document.getElementById('variants-container').innerHTML = ''; 
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
        p.variants.forEach(v => addVariantRow(v.weightOrVolume, v.price, v.stock, v.sku));
    } else { addVariantRow(p.weightOrVolume || '', p.price || '', 0, ''); }

    document.getElementById('add-product-modal').classList.add('active');
}

function closeAddProductModal() { document.getElementById('add-product-modal').classList.remove('active'); }

async function submitNewProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-product-btn');
    btn.innerText = 'Saving...'; btn.disabled = true;

    try {
        const editId = document.getElementById('edit-product-id').value;
        const fileInput = document.getElementById('new-image');
        let finalImageUrl = undefined; 

        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            finalImageUrl = uploadData.secure_url; 
        } else if (!editId) { finalImageUrl = ''; }

        const variantRows = document.querySelectorAll('.variant-row');
        const variants = [];
        variantRows.forEach(row => {
            variants.push({ 
                weightOrVolume: row.querySelector('.var-weight').value, 
                price: Number(row.querySelector('.var-price').value), 
                stock: Number(row.querySelector('.var-stock').value),
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

        await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
        
        closeAddProductModal(); 
        inventoryPage = 1; 
        fetchInventory(); 
        showToast(editId ? 'Product Updated!' : 'Product Added!');
    } catch (err) { console.error("Save Product Error:", err); showToast('Error saving product.'); } 
    finally { btn.innerText = 'Save Product'; btn.disabled = false; }
}

function exportInventoryCSV() {
    if (currentInventory.length === 0) return showToast('No inventory to export.');
    let csvContent = "Name,Category,Brand,Distributor,Image URL,SearchTags,VariantsJSON\n";
    currentInventory.forEach(p => {
        const cleanName = p.name.replace(/,/g, ''); 
        const cleanTags = (p.searchTags || '').replace(/,/g, ';'); 
        const variantsString = JSON.stringify(p.variants || []).replace(/"/g, '""'); 
        csvContent += `${cleanName},${p.category},${p.brand || ''},${p.distributorName || ''},${p.imageUrl || ''},${cleanTags},"${variantsString}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "dailypick_inventory.csv"); 
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importInventoryCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        const productsToImport = [];
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (cols && cols.length >= 7) { 
                let variantsArr = [];
                try { variantsArr = JSON.parse(cols[6].replace(/(^"|"$)/g, '').replace(/""/g, '"')); } catch(e) { console.log('Error parsing JSON row', i); }
                productsToImport.push({
                    name: cols[0].replace(/(^"|"$)/g, '').trim(), 
                    category: cols[1].replace(/(^"|"$)/g, '').trim(), 
                    brand: cols[2].replace(/(^"|"$)/g, '').trim(), 
                    distributorName: cols[3].replace(/(^"|"$)/g, '').trim(), 
                    imageUrl: cols[4].replace(/(^"|"$)/g, '').trim(), 
                    searchTags: cols[5].replace(/(^"|"$)/g, '').replace(/;/g, ',').trim(), 
                    variants: variantsArr
                });
            }
        }
        if (productsToImport.length === 0) { event.target.value = ''; return showToast('No valid rows found.'); }
        showToast(`Uploading ${productsToImport.length} items to database...`);
        try {
            const res = await fetch(`${BACKEND_URL}/api/products/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: productsToImport }) });
            const result = await res.json();
            if (result.success) { showToast(result.message); inventoryPage = 1; fetchInventory(); } 
            else { showToast('Database Error.'); }
        } catch (err) { console.error("Import Error:", err); showToast('Network error.'); }
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

function showToast(m) { const t=document.createElement('div'); t.classList.add('toast'); t.innerText=m; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(),3000); }

// Initialize
fetchCategories(); 
fetchBrands();
fetchDistributors();
fetchOrders();
