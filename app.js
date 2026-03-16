const BACKEND_URL = 'https://dailypick-backend-production-05d6.up.railway.app';

// --- CLOUDINARY KEYS (Create a free account at cloudinary.com to enable images) ---
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; 
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; 

let currentOrders = []; let currentInventory = []; let activeOrder = null; let adminEventSource = null; 
const dailyRevenueEl = document.getElementById('daily-revenue'); const pendingCountEl = document.getElementById('pending-count'); const ordersFeed = document.getElementById('orders-feed'); const inventoryFeed = document.getElementById('inventory-feed'); const orderModalOverlay = document.getElementById('order-modal-overlay');
const views = { orders: document.getElementById('orders-view'), inventory: document.getElementById('inventory-view') }; const navBtns = { orders: document.getElementById('nav-orders'), inventory: document.getElementById('nav-inventory') };

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
        
        // NEW: Show mini-image if one exists
        const thumb = p.imageUrl 
            ? `<img src="${p.imageUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right:12px;">` 
            : `<div style="width:40px; height:40px; border-radius:8px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:20px; margin-right:12px;">📦</div>`;

        card.innerHTML = `<div style="display:flex; align-items:center;">${thumb}<div class="inv-info"><h4>${p.name}</h4><p class="inv-meta">₹${p.price} • ${p.weightOrVolume}</p></div></div><button class="toggle-switch ${p.isActive ? 'active' : ''}" onclick="toggleProductStatus('${p._id}', this, event)"></button>`;
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
        const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.padding = '8px 0'; li.style.borderBottom = '1px solid #eee';
        li.innerHTML = `<span>${i.name}</span><span class="item-qty">x${i.qty}</span>`;
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

function openAddProductModal() { document.getElementById('add-product-modal').classList.add('active'); }
function closeAddProductModal() { document.getElementById('add-product-modal').classList.remove('active'); }

async function submitNewProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-product-btn');
    btn.innerText = 'Uploading...'; btn.disabled = true;

    try {
        let finalImageUrl = '';
        const fileInput = document.getElementById('new-image');
        
        // --- NEW: CLOUDINARY DIRECT BROWSER UPLOAD ---
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST', body: formData
            });
            const uploadData = await uploadRes.json();
            finalImageUrl = uploadData.secure_url; // Grab the beautiful, compressed URL
        }

        const p = {
            name: document.getElementById('new-name').value,
            price: Number(document.getElementById('new-price').value),
            weightOrVolume: document.getElementById('new-weight').value,
            category: document.getElementById('new-category').value,
            imageUrl: finalImageUrl 
        };

        await fetch(`${BACKEND_URL}/api/products`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
        });
        
        e.target.reset(); closeAddProductModal(); fetchInventory(); showToast('Product Added!');
    } catch (err) {
        console.error("Add Product Error:", err);
        showToast('Error saving product. Check Cloudinary settings.');
    } finally {
        btn.innerText = 'Save Product'; btn.disabled = false;
    }
}

// --- NEW: BULK CSV EXPORT ---
function exportInventoryCSV() {
    if (currentInventory.length === 0) return showToast('No inventory to export.');
    
    let csvContent = "Name,Price,Weight/Volume,Category,Image URL\n";
    
    currentInventory.forEach(p => {
        const cleanName = p.name.replace(/,/g, ''); 
        csvContent += `${cleanName},${p.price},${p.weightOrVolume},${p.category},${p.imageUrl || ''}\n`;
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

// --- NEW: BULK CSV IMPORT ---
function importInventoryCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        
        const productsToImport = [];
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 4) {
                productsToImport.push({
                    name: cols[0].trim(),
                    price: Number(cols[1].trim()),
                    weightOrVolume: cols[2].trim(),
                    category: cols[3].trim(),
                    imageUrl: cols[4] ? cols[4].trim() : ''
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

fetchOrders();
