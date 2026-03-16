const BACKEND_URL = 'https://dailypick-backend-production-05d6.up.railway.app';

const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; 
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; 

let currentOrders = []; let currentInventory = []; let currentCategories = []; 
let activeOrder = null; let adminEventSource = null; 

const dailyRevenueEl = document.getElementById('daily-revenue'); const pendingCountEl = document.getElementById('pending-count'); const ordersFeed = document.getElementById('orders-feed'); const inventoryFeed = document.getElementById('inventory-feed'); const orderModalOverlay = document.getElementById('order-modal-overlay');
const views = { orders: document.getElementById('orders-view'), inventory: document.getElementById('inventory-view') }; 
const navBtns = { orders: document.getElementById('nav-orders'), inventory: document.getElementById('nav-inventory') };

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
}

function switchView(viewName) {
    document.getElementById('header-subtitle').innerText = viewName === 'orders' ? 'Live Operations Center' : 'Inventory Management';
    Object.keys(views).forEach(key => {
        if (key === viewName) { views[key].classList.add('active'); views[key].classList.remove('hidden'); navBtns[key].classList.add('active'); } 
        else { views[key].classList.remove('active'); views[key].classList.add('hidden'); navBtns[key].classList.remove('active'); }
    });
    if (viewName === 'inventory') fetchInventory();
}

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

function updateDashboard() {
    const pending = currentOrders.filter(o => o.status === 'Order Placed');
    dailyRevenueEl.innerText = `₹${pending.reduce((s, o) => s + o.totalAmount, 0)}`;
    pendingCountEl.innerText = pending.length;
    ordersFeed.innerHTML = '';
    if (pending.length === 0) { ordersFeed.innerHTML = '<p class="empty-state">No pending orders.</p>'; return; }
    pending.forEach(order => {
        const isRoutine = order.deliveryType === 'Routine';
        const card = document.createElement('div'); card.classList.add('order-card');
        card.innerHTML = `<div class="order-info"><h4>Order #${order._id.toString().slice(-4).toUpperCase()}</h4><p class="order-meta">${order.customerName || 'Guest'} • ${isRoutine ? '📅 Routine' : '⚡ Instant'}</p></div><div class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</div>`;
        card.onclick = () => openOrderModal(order);
        ordersFeed.appendChild(card);
    });
}

// --- NEW: CATEGORY MANAGEMENT ---
async function fetchCategories() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        if (result.success) { 
            currentCategories = result.data;
            const select = document.getElementById('new-category');
            select.innerHTML = currentCategories.length === 0 ? '<option value="" disabled selected>No Categories Created</option>' : '';
            currentCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name; option.innerText = cat.name;
                select.appendChild(option);
            });
        }
    } catch (e) { console.error("Error loading categories", e); }
}

function openAddCategoryModal() { document.getElementById('add-category-form').reset(); document.getElementById('add-category-modal').classList.add('active'); }
function closeAddCategoryModal() { document.getElementById('add-category-modal').classList.remove('active'); }

async function submitNewCategory(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-cat-btn');
    btn.innerText = 'Saving...'; btn.disabled = true;

    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-cat-name').value.trim() })
        });
        const result = await res.json();
        if (result.success) {
            closeAddCategoryModal(); fetchCategories(); showToast('Category Added!');
        } else {
            showToast(result.message);
        }
    } catch (err) {
        showToast('Error saving category.');
    } finally {
        btn.innerText = 'Save Category'; btn.disabled = false;
    }
}

// --- INVENTORY MANAGEMENT ---
async function fetchInventory() {
    inventoryFeed.innerHTML = '<p class="empty-state">Fetching catalog...</p>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/products?all=true`);
        const result = await res.json();
        if (result.success) { currentInventory = result.data; renderInventory(); }
    } catch (e) { inventoryFeed.innerHTML = '<p class="empty-state">Error loading inventory.</p>'; }
}

function renderInventory() {
    inventoryFeed.innerHTML = '';
    if (currentInventory.length === 0) { inventoryFeed.innerHTML = '<p class="empty-state">No products found.</p>'; return; }
    
    currentInventory.forEach(p => {
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
}

async function toggleProductStatus(id, btn, e) {
    e.stopPropagation();
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) fetchInventory();
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
    closeOrderModal(); updateDashboard(); showToast('Dispatching to rider... 📦');
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, { method: 'PUT' });
        const result = await res.json();
        if (!result.success) { showToast('Database Error.'); fetchOrders(); }
    } catch (e) { showToast('Network error updating database.'); fetchOrders(); }
}

