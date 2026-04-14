/* js/views/orderView.js */

window.renderListView = function(orders) {
    const ordersFeed = document.getElementById('orders-list-view');
    if(!ordersFeed) return;
    
    ordersFeed.innerHTML = '';
    if (orders.length === 0) { 
        ordersFeed.innerHTML = `<p class="empty-state">No active orders in ${typeof currentOrderTab !== 'undefined' ? currentOrderTab : 'All'} / ${typeof currentOrderDateFilter !== 'undefined' ? currentOrderDateFilter : 'All'}.</p>`; 
        return; 
    }
    
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
        checkbox.checked = typeof selectedOrders !== 'undefined' && selectedOrders.has(order._id);
        checkbox.onclick = (e) => {
            if (typeof toggleOrderSelection === 'function') toggleOrderSelection(order._id, e);
        };

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
        card.onclick = () => {
            if (typeof openOrderModal === 'function') openOrderModal(order);
        };
        
        cardWrapper.appendChild(checkbox); 
        cardWrapper.appendChild(card);
        fragment.appendChild(cardWrapper);
    });

    ordersFeed.appendChild(fragment);
};

window.renderKanbanView = function(orders) {
    const colNew = document.getElementById('kb-col-new');
    const colPack = document.getElementById('kb-col-pack');
    const colDisp = document.getElementById('kb-col-disp');

    if(!colNew || !colPack || !colDisp) return;

    colNew.innerHTML = ''; colPack.innerHTML = ''; colDisp.innerHTML = '';
    let countNew = 0, countPack = 0, countDisp = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

    const fragNew = document.createDocumentFragment();
    const fragPack = document.createDocumentFragment();
    const fragDisp = document.createDocumentFragment();

    orders.forEach(order => {
        if(order.status === 'Dispatched' && new Date(order.createdAt) < today) return; 

        const isRoutine = order.deliveryType === 'Routine';
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.onclick = () => {
            if (typeof openOrderModal === 'function') openOrderModal(order);
        };

        let actionHtml = '';
        if (order.status === 'Order Placed') {
            actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-pack" onclick="if(typeof updateOrderStatus === 'function') updateOrderStatus('${order._id}', 'Packing', event)">Start Packing</button></div>`;
            countNew++;
        } else if (order.status === 'Packing') {
            actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-dispatch" onclick="if(typeof updateOrderStatus === 'function') updateOrderStatus('${order._id}', 'Dispatched', event)">Dispatch Now</button></div>`;
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
};

window.openOrderModal = function(order) {
    if (typeof activeOrder !== 'undefined') window.activeOrder = order;
    
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
            removeBtnHtml = `<button onclick="if(typeof openPartialRefundModal === 'function') openPartialRefundModal('${i.productId}', '${i.variantId}', '${i.name.replace(/'/g, "\\'")}', ${i.qty}, ${i.price})" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 12px;" title="Remove / Refund Item"><i data-lucide="minus-circle" class="icon-sm"></i></button>`;
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
};

window.closeOrderModal = function() { 
    const orderModalOverlay = document.getElementById('order-modal-overlay');
    if(orderModalOverlay) orderModalOverlay.classList.remove('active'); 
};
