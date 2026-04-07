/* js/orders.js */

let currentOrderDateFilter = 'All'; 
let currentOrderTab = 'All'; 
let isProcessingOrderAction = false; 
let ordersPage = 1;
let globalPendingCount = 0;
let globalPendingRevenue = 0;
let currentOrderLayout = 'list'; 
let selectedOrders = new Set();  

function setOrderDateFilter(range) {
    currentOrderDateFilter = range;
    ['All', 'Today', 'Yesterday', '7Days'].forEach(id => {
        const el = document.getElementById(`date-${id}`);
        if(el) el.classList.remove('active');
    });
    const activeEl = document.getElementById(`date-${range}`);
    if(activeEl) activeEl.classList.add('active');
    
    ordersPage = 1;
    fetchOrders();
}

function setOrderTab(tab) {
    currentOrderTab = tab;
    document.getElementById('tab-All').classList.remove('active');
    document.getElementById('tab-Instant').classList.remove('active');
    document.getElementById('tab-Routine').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    ordersPage = 1;
    fetchOrders();
}

function printReceipt() {
    if (!activeOrder) return;
    const pContainer = document.getElementById('print-receipt-container');
    
    let sName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
    let sAddress = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "";
    let sGstin = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.gstin) ? `<p style="margin:0; font-size:10px;">GSTIN: ${globalStoreSettings.gstin}</p>` : "";
    let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;

    const itemsHtml = activeOrder.items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${i.qty}x ${i.name.substring(0, 15)}</span>
            <span>${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');

    let extraTotalsHtml = '';
    if (activeOrder.taxAmount !== undefined || activeOrder.discountAmount !== undefined || activeOrder.pointsRedeemed !== undefined) {
        const tax = activeOrder.taxAmount || 0;
        const discount = activeOrder.discountAmount || 0;
        const pts = activeOrder.pointsRedeemed || 0;
        
        const subtotal = activeOrder.totalAmount - tax + discount + pts; 
        
        extraTotalsHtml += `<div style="font-size:12px; font-weight:normal;">Subtotal: ₹${subtotal.toFixed(2)}</div>`;
        if (discount > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal; color:#10b981;">Discount: -₹${discount.toFixed(2)}</div>`;
        if (pts > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal; color:#8b5cf6;">Loyalty Redeemed: -₹${pts.toFixed(2)}</div>`;
        if (tax > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal;">Tax (GST): ₹${tax.toFixed(2)}</div>`;
        extraTotalsHtml += `<hr style="border: 0; border-top: 1px dashed black; margin: 4px 0;">`;
    }

    const earnedPoints = Math.floor(activeOrder.totalAmount / loyaltyConv);
    const pointsHtml = `<div style="text-align: center; font-size: 13px; font-weight: bold; color: #16a34a; margin-top: 12px; padding-top: 8px; border-top: 1px dashed black;">⭐ You earned ${earnedPoints} Points on this order!</div>`;

    const orderDisplayId = activeOrder.orderNumber || activeOrder._id.toString().slice(-4).toUpperCase();

    pContainer.innerHTML = `
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin:0; font-size:18px;">${sName}</h2>
            ${sAddress ? `<p style="margin:0; font-size:12px;">${sAddress}</p>` : ''}
            ${sGstin}
            <p style="margin:0;">Order #${orderDisplayId}</p>
            <p style="margin:0;">Date: ${new Date(activeOrder.createdAt).toLocaleString()}</p>
        </div>
        <div style="border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <p style="margin:0;"><strong>Customer:</strong> ${activeOrder.customerName || 'Guest'}</p>
            <p style="margin:0;"><strong>Phone:</strong> ${activeOrder.customerPhone || 'N/A'}</p>
            <p style="margin:0;"><strong>Route:</strong> ${activeOrder.deliveryAddress || 'N/A'}</p>
            <p style="margin:0;"><strong>Type:</strong> ${activeOrder.deliveryType}</p>
        </div>
        <div style="border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <strong>ITEMS:</strong><br>
            ${itemsHtml}
        </div>
        <div style="text-align: right; font-weight: bold; font-size: 14px;">
            ${extraTotalsHtml}
            TOTAL: ₹${activeOrder.totalAmount.toFixed(2)}<br>
            PAYMENT: ${activeOrder.paymentMethod}
        </div>
        ${pointsHtml}
    `;
    
    window.print();
}

function sendWhatsAppReceipt() {
    if (!activeOrder) return;
    const phone = activeOrder.customerPhone;
    
    if (!phone || phone.length < 10) {
        return showToast("No valid phone number for this order.");
    }

    let sName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DailyPick";
    let sFooter = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.receiptFooterMessage) ? globalStoreSettings.receiptFooterMessage : "Thank you for shopping with us!";
    let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;

    const earnedPoints = Math.floor(activeOrder.totalAmount / loyaltyConv);
    const ptsText = (activeOrder.pointsRedeemed && activeOrder.pointsRedeemed > 0) ? `%0A*Pts Redeemed: -₹${activeOrder.pointsRedeemed.toFixed(2)}*` : '';
    
    const itemsText = activeOrder.items.map(i => `${i.qty}x ${i.name} - ₹${(i.price * i.qty).toFixed(2)}`).join('%0A');
    const orderDisplayId = activeOrder.orderNumber || activeOrder._id.toString().slice(-4).toUpperCase();
    
    const text = `*${sName} Receipt*%0AOrder ID: #${orderDisplayId}%0A%0A*Items:*%0A${itemsText}%0A%0A*Total: ₹${activeOrder.totalAmount.toFixed(2)}*${ptsText}%0APayment: ${activeOrder.paymentMethod}%0A%0A⭐ You earned ${earnedPoints} Points!%0A%0A${sFooter}`;

    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
}

async function cancelOrder() {
    if (isProcessingOrderAction) return;
    if (!activeOrder) return;
    const confirmCancel = confirm("Are you sure you want to cancel this order? Stock will be refunded automatically.");
    if (!confirmCancel) return;

    isProcessingOrderAction = true;
    const targetOrderId = activeOrder._id;

    if (activeOrder.status === 'Order Placed' || activeOrder.status === 'Packing') {
        globalPendingCount = Math.max(0, globalPendingCount - 1);
        globalPendingRevenue = Math.max(0, globalPendingRevenue - activeOrder.totalAmount);
    }

    currentOrders = currentOrders.filter(o => o._id !== targetOrderId);
    selectedOrders.delete(targetOrderId);
    
    closeOrderModal(); 
    updateDashboard(); 
    showToast('Cancelling order & refunding stock...');

    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/${targetOrderId}/cancel`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: "Admin Cancelled" })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast('Order Cancelled successfully.');
            if (currentInventory.length > 0) { inventoryPage = 1; fetchInventory(); }
        } else {
            showToast('Database Error during cancellation.');
            fetchOrders();
        }
    } catch (e) {
        showToast('Network error.');
        fetchOrders();
    } finally {
        isProcessingOrderAction = false;
    }
}

let ordersAbortController = null;

async function fetchOrders() {
    const feed = document.getElementById('orders-list-view');
    if (ordersPage === 1 && feed) {
        feed.innerHTML = '<p class="empty-state">Loading orders...</p>';
    }

    const loadBtn = document.getElementById('load-more-orders-btn');
    if (loadBtn) { loadBtn.innerText = 'Loading...'; loadBtn.disabled = true; }

    if (ordersAbortController) {
        ordersAbortController.abort();
    }
    ordersAbortController = new AbortController();
    const signal = ordersAbortController.signal;

    try {
        let url = `${BACKEND_URL}/api/orders?page=${ordersPage}&limit=30`;
        if (currentOrderTab !== 'All') url += `&tab=${currentOrderTab}`;
        if (currentOrderDateFilter !== 'All') url += `&dateFilter=${currentOrderDateFilter}`;

        const res = await fetch(url, { signal });
        const result = await res.json();
        
        if (result.success) {
            if (ordersPage === 1) {
                currentOrders = result.data;
            } else {
                currentOrders = [...currentOrders, ...result.data];
            }

            if (result.stats) {
                globalPendingCount = result.stats.pendingCount;
                globalPendingRevenue = result.stats.pendingRevenue;
            }

            updateDashboard(result.data.length < 30);
            
            if (typeof connectAdminLiveStream === 'function' && !window.adminStreamConnected) {
                connectAdminLiveStream();
                window.adminStreamConnected = true;
            }
        }
    } catch (e) { 
        if (e.name === 'AbortError') {
            console.log('Previous order fetch aborted successfully to prevent UI glitches.');
            return; 
        }
        console.error("Order Fetch Error:", e); 
    } finally {
        if (loadBtn) { loadBtn.innerText = 'Load More Orders'; loadBtn.disabled = false; }
    }
}

function loadMoreOrders() {
    ordersPage++;
    fetchOrders();
}

function toggleOrderLayout(layout) {
    currentOrderLayout = layout;
    document.getElementById('layout-list').classList.remove('active');
    document.getElementById('layout-kanban').classList.remove('active');
    document.getElementById(`layout-${layout}`).classList.add('active');
    
    const ordersFeed = document.getElementById('orders-list-view');
    const ordersKanban = document.getElementById('orders-kanban-view');

    if (layout === 'kanban') {
        if(ordersFeed) ordersFeed.classList.add('hidden');
        if(ordersKanban) ordersKanban.classList.remove('hidden');
    } else {
        if(ordersFeed) ordersFeed.classList.remove('hidden');
        if(ordersKanban) ordersKanban.classList.add('hidden');
    }
    updateDashboard(document.getElementById('load-more-orders-btn')?.classList.contains('hidden'));
}

function toggleOrderSelection(orderId, event) {
    event.stopPropagation();
    if (selectedOrders.has(orderId)) {
        selectedOrders.delete(orderId);
    } else {
        selectedOrders.add(orderId);
    }
    updateBulkDispatchUI();
}

function updateBulkDispatchUI() {
    const btn = document.getElementById('bulk-dispatch-btn');
    if (selectedOrders.size > 0) {
        btn.innerText = `Dispatch Selected (${selectedOrders.size})`;
        btn.classList.add('visible');
    } else { 
        btn.classList.remove('visible'); 
    }
}

async function bulkDispatchOrders() {
    if (selectedOrders.size === 0) return;
    
    const btn = document.getElementById('bulk-dispatch-btn');
    btn.innerText = 'Dispatching...'; 
    btn.disabled = true;
    
    const idsToDispatch = Array.from(selectedOrders);
    
    try {
        await Promise.all(idsToDispatch.map(id => fetch(`${BACKEND_URL}/api/orders/${id}/dispatch`, { method: 'PUT' })));
        showToast(`Dispatched ${idsToDispatch.length} orders! 📦`);
        
        idsToDispatch.forEach(id => {
            const o = currentOrders.find(ord => ord._id === id);
            if(o && (o.status === 'Order Placed' || o.status === 'Packing')) {
                globalPendingCount = Math.max(0, globalPendingCount - 1);
                globalPendingRevenue = Math.max(0, globalPendingRevenue - o.totalAmount);
                o.status = 'Dispatched';
            }
        });
        
        selectedOrders.clear();
        updateDashboard();
    } catch (err) { 
        showToast('Error during bulk dispatch.'); 
    } finally { 
        btn.disabled = false; 
        updateBulkDispatchUI(); 
    }
}

async function updateOrderStatus(orderId, newStatus, event) {
    if (event) event.stopPropagation();
    if (isProcessingOrderAction) return;
    
    isProcessingOrderAction = true;
    const order = currentOrders.find(o => o._id === orderId);
    if(order) {
        if ((order.status === 'Order Placed' || order.status === 'Packing') && (newStatus === 'Dispatched' || newStatus === 'Completed' || newStatus === 'Cancelled')) {
            globalPendingCount = Math.max(0, globalPendingCount - 1);
            globalPendingRevenue = Math.max(0, globalPendingRevenue - order.totalAmount);
        }
        order.status = newStatus;
    }
    updateDashboard();
    showToast(`Order marked as ${newStatus}`);

    try {
        const endpoint = newStatus === 'Dispatched' ? 'dispatch' : 'status';
        const body = newStatus === 'Dispatched' ? null : JSON.stringify({ status: newStatus });
        
        await fetch(`${BACKEND_URL}/api/orders/${orderId}/${endpoint}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
    } catch(e) {
        showToast('Network error, order may not have synced.');
    } finally {
        isProcessingOrderAction = false;
    }
}

function updateDashboard(isLastPage = true) {
    const dailyRevenueEl = document.getElementById('daily-revenue');
    const pendingCountEl = document.getElementById('pending-count');
    
    if (dailyRevenueEl) dailyRevenueEl.innerText = `₹${globalPendingRevenue}`;
    if (pendingCountEl) pendingCountEl.innerText = globalPendingCount;
    
    let displayOrders = currentOrders.filter(o => o.status !== 'Cancelled' && o.status !== 'Completed');

    if (currentOrderLayout === 'list') {
        renderListView(displayOrders.filter(o => o.status === 'Order Placed' || o.status === 'Packing'));
        
        let loadBtn = document.getElementById('load-more-orders-btn');
        const feed = document.getElementById('orders-list-view');
        
        if (!loadBtn && feed) {
            loadBtn = document.createElement('button');
            loadBtn.id = 'load-more-orders-btn';
            loadBtn.className = 'load-more-btn';
            loadBtn.onclick = loadMoreOrders;
            loadBtn.innerText = 'Load More Orders';
            feed.parentNode.insertBefore(loadBtn, feed.nextSibling);
        }
        if (loadBtn) {
            if (isLastPage) loadBtn.classList.add('hidden');
            else loadBtn.classList.remove('hidden');
        }
    } else {
        renderKanbanView(displayOrders);
        const loadBtn = document.getElementById('load-more-orders-btn');
        if(loadBtn) loadBtn.classList.add('hidden');
    }
    
    updateBulkDispatchUI();
    
    const overviewView = document.getElementById('overview-view');
    if (overviewView && overviewView.classList.contains('active') && typeof renderOverview === 'function') {
        renderOverview(); 
    }
}

function renderListView(orders) {
    const ordersFeed = document.getElementById('orders-list-view');
    if(!ordersFeed) return;
    
    ordersFeed.innerHTML = '';
    if (orders.length === 0) { 
        ordersFeed.innerHTML = `<p class="empty-state">No active orders in ${currentOrderTab} / ${currentOrderDateFilter}.</p>`; 
        return; 
    }
    
    // OPTIMIZED: Fragment batching to prevent DOM layout thrashing
    const fragment = document.createDocumentFragment();

    orders.forEach(order => {
        const isRoutine = order.deliveryType === 'Routine';
        const isPacking = order.status === 'Packing';
        const cardWrapper = document.createElement('div');
        cardWrapper.style.display = 'flex'; 
        cardWrapper.style.alignItems = 'center'; 
        cardWrapper.style.gap = '12px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; 
        checkbox.className = 'order-checkbox';
        checkbox.checked = selectedOrders.has(order._id);
        checkbox.onclick = (e) => toggleOrderSelection(order._id, e);

        const card = document.createElement('div'); 
        card.classList.add('order-card');
        card.style.flex = '1';
        if(isPacking) card.style.borderLeft = '4px solid #4338CA';

        const orderDisplayId = order.orderNumber || order._id.toString().slice(-4).toUpperCase();

        card.innerHTML = `
            <div class="order-info">
                <h4>Order #${orderDisplayId}</h4>
                <p class="order-meta">${order.customerName || 'Guest'} • ${isRoutine ? '📅 Routine' : '⚡ Instant'} ${isPacking ? '• 📦 Packing' : ''}</p>
            </div>
            <div class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</div>
        `;
        card.onclick = () => openOrderModal(order);
        
        cardWrapper.appendChild(checkbox); 
        cardWrapper.appendChild(card);
        fragment.appendChild(cardWrapper);
    });

    ordersFeed.appendChild(fragment);
}

function renderKanbanView(orders) {
    const colNew = document.getElementById('kb-col-new');
    const colPack = document.getElementById('kb-col-pack');
    const colDisp = document.getElementById('kb-col-disp');

    if(!colNew || !colPack || !colDisp) return;

    colNew.innerHTML = ''; colPack.innerHTML = ''; colDisp.innerHTML = '';
    let countNew = 0, countPack = 0, countDisp = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

    // OPTIMIZED: Using fragments for each Kanban column to improve rendering speed
    const fragNew = document.createDocumentFragment();
    const fragPack = document.createDocumentFragment();
    const fragDisp = document.createDocumentFragment();

    orders.forEach(order => {
        if(order.status === 'Dispatched' && new Date(order.createdAt) < today) return; 

        const isRoutine = order.deliveryType === 'Routine';
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.onclick = () => openOrderModal(order);

        let actionHtml = '';
        if (order.status === 'Order Placed') {
            actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-pack" onclick="updateOrderStatus('${order._id}', 'Packing', event)">Start Packing</button></div>`;
            countNew++;
        } else if (order.status === 'Packing') {
            actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-dispatch" onclick="updateOrderStatus('${order._id}', 'Dispatched', event)">Dispatch Now</button></div>`;
            countPack++;
        } else if (order.status === 'Dispatched') {
            actionHtml = `<span style="font-size: 11px; font-weight: 700; color: #16A34A;">🚚 Out for Delivery</span>`;
            countDisp++;
        }

        const itemsPreview = order.items.map(i => `${i.qty}x ${i.name}`).join(', ').substring(0, 30) + '...';
        const orderDisplayId = order.orderNumber || order._id.toString().slice(-4).toUpperCase();

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <h4>#${orderDisplayId}</h4>
                <span class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</span>
            </div>
            <p style="margin-bottom: 4px; font-weight: 600; color: var(--text-main);">${order.customerName || 'Guest'}</p>
            <p>${itemsPreview}</p>
            ${actionHtml}
        `;

        if (order.status === 'Order Placed') fragNew.appendChild(card);
        else if (order.status === 'Packing') fragPack.appendChild(card);
        else if (order.status === 'Dispatched') fragDisp.appendChild(card);
    });

    colNew.appendChild(fragNew);
    colPack.appendChild(fragPack);
    colDisp.appendChild(fragDisp);

    document.getElementById('kb-count-new').innerText = countNew;
    document.getElementById('kb-count-pack').innerText = countPack;
    document.getElementById('kb-count-disp').innerText = countDisp;
}

function openOrderModal(order) {
    activeOrder = order;
    const orderDisplayId = order.orderNumber || order._id.toString().slice(-4).toUpperCase();
    document.getElementById('modal-order-id').innerText = `Order #${orderDisplayId}`;
    document.getElementById('modal-customer-name').innerText = order.customerName || 'Guest';
    
    const phoneEl = document.getElementById('modal-customer-phone');
    phoneEl.innerText = order.customerPhone || 'N/A'; 
    phoneEl.href = `tel:${order.customerPhone || ''}`;
    
    document.getElementById('modal-customer-address').innerText = order.deliveryAddress || 'N/A';
    
    const driverDisplayEl = document.getElementById('modal-driver-display');
    if (driverDisplayEl) {
        if (order.deliveryDriverName && order.deliveryDriverName !== 'Unassigned') {
            driverDisplayEl.innerHTML = `<p style="margin-top: 8px; font-size: 13px; color: #10b981; font-weight: 600;"><i data-lucide="truck" class="icon-sm"></i> Assigned to: ${order.deliveryDriverName} ${order.driverPhone ? `(${order.driverPhone})` : ''}</p>`;
        } else {
            driverDisplayEl.innerHTML = `<p style="margin-top: 8px; font-size: 13px; color: #f59e0b; font-weight: 600;"><i data-lucide="truck" class="icon-sm"></i> Driver: Unassigned</p>`;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    document.getElementById('modal-delivery-badge').innerHTML = `
        <span class="type-badge ${order.deliveryType === 'Routine' ? 'type-routine' : 'type-instant'}">
            ${order.deliveryType} ${order.deliveryType === 'Routine' ? '(' + order.scheduleTime + ')' : ''}
        </span>
        <span class="order-status" style="margin-left: 8px;">${order.status}</span>
    `;
    
    document.getElementById('modal-total').innerText = `₹${order.totalAmount}`;
    document.getElementById('modal-payment').innerText = order.paymentMethod;
    
    const listEl = document.getElementById('modal-packing-list'); 
    listEl.innerHTML = '';
    
    const fragment = document.createDocumentFragment();

    order.items.forEach((i, index) => {
        const variantText = i.selectedVariant ? ` (${i.selectedVariant})` : '';
        const li = document.createElement('li'); 
        li.style.display = 'flex'; 
        li.style.justifyContent = 'space-between'; 
        li.style.alignItems = 'center';
        li.style.padding = '8px 0'; 
        li.style.borderBottom = '1px solid #eee';
        
        let removeBtnHtml = '';
        if (order.status !== 'Completed' && order.status !== 'Cancelled') {
            removeBtnHtml = `<button onclick="openPartialRefundModal('${i.productId}', '${i.variantId}', '${i.name}', ${i.qty}, ${i.price})" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 12px;" title="Remove / Refund Item"><i data-lucide="minus-circle" class="icon-sm"></i></button>`;
        }

        li.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span>${i.name}${variantText}</span>
                <span style="font-size: 11px; color: var(--text-muted);">₹${i.price} each</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="item-qty">x${i.qty}</span>
                ${removeBtnHtml}
            </div>
        `;
        fragment.appendChild(li);
    });

    listEl.appendChild(fragment);

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    const orderModalOverlay = document.getElementById('order-modal-overlay');
    if(orderModalOverlay) orderModalOverlay.classList.add('active');
}

function closeOrderModal() { 
    const orderModalOverlay = document.getElementById('order-modal-overlay');
    if(orderModalOverlay) orderModalOverlay.classList.remove('active'); 
}

async function markOrderDispatched() {
    if (isProcessingOrderAction) return;
    if (!activeOrder) return; 
    
    isProcessingOrderAction = true;
    const targetOrderId = activeOrder._id;
    
    const localOrder = currentOrders.find(o => o._id === targetOrderId);
    if(localOrder) {
        if (localOrder.status === 'Order Placed' || localOrder.status === 'Packing') {
            globalPendingCount = Math.max(0, globalPendingCount - 1);
            globalPendingRevenue = Math.max(0, globalPendingRevenue - localOrder.totalAmount);
        }
        localOrder.status = 'Dispatched';
    }
    
    selectedOrders.delete(targetOrderId);
    closeOrderModal(); 
    updateDashboard(); 
    showToast('Dispatching to rider... 📦');
    
    try {
        await adminFetchWithAuth(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, { method: 'PUT' });
    } catch (e) { 
        showToast('Network error updating database.'); 
        fetchOrders(); 
    } finally {
        isProcessingOrderAction = false;
    }
}

function openAssignDriverModal() {
    if (!activeOrder) return showToast('No order selected.');
    document.getElementById('assign-driver-name').value = activeOrder.deliveryDriverName !== 'Unassigned' ? activeOrder.deliveryDriverName : '';
    document.getElementById('assign-driver-phone').value = activeOrder.driverPhone || '';
    document.getElementById('assign-driver-modal').classList.add('active');
}

function closeAssignDriverModal() {
    document.getElementById('assign-driver-modal').classList.remove('active');
}

async function submitAssignDriver(event) {
    event.preventDefault();
    if (!activeOrder) return;
    
    const driverName = document.getElementById('assign-driver-name').value.trim();
    const driverPhone = document.getElementById('assign-driver-phone').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    
    btn.innerText = 'Assigning...';
    btn.disabled = true;

    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/orders/${activeOrder._id}/driver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverName, driverPhone })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast('Driver assigned successfully!');
            const localOrder = currentOrders.find(o => o._id === activeOrder._id);
            if (localOrder) {
                localOrder.deliveryDriverName = driverName;
                localOrder.driverPhone = driverPhone;
            }
            closeAssignDriverModal();
            openOrderModal(activeOrder); 
        } else {
            showToast(result.message || 'Error assigning driver.');
        }
    } catch (e) {
        showToast('Network error.');
    } finally {
        btn.innerText = 'Assign Driver';
        btn.disabled = false;
    }
}

let currentRefundItem = null;

function openPartialRefundModal(productId, variantId, name, maxQty, price) {
    currentRefundItem = { productId, variantId, price };
    document.getElementById('refund-item-name').innerText = name;
    document.getElementById('refund-qty').value = 1;
    document.getElementById('refund-qty').max = maxQty;
    document.getElementById('partial-refund-modal').classList.add('active');
}

function closePartialRefundModal() {
    currentRefundItem = null;
    document.getElementById('partial-refund-modal').classList.remove('active');
}

async function submitPartialRefund() {
    if (!activeOrder || !currentRefundItem) return;
    
    const qtyToRefund = parseInt(document.getElementById('refund-qty').value);
    if (isNaN(qtyToRefund) || qtyToRefund < 1) return showToast("Invalid quantity.");
    
    const confirmRefund = confirm(`Are you sure you want to remove ${qtyToRefund} unit(s) of this item? Stock will be returned to inventory.`);
    if (!confirmRefund) return;

    const refundValue = qtyToRefund * currentRefundItem.price;
    const newTotalAmount = activeOrder.totalAmount - refundValue;

    closePartialRefundModal();
    showToast('Processing partial refund...');

    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/orders/${activeOrder._id}/partial-refund`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: currentRefundItem.productId,
                variantId: currentRefundItem.variantId,
                qtyToRefund: qtyToRefund,
                newTotalAmount: newTotalAmount
            })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast('Item refunded successfully!');
            const localOrder = currentOrders.find(o => o._id === activeOrder._id);
            if (localOrder) {
                localOrder.totalAmount = newTotalAmount;
                const itemToUpdate = localOrder.items.find(i => i.productId === currentRefundItem.productId && i.variantId === currentRefundItem.variantId);
                if (itemToUpdate) {
                    itemToUpdate.qty -= qtyToRefund;
                    if (itemToUpdate.qty <= 0) {
                        localOrder.items = localOrder.items.filter(i => i !== itemToUpdate);
                    }
                }
            }
            openOrderModal(activeOrder); 
            if (typeof fetchInventory === 'function') fetchInventory(); 
        } else {
            showToast(result.message || 'Error processing refund.');
        }
    } catch (e) {
        showToast('Network error.');
    }
}
