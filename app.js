const BACKEND_URL = 'https://dailypick-backend-production-05d6.up.railway.app';
let currentOrders = [];
let currentInventory = [];
let activeOrder = null;
let adminEventSource = null; // Memory bank for the live radio channel

const dailyRevenueEl = document.getElementById('daily-revenue');
const pendingCountEl = document.getElementById('pending-count');
const ordersFeed = document.getElementById('orders-feed');
const inventoryFeed = document.getElementById('inventory-feed');
const orderModalOverlay = document.getElementById('order-modal-overlay');

const views = {
    orders: document.getElementById('orders-view'),
    inventory: document.getElementById('inventory-view')
};
const navBtns = {
    orders: document.getElementById('nav-orders'),
    inventory: document.getElementById('nav-inventory')
};

// Start listening for live signals from Railway
function connectAdminLiveStream() {
    if (adminEventSource) return; // Don't open twice
    
    adminEventSource = new EventSource(`${BACKEND_URL}/api/orders/stream/admin`);
    
    adminEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER') {
            // Instantly push the new order to the front of the local array and redraw
            currentOrders.unshift(data.order);
            updateDashboard();
            showToast('🚨 New Order Arrived!');
        }
    };
}

function switchView(viewName) {
    document.getElementById('header-subtitle').innerText = viewName === 'orders' ? 'Live Operations Center' : 'Inventory Management';
    
    Object.keys(views).forEach(key => {
        if (key === viewName) {
            views[key].classList.add('active');
            views[key].classList.remove('hidden');
            navBtns[key].classList.add('active');
        } else {
            views[key].classList.remove('active');
            views[key].classList.add('hidden');
            navBtns[key].classList.remove('active');
        }
    });

    if (viewName === 'inventory') {
        fetchInventory();
    }
}

async function fetchOrders() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        if (result.success) {
            currentOrders = result.data;
            updateDashboard();
            connectAdminLiveStream(); // Connect to the socket after first load
        }
    } catch (e) {
        console.error("Order Fetch Error:", e);
    }
}

function updateDashboard() {
    const pending = currentOrders.filter(o => o.status === 'Order Placed');
    dailyRevenueEl.innerText = `₹${pending.reduce((s, o) => s + o.totalAmount, 0)}`;
    pendingCountEl.innerText = pending.length;
    ordersFeed.innerHTML = '';
    
    if (pending.length === 0) {
        ordersFeed.innerHTML = '<p class="empty-state">No pending orders.</p>';
        return;
    }

    pending.forEach(order => {
        const isRoutine = order.deliveryType === 'Routine';
        const card = document.createElement('div');
        card.classList.add('order-card');
        card.innerHTML = `
            <div class="order-info">
                <h4>Order #${order._id.toString().slice(-4).toUpperCase()}</h4>
                <p class="order-meta">${order.customerName || 'Guest'} • ${isRoutine ? '📅 Routine' : '⚡ Instant'}</p>
            </div>
            <div class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</div>
        `;
        card.onclick = () => openOrderModal(order);
        ordersFeed.appendChild(card);
    });
}

async function fetchInventory() {
    inventoryFeed.innerHTML = '<p class="empty-state">Fetching catalog...</p>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/products?all=true`);
        const result = await res.json();
        if (result.success) {
            currentInventory = result.data;
            renderInventory();
        }
    } catch (e) {
        inventoryFeed.innerHTML = '<p class="empty-state">Error loading inventory.</p>';
    }
}

function renderInventory() {
    inventoryFeed.innerHTML = '';
    if (currentInventory.length === 0) {
        inventoryFeed.innerHTML = '<p class="empty-state">No products found.</p>';
        return;
    }

    currentInventory.forEach(p => {
        const card = document.createElement('div');
        card.classList.add('inventory-card');
        if (!p.isActive) card.classList.add('inactive');
        
        card.innerHTML = `
            <div class="inv-info">
                <h4>${p.name}</h4>
                <p class="inv-meta">₹${p.price} • ${p.weightOrVolume}</p>
            </div>
            <button class="toggle-switch ${p.isActive ? 'active' : ''}" onclick="toggleProductStatus('${p._id}', this, event)"></button>
        `;
        inventoryFeed.appendChild(card);
    });
}

async function toggleProductStatus(id, btn, e) {
    e.stopPropagation();
    try {
        const res = await fetch(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) fetchInventory();
    } catch (err) {
        console.error("Toggle Error:", err);
    }
}

function openOrderModal(order) {
    activeOrder = order;
    document.getElementById('modal-order-id').innerText = `Order #${order._id.toString().slice(-4).toUpperCase()}`;
    document.getElementById('modal-customer-name').innerText = order.customerName || 'Guest';
    
    const phoneEl = document.getElementById('modal-customer-phone');
    phoneEl.innerText = order.customerPhone || 'N/A';
    phoneEl.href = `tel:${order.customerPhone || ''}`;
    
    document.getElementById('modal-customer-address').innerText = order.deliveryAddress || 'N/A';
    document.getElementById('modal-delivery-badge').innerHTML = `
        <span class="type-badge ${order.deliveryType === 'Routine' ? 'type-routine' : 'type-instant'}">
            ${order.deliveryType} ${order.deliveryType === 'Routine' ? '(' + order.scheduleTime + ')' : ''}
        </span>`;
    
    document.getElementById('modal-total').innerText = `₹${order.totalAmount}`;
    document.getElementById('modal-payment').innerText = order.paymentMethod;
    
    const listEl = document.getElementById('modal-packing-list');
    listEl.innerHTML = '';
    order.items.forEach(i => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '8px 0';
        li.style.borderBottom = '1px solid #eee';
        li.innerHTML = `<span>${i.name}</span><span class="item-qty">x${i.qty}</span>`;
        listEl.appendChild(li);
    });
    orderModalOverlay.classList.add('active');
}

function closeOrderModal() { orderModalOverlay.classList.remove('active'); }

async function markOrderDispatched() {
    if (!activeOrder) return;
    
    const targetOrderId = activeOrder._id;
    
    // 1. Optimistic UI update (feels instant to the staff)
    currentOrders = currentOrders.filter(o => o._id !== targetOrderId);
    closeOrderModal();
    updateDashboard();
    showToast('Dispatching to rider... 📦');

    // 2. Actually inform the database
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, {
            method: 'PUT'
        });
        const result = await res.json();
        if (!result.success) {
            showToast('Database Error.');
            fetchOrders(); // Refresh to resync if it failed
        }
    } catch (e) {
        showToast('Network error updating database.');
        fetchOrders();
    }
}

function openAddProductModal() { document.getElementById('add-product-modal').classList.add('active'); }
function closeAddProductModal() { document.getElementById('add-product-modal').classList.remove('active'); }

async function submitNewProduct(e) {
    e.preventDefault();
    const p = {
        name: document.getElementById('new-name').value,
        price: Number(document.getElementById('new-price').value),
        weightOrVolume: document.getElementById('new-weight').value,
        category: document.getElementById('new-category').value
    };
    try {
        await fetch(`${BACKEND_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
        });
        e.target.reset();
        closeAddProductModal();
        fetchInventory();
    } catch (err) {
        console.error("Add Product Error:", err);
    }
}

function showToast(m) { const t=document.createElement('div'); t.classList.add('toast'); t.innerText=m; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(),3000); }

fetchOrders();
