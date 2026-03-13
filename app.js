// --- Configuration ---
const BACKEND_URL = 'https://supermarket-backend-production-3a4d.up.railway.app';

// --- Local State ---
let currentOrders = [];
let activeOrder = null;

// --- DOM Elements ---
const dailyRevenueEl = document.getElementById('daily-revenue');
const pendingCountEl = document.getElementById('pending-count');
const ordersFeed = document.getElementById('orders-feed');

const modalOverlay = document.getElementById('order-modal-overlay');
const modalOrderId = document.getElementById('modal-order-id');
const modalCustomerName = document.getElementById('modal-customer-name');
const modalPackingList = document.getElementById('modal-packing-list');
const modalTotal = document.getElementById('modal-total');
const modalPayment = document.getElementById('modal-payment');
const toastContainer = document.getElementById('toast-container');

// --- Data Fetching & UI Update ---
async function fetchOrders() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/orders`);
        
        // If the backend route isn't built yet, this will fail and trigger the catch block
        if (!response.ok) throw new Error('Backend route not ready');
        
        const result = await response.json();
        if (result.success) {
            currentOrders = result.data;
            updateDashboard();
        }
    } catch (error) {
        console.log('Backend not wired yet. Loading UI Testing Data...');
        loadMockData();
    }
}

function updateDashboard() {
    // 1. Calculate Stats
    const pendingOrders = currentOrders.filter(order => order.status === 'Order Placed');
    const revenue = pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    dailyRevenueEl.innerText = `₹${revenue}`;
    pendingCountEl.innerText = pendingOrders.length;

    // 2. Render Order Cards
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
                <h4>Order #${(order._id).toString().slice(-4).toUpperCase()}</h4>
                <p class="order-meta">${order.customerName} • ${timeString}</p>
            </div>
            <div class="order-status">${order.status}</div>
        `;

        card.onclick = () => openOrderModal(order);
        ordersFeed.appendChild(card);
    });
}

// --- Packing List Modal Logic ---
function openOrderModal(order) {
    activeOrder = order;
    
    // Populate Headers
    modalOrderId.innerText = `Order #${(order._id).toString().slice(-4).toUpperCase()}`;
    modalCustomerName.innerText = order.customerName;
    modalTotal.innerText = `₹${order.totalAmount}`;
    modalPayment.innerText = order.paymentMethod;

    // Populate Packing List
    modalPackingList.innerHTML = '';
    order.items.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('packing-item');
        li.innerHTML = `
            <span>${item.name}</span>
            <span class="item-qty">x${item.qty}</span>
        `;
        modalPackingList.appendChild(li);
    });

    modalOverlay.classList.add('active');
}

function closeOrderModal() {
    modalOverlay.classList.remove('active');
    activeOrder = null;
}

function markOrderDispatched() {
    if (!activeOrder) return;

    // MVP Behavior: Just remove it from the local array to simulate dispatch
    currentOrders = currentOrders.filter(o => o._id !== activeOrder._id);
    
    closeOrderModal();
    updateDashboard();
    showToast('Order marked as dispatched! 📦');
}

// --- Utility Functions ---
function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerText = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function loadMockData() {
    currentOrders = [
        {
            _id: '64a7f9b8e4b0a1c2d3e4f5a1',
            customerName: 'Guest Customer (Table 4)',
            status: 'Order Placed',
            paymentMethod: 'Cash on Delivery',
            totalAmount: 165,
            createdAt: new Date().toISOString(),
            items: [
                { name: 'Fresh Cow Milk', qty: 2, price: 60 },
                { name: 'Whole Wheat Bread', qty: 1, price: 45 }
            ]
        },
        {
            _id: '64a7f9b8e4b0a1c2d3e4f5a2',
            customerName: 'Guest Customer (Pickup)',
            status: 'Order Placed',
            paymentMethod: 'Cash on Delivery',
            totalAmount: 340,
            createdAt: new Date(Date.now() - 15 * 60000).toISOString(), // 15 mins ago
            items: [
                { name: 'Farm Fresh Eggs', qty: 1, price: 80 },
                { name: 'Organic Bananas', qty: 2, price: 50 },
                { name: 'Toor Dal', qty: 1, price: 160 }
            ]
        }
    ];
    updateDashboard();
}

// --- Boot Sequence ---
fetchOrders();
