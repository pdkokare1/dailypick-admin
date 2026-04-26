/* js/views/orderView.js */

window.renderListView = function(orders) {
    const ordersFeed = document.getElementById('orders-list-view');
    if(!ordersFeed) return;
    
    ordersFeed.innerHTML = '';
    if (orders.length === 0) { 
        ordersFeed.innerHTML = `<p class="empty-state">No active orders in ${typeof currentOrderTab !== 'undefined' ? currentOrderTab : 'All'} / ${typeof currentOrderDateFilter !== 'undefined' ? currentOrderDateFilter : 'All'}.</p>`; 
        return; 
    }
    
    // OPTIMIZATION: Chunked DOM Rendering to prevent UI freezing on large datasets
    let index = 0;
    const chunkSize = 50;

    function renderNextChunk() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + chunkSize, orders.length);

        for (; index < end; index++) {
            const order = orders[index];
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

            // --- NEW: OMNICHANNEL FULFILLMENT BADGE ---
            const isStoreDelivery = order.fulfillmentType === 'STORE_DELIVERY';
            const fulfillmentBadge = isStoreDelivery 
                ? `<span style="background:#fef08a; color:#854d0e; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px; font-weight:800;">🏪 Store Truck</span>`
                : `<span style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px; font-weight:800;">🛵 Gamut Rider</span>`;

            card.innerHTML = `
                <div class="order-info">
                    <h4>Order #${orderDisplayId} ${fulfillmentBadge}</h4>
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
        }

        ordersFeed.appendChild(fragment);

        if (index < orders.length) {
            requestAnimationFrame(renderNextChunk);
        }
    }

    requestAnimationFrame(renderNextChunk);
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

    // OPTIMIZATION: Chunked DOM Rendering for Kanban Board
    let index = 0;
    const chunkSize = 50;

    function renderNextChunk() {
        const fragNew = document.createDocumentFragment();
        const fragPack = document.createDocumentFragment();
        const fragDisp = document.createDocumentFragment();

        const end = Math.min(index + chunkSize, orders.length);

        for (; index < end; index++) {
            const order = orders[index];
            if(order.status === 'Dispatched' && new Date(order.createdAt) < today) continue; 

            const isRoutine = order.deliveryType === 'Routine';
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.onclick = () => {
                if (typeof openOrderModal === 'function') openOrderModal(order);
            };

            let actionHtml = '';
            // --- MODIFIED: CONTEXTUAL DISPATCH BUTTON TEXT ---
            const dispatchBtnText = order.fulfillmentType === 'STORE_DELIVERY' ? 'Dispatch Own Truck' : 'Hand to Gamut Rider';

            if (order.status === 'Order Placed') {
                actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-pack" onclick="if(typeof updateOrderStatus === 'function') updateOrderStatus('${order._id}', 'Packing', event)">Start Packing</button></div>`;
                countNew++;
            } else if (order.status === 'Packing') {
                actionHtml = `<div class="kanban-actions"><button class="kanban-btn btn-dispatch" onclick="if(typeof updateOrderStatus === 'function') updateOrderStatus('${order._id}', 'Dispatched', event)">${dispatchBtnText}</button></div>`;
                countPack++;
            } else if (order.status === 'Dispatched') {
                actionHtml = `<span style="font-size: 11px; font-weight: 700; color: #16A34A;">🚚 Out for Delivery</span>`;
                countDisp++;
            }

            const itemsPreview = order.items.map(i => `${i.qty}x ${i.name}`).join(', ').substring(0, 30) + '...';
            const orderDisplayId = order.orderNumber || order._id.toString().slice(-4).toUpperCase();

            // --- NEW: OMNICHANNEL FULFILLMENT BADGE ---
            const isStoreDelivery = order.fulfillmentType === 'STORE_DELIVERY';
            const fulfillmentBadge = isStoreDelivery 
                ? `<span style="background:#fef08a; color:#854d0e; padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800;">🏪 Store Fleet</span>`
                : `<span style="background:#e0e7ff; color:#3730a3; padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800;">🛵 Gamut Fleet</span>`;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <h4>#${orderDisplayId}</h4>
                        ${fulfillmentBadge}
                    </div>
                    <span class="type-badge ${isRoutine ? 'type-routine' : 'type-instant'}">${isRoutine ? 'Routine' : 'Instant'}</span>
                </div>
                <p style="margin-bottom: 4px; font-weight: 600; color: var(--text-main);">${order.customerName || 'Guest'}</p>
                <p>${itemsPreview}</p>
                ${actionHtml}
            `;

            if (order.status === 'Order Placed') fragNew.appendChild(card);
            else if (order.status === 'Packing') fragPack.appendChild(card);
            else if (order.status === 'Dispatched') fragDisp.appendChild(card);
        }

        colNew.appendChild(fragNew);
        colPack.appendChild(fragPack);
        colDisp.appendChild(fragDisp);

        document.getElementById('kb-count-new').innerText = countNew;
        document.getElementById('kb-count-pack').innerText = countPack;
        document.getElementById('kb-count-disp').innerText = countDisp;

        if (index < orders.length) {
            requestAnimationFrame(renderNextChunk);
        }
    }

    requestAnimationFrame(renderNextChunk);
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
        // --- MODIFIED: RIDER AWARENESS ---
        if (order.fulfillmentType === 'STORE_DELIVERY') {
             driverDisplayEl.innerHTML = `<p style="margin-top: 8px; font-size: 13px; color: #854d0e; font-weight: 600; background:#fef08a; padding:4px 8px; border-radius:4px;"><i data-lucide="building" class="icon-sm"></i> Fulfilled by Store Fleet</p>`;
        } else if (order.deliveryDriverName && order.deliveryDriverName !== 'Unassigned') {
            driverDisplayEl.innerHTML = `<p style="margin-top: 8px; font-size: 13px; color: #10b981; font-weight: 600;"><i data-lucide="truck" class="icon-sm"></i> Assigned to Gamut Rider: ${order.deliveryDriverName} ${order.driverPhone ? `(${order.driverPhone})` : ''}</p>`;
        } else {
            driverDisplayEl.innerHTML = `<p style="margin-top: 8px; font-size: 13px; color: #f59e0b; font-weight: 600;"><i data-lucide="truck" class="icon-sm"></i> Gamut Rider: Pending Assignment</p>`;
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