function addVariantRow(weight = '', price = '', stock = '0') {
    const container = document.getElementById('variants-container');
    const row = document.createElement('div');
    row.classList.add('variant-row');
    row.innerHTML = `
        <input type="text" placeholder="Size (e.g. 500g)" class="var-weight" value="${weight}" required>
        <input type="number" placeholder="Price (₹)" class="var-price" value="${price}" required>
        <input type="number" placeholder="Stock" class="var-stock" value="${stock}" required>
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
    document.getElementById('new-tags').value = p.searchTags || ''; // NEW: Populate Tags
    document.getElementById('current-image-text').style.display = p.imageUrl ? 'block' : 'none';

    const container = document.getElementById('variants-container');
    container.innerHTML = '';
    if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => addVariantRow(v.weightOrVolume, v.price, v.stock));
    } else {
        addVariantRow(p.weightOrVolume || '', p.price || '', 0);
    }

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
        } else if (!editId) {
            finalImageUrl = ''; 
        }

        const variantRows = document.querySelectorAll('.variant-row');
        const variants = [];
        variantRows.forEach(row => {
            variants.push({
                weightOrVolume: row.querySelector('.var-weight').value,
                price: Number(row.querySelector('.var-price').value),
                stock: Number(row.querySelector('.var-stock').value)
            });
        });

        const p = {
            name: document.getElementById('new-name').value,
            category: document.getElementById('new-category').value,
            searchTags: document.getElementById('new-tags').value.trim(), // NEW: Save Tags
            variants: variants
        };
        if (finalImageUrl !== undefined) p.imageUrl = finalImageUrl;

        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `${BACKEND_URL}/api/products/${editId}` : `${BACKEND_URL}/api/products`;

        await fetch(url, {
            method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
        });
        
        closeAddProductModal(); fetchInventory(); showToast(editId ? 'Product Updated!' : 'Product Added!');
    } catch (err) {
        console.error("Save Product Error:", err);
        showToast('Error saving product.');
    } finally {
        btn.innerText = 'Save Product'; btn.disabled = false;
    }
}

// --- UPDATED CSV EXPORT FOR TAGS ---
function exportInventoryCSV() {
    if (currentInventory.length === 0) return showToast('No inventory to export.');
    
    // NEW: Added SearchTags column
    let csvContent = "Name,Category,Image URL,SearchTags,VariantsJSON\n";
    
    currentInventory.forEach(p => {
        const cleanName = p.name.replace(/,/g, ''); 
        const cleanTags = (p.searchTags || '').replace(/,/g, ';'); // Replace commas with semicolons to avoid breaking CSV
        const variantsString = JSON.stringify(p.variants || []).replace(/"/g, '""'); 
        csvContent += `${cleanName},${p.category},${p.imageUrl || ''},${cleanTags},"${variantsString}"\n`;
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

// --- UPDATED CSV IMPORT FOR TAGS ---
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
            if (cols && cols.length >= 5) { // NEW: Expecting 5 columns now
                let variantsArr = [];
                try {
                    variantsArr = JSON.parse(cols[4].replace(/(^"|"$)/g, '').replace(/""/g, '"'));
                } catch(e) { console.log('Error parsing variants JSON on row', i); }

                productsToImport.push({
                    name: cols[0].replace(/(^"|"$)/g, '').trim(),
                    category: cols[1].replace(/(^"|"$)/g, '').trim(),
                    imageUrl: cols[2].replace(/(^"|"$)/g, '').trim(),
                    searchTags: cols[3].replace(/(^"|"$)/g, '').replace(/;/g, ',').trim(), // Restore commas
                    variants: variantsArr
                });
            }
        }

        if (productsToImport.length === 0) {
            event.target.value = ''; 
            return showToast('No valid rows found in file.');
        }

        showToast(`Uploading ${productsToImport.length} items to database...`);
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/products/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: productsToImport })
            });
            const result = await res.json();
            
            if (result.success) {
                showToast(result.message);
                fetchInventory(); 
            } else {
                showToast('Database Error importing items.');
            }
        } catch (err) {
            console.error("Bulk Import Error:", err);
            showToast('Network error during import.');
        }
        
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

function showToast(m) { const t=document.createElement('div'); t.classList.add('toast'); t.innerText=m; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(),3000); }

// Initialize
fetchCategories(); 
fetchOrders();
