function printReceipt() {
    if (!activeOrder) return;
    const pContainer = document.getElementById('print-receipt-container');
    
    const itemsHtml = activeOrder.items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${i.qty}x ${i.name.substring(0, 15)}</span>
            <span>${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');

    pContainer.innerHTML = `
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin:0; font-size:18px;">DAILYPICK</h2>
            <p style="margin:0;">Order #${activeOrder._id.toString().slice(-4).toUpperCase()}</p>
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
            TOTAL: ₹${activeOrder.totalAmount.toFixed(2)}<br>
            PAYMENT: ${activeOrder.paymentMethod}
        </div>
    `;
    
    window.print();
}

function sendWhatsAppReceipt() {
    if (!activeOrder) return;
    const phone = activeOrder.customerPhone;
    
    if (!phone || phone.length < 10) {
        return showToast("No valid phone number for this order.");
    }

    const itemsText = activeOrder.items.map(i => `${i.qty}x ${i.name} - ₹${(i.price * i.qty).toFixed(2)}`).join('%0A');
    const text = `*DailyPick Receipt*%0AOrder ID: #${activeOrder._id.slice(-4).toUpperCase()}%0A%0A*Items:*%0A${itemsText}%0A%0A*Total: ₹${activeOrder.totalAmount.toFixed(2)}*%0APayment: ${activeOrder.paymentMethod}%0A%0AThank you for shopping with us!`;

    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
}

async function cancelOrder() {
    if (!activeOrder) return;
    const confirmCancel = confirm("Are you sure you want to cancel this order? Stock will be refunded automatically.");
    if (!confirmCancel) return;

    const targetOrderId = activeOrder._id;
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
    }
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
    } catch (e) { 
        console.error("Order Fetch Error:", e); 
    }
}

function setOrderTab(tab) {
    currentOrderTab = tab;
    document.getElementById('tab-All').classList.remove('active');
    document.getElementById('tab-Instant').classList.remove('active');
    document.getElementById('tab-Routine').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    updateDashboard();
}

function toggleOrderLayout(layout) {
    currentOrderLayout = layout;
    document.getElementById('layout-list').classList.remove('active');
    document.getElementById('layout-kanban').classList.remove('active');
    document.getElementById(`layout-${layout}`).classList.add('active');
    
    if (layout === 'kanban') {
        ordersFeed.classList.add('hidden');
        ordersKanban.classList.remove('hidden');
    } else {
        ordersFeed.classList.remove('hidden');
        ordersKanban.classList.add('hidden');
    }
    updateDashboard();
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
            if(o) o.status = 'Dispatched';
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
    
    const order = currentOrders.find(o => o._id === orderId);
    if(order) order.status = newStatus;
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
    }
}

function updateDashboard() {
    const trulyPending = currentOrders.filter(o => o.status === 'Order Placed' || o.status === 'Packing');
    dailyRevenueEl.innerText = `₹${trulyPending.reduce((s, o) => s + o.totalAmount, 0)}`;
    pendingCountEl.innerText = trulyPending.length;
    
    let displayOrders = currentOrders.filter(o => o.status !== 'Cancelled' && o.status !== 'Completed');
    if (currentOrderTab === 'Instant') displayOrders = displayOrders.filter(o => o.deliveryType !== 'Routine');
    if (currentOrderTab === 'Routine') displayOrders = displayOrders.filter(o => o.deliveryType === 'Routine');

    if (currentOrderLayout === 'list') {
        renderListView(displayOrders.filter(o => o.status === 'Order Placed' || o.status === 'Packing'));
    } else {
        renderKanbanView(displayOrders);
    }
    
    updateBulkDispatchUI();
    if(document.getElementById('overview-view').classList.contains('active')) renderOverview(); 
}

function renderListView(orders) {
    ordersFeed.innerHTML = '';
    if (orders.length === 0) { 
        ordersFeed.innerHTML = `<p class="empty-state">No active orders in ${currentOrderTab}.</p>`; 
        return; 
    }
    
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

        card.innerHTML = `
            <div class="order-info">
                <h4>Order #${order._id.toString().slice(-4).toUpperCase()}</h4>
                <p class="order-meta">${order.customerName || 'Guest'} • ${isRoutine ? '📅 Routine' : '⚡ Instant'} ${isPacking ? '• 📦 Packing' : ''}</p>
            </div>
            <div class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</div>
        `;
        card.onclick = () => openOrderModal(order);
        
        cardWrapper.appendChild(checkbox); 
        cardWrapper.appendChild(card);
        ordersFeed.appendChild(cardWrapper);
    });
}

function renderKanbanView(orders) {
    const colNew = document.getElementById('kb-col-new');
    const colPack = document.getElementById('kb-col-pack');
    const colDisp = document.getElementById('kb-col-disp');

    colNew.innerHTML = ''; colPack.innerHTML = ''; colDisp.innerHTML = '';
    let countNew = 0, countPack = 0, countDisp = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

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

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <h4>#${order._id.toString().slice(-4).toUpperCase()}</h4>
                <span class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</span>
            </div>
            <p style="margin-bottom: 4px; font-weight: 600; color: var(--text-main);">${order.customerName || 'Guest'}</p>
            <p>${itemsPreview}</p>
            ${actionHtml}
        `;

        if (order.status === 'Order Placed') colNew.appendChild(card);
        else if (order.status === 'Packing') colPack.appendChild(card);
        else if (order.status === 'Dispatched') colDisp.appendChild(card);
    });

    document.getElementById('kb-count-new').innerText = countNew;
    document.getElementById('kb-count-pack').innerText = countPack;
    document.getElementById('kb-count-disp').innerText = countDisp;
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
        </span>
        <span class="order-status" style="margin-left: 8px;">${order.status}</span>
    `;
    
    document.getElementById('modal-total').innerText = `₹${order.totalAmount}`;
    document.getElementById('modal-payment').innerText = order.paymentMethod;
    
    const listEl = document.getElementById('modal-packing-list'); 
    listEl.innerHTML = '';
    
    order.items.forEach(i => {
        const variantText = i.selectedVariant ? ` (${i.selectedVariant})` : '';
        const li = document.createElement('li'); 
        li.style.display = 'flex'; 
        li.style.justifyContent = 'space-between'; 
        li.style.padding = '8px 0'; 
        li.style.borderBottom = '1px solid #eee';
        li.innerHTML = `<span>${i.name}${variantText}</span><span class="item-qty">x${i.qty}</span>`;
        listEl.appendChild(li);
    });
    
    orderModalOverlay.classList.add('active');
}

function closeOrderModal() { 
    orderModalOverlay.classList.remove('active'); 
}

async function markOrderDispatched() {
    if (!activeOrder) return; 
    
    const targetOrderId = activeOrder._id;
    
    const localOrder = currentOrders.find(o => o._id === targetOrderId);
    if(localOrder) localOrder.status = 'Dispatched';
    
    selectedOrders.delete(targetOrderId);
    closeOrderModal(); 
    updateDashboard(); 
    showToast('Dispatching to rider... 📦');
    
    try {
        await fetch(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, { method: 'PUT' });
    } catch (e) { 
        showToast('Network error updating database.'); 
        fetchOrders(); 
    }
}
