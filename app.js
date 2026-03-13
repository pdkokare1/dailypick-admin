// --- Configuration ---
const BACKEND_URL = 'https://supermarket-backend-production-3a4d.up.railway.app';

// --- Local State ---
let currentOrders = [];
let currentInventory = [];
let activeOrder = null;

// --- DOM Elements (Orders) ---
const dailyRevenueEl = document.getElementById('daily-revenue');
const pendingCountEl = document.getElementById('pending-count');
const ordersFeed = document.getElementById('orders-feed');
const orderModalOverlay = document.getElementById('order-modal-overlay');

// --- DOM Elements (Inventory & Nav) ---
const inventoryFeed = document.getElementById('inventory-feed');
const addProductModal = document.getElementById('add-product-modal');
const views = {
    orders: document.getElementById('orders-view'),
    inventory: document.getElementById('inventory-view')
};
const navBtns = {
    orders: document.getElementById('nav-orders'),
    inventory: document.getElementById('nav-inventory')
};

// --- View Toggling ---
function switchView(viewName) {
    // Update Header Text
    document.getElementById('header-subtitle').innerText = viewName === 'orders' ? 'Live Operations Center' : 'Inventory Management';
    
    // Toggle active classes on sections
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

    if (viewName === 'inventory' && currentInventory.length === 0) {
        fetchInventory();
    }
}

// --- ORDERS LOGIC ---
async function fetchOrders() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/orders`);
        if (!response.ok) throw new Error('Backend route not ready');
        const result = await response.json();
        if (result.success) {
            currentOrders = result.data;
            updateDashboard();
        }
    } catch (error) {
        console.log('Loading Mock Data...');
        loadMockOrders();
    }
}

function updateDashboard() {
    const pendingOrders = currentOrders.filter(order => order.status === 'Order Placed');
    const revenue = pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    dailyRevenueEl.innerText = `₹${revenue}`;
    pendingCountEl.innerText = pendingOrders.length;

    ordersFeed.innerHTML = '';
    if (pendingOrders.length === 0) {
        ordersFeed.innerHTML = '<p class="empty-state">No pending orders. Great job!</p>';
        return;
    }

    pendingOrders.forEach(order => {
        const timeString = new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const card = document.createElement('div');
        card.classList.add('order-card');
        card.innerHTML = `
            <div class="order-info">
                <h4>Order #${(order._id || 'MOCK').toString().slice(-4).toUpperCase()}</h4>
                <p class="order-meta">${order.customerName} • ${timeString}</p>
            </div>
            <div class="order-status">${order.status}</div>
        `;
        card.onclick = () => openOrderModal(order);
        ordersFeed.appendChild(card);
    });
}

function openOrderModal(order) {
    activeOrder = order;
    document.getElementById('modal-order-id').innerText = `Order #${(order._id || 'MOCK').toString().slice(-4).toUpperCase()}`;
    document.getElementById('modal-customer-name').innerText = order.customerName;
    document.getElementById('modal-total').innerText = `₹${order.totalAmount}`;
    document.getElementById('modal-payment').innerText = order.paymentMethod;

    const listEl = document.getElementById('modal-packing-list');
    listEl.innerHTML = '';
    order.items.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('packing-item');
        li.innerHTML = `<span>${item.name}</span> <span class="item-qty">x${item.qty}</span>`;
        listEl.appendChild(li);
    });
    orderModalOverlay.classList.add('active');
}

function closeOrderModal() {
    orderModalOverlay.classList.remove('active');
    activeOrder = null;
}

function markOrderDispatched() {
    if (!activeOrder) return;
    currentOrders = currentOrders.filter(o => o._id !== activeOrder._id);
    closeOrderModal();
    updateDashboard();
    showToast('Order marked as dispatched! 📦');
}

// --- INVENTORY LOGIC ---
async function fetchInventory() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/products?all=true`);
        const result = await response.json();
        if (result.success) {
            currentInventory = result.data;
            renderInventory();
        }
    } catch (error) {
        inventoryFeed.innerHTML = '<p class="empty-state">Error loading inventory.</p>';
    }
}

function renderInventory() {
    inventoryFeed.innerHTML = '';
    if (currentInventory.length === 0) {
        inventoryFeed.innerHTML = '<p class="empty-state">Catalog is empty.</p>';
        return;
    }

    currentInventory.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('inventory-card');
        if (!product.isActive) card.classList.add('inactive');

        card.innerHTML = `
            <div class="inv-info">
                <h4>${product.name}</h4>
                <p class="inv-meta">₹${product.price} • ${product.weightOrVolume}</p>
            </div>
            <button class="toggle-switch ${product.isActive ? 'active' : ''}" onclick="toggleProductStatus('${product._id}', this, event)"></button>
        `;
        inventoryFeed.appendChild(card);
    });
}

async function toggleProductStatus(productId, btnElement, event) {
    event.stopPropagation();
    
    // Optimistic UI Update for instant feedback
    const isCurrentlyActive = btnElement.classList.contains('active');
    btnElement.classList.toggle('active');
    btnElement.parentElement.classList.toggle('inactive');

    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}/toggle`, {
            method: 'PUT'
        });
        const result = await response.json();
        if (result.success) {
            showToast(result.message);
        } else {
            throw new Error('Failed to toggle');
        }
    } catch (error) {
        // Revert UI if server fails
        btnElement.classList.toggle('active', isCurrentlyActive);
        btnElement.parentElement.classList.toggle('inactive', !isCurrentlyActive);
        showToast('Network error updating stock.');
    }
}

// Add Product Modal
function openAddProductModal() { addProductModal.classList.add('active'); }
function closeAddProductModal() { addProductModal.classList.remove('active'); }

async function submitNewProduct(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerText = 'Saving...';
    btn.disabled = true;

    const newProduct = {
        name: document.getElementById('new-name').value,
        price: Number(document.getElementById('new-price').value),
        weightOrVolume: document.getElementById('new-weight').value,
        category: document.getElementById('new-category').value
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('New product added to live catalog!');
            event.target.reset();
            closeAddProductModal();
            fetchInventory(); // Refresh the list
        }
    } catch (error) {
        showToast('Error saving product.');
    } finally {
        btn.innerText = 'Save Product';
        btn.disabled = false;
    }
}

// --- Utilities ---
function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerText = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function loadMockOrders() {
    currentOrders = [
        { _id: '1234', customerName: 'Guest (Table 4)', status: 'Order Placed', paymentMethod: 'Cash on Delivery', totalAmount: 165, items: [{ name: 'Fresh Cow Milk', qty: 2 }] }
    ];
    updateDashboard();
}

// Boot
fetchOrders();
