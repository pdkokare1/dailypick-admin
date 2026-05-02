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
    ['All', 'Instant', 'Routine'].forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (el) el.classList.remove('active');
    });
    const activeEl = document.getElementById(`tab-${tab}`);
    if (activeEl) activeEl.classList.add('active');
    
    ordersPage = 1;
    fetchOrders();
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
        globalPendingRevenue = Math.max(0, globalPendingRevenue - (Number(activeOrder.totalAmount) || 0));
    }

    currentOrders = currentOrders.filter(o => o._id !== targetOrderId);
    selectedOrders.delete(targetOrderId);
    
    if (typeof closeOrderModal === 'function') closeOrderModal(); 
    updateDashboard(); 
    if (typeof showToast === 'function') showToast('Cancelling order & refunding stock...');

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/${targetOrderId}/cancel`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: "Admin Cancelled" })
        });
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast('Order Cancelled successfully.');
            if (typeof currentInventory !== 'undefined' && currentInventory.length > 0) { 
                inventoryPage = 1; 
                if (typeof fetchInventory === 'function') fetchInventory(); 
            }
        } else {
            if (typeof showToast === 'function') showToast('Database Error during cancellation.');
            fetchOrders();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
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

        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(url, { signal });
        const result = await res.json();
        
        if (result.success) {
            if (ordersPage === 1) {
                currentOrders = result.data;
            } else {
                currentOrders = [...currentOrders, ...result.data];
            }

            if (result.stats) {
                globalPendingCount = result.stats.pendingCount || 0;
                globalPendingRevenue = result.stats.pendingRevenue || 0;
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
    
    ['list', 'kanban'].forEach(id => {
        const el = document.getElementById(`layout-${id}`);
        if(el) el.classList.remove('active');
    });
    
    const activeEl = document.getElementById(`layout-${layout}`);
    if(activeEl) activeEl.classList.add('active');
    
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
    if (!btn) return;
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
    if(btn) {
        btn.innerText = 'Dispatching...'; 
        btn.disabled = true;
    }
    
    const idsToDispatch = Array.from(selectedOrders);
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        await Promise.all(idsToDispatch.map(id => fetchFn(`${BACKEND_URL}/api/orders/${id}/dispatch`, { method: 'PUT' })));
        if (typeof showToast === 'function') showToast(`Dispatched ${idsToDispatch.length} orders successfully!`);
        
        idsToDispatch.forEach(id => {
            const o = currentOrders.find(ord => ord._id === id);
            if(o && (o.status === 'Order Placed' || o.status === 'Packing')) {
                globalPendingCount = Math.max(0, globalPendingCount - 1);
                globalPendingRevenue = Math.max(0, globalPendingRevenue - (Number(o.totalAmount) || 0));
                o.status = 'Dispatched';
            }
        });
        
        selectedOrders.clear();
        updateDashboard();
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Error during bulk dispatch.'); 
    } finally { 
        if(btn) btn.disabled = false; 
        updateBulkDispatchUI(); 
    }
}

async function updateOrderStatus(orderId, newStatus, event) {
    if (event) event.stopPropagation();
    if (isProcessingOrderAction) return;
    
    isProcessingOrderAction = true;
    
    // Optimistic UI Update
    let localOrder = currentOrders.find(o => o._id === orderId);
    if(localOrder) {
        if ((localOrder.status === 'Order Placed' || localOrder.status === 'Packing') && (newStatus === 'Dispatched' || newStatus === 'Completed' || newStatus === 'Cancelled')) {
            globalPendingCount = Math.max(0, globalPendingCount - 1);
            globalPendingRevenue = Math.max(0, globalPendingRevenue - (Number(localOrder.totalAmount) || 0));
        }
        localOrder.status = newStatus;
    }
    updateDashboard();

    // --- MODIFIED: OMNICHANNEL TOAST AWARENESS ---
    if (newStatus === 'Dispatched') {
        const dispatchMsg = (localOrder && localOrder.fulfillmentType === 'STORE_DELIVERY') 
            ? 'Handing over to Store Fleet...' 
            : 'Dispatching to Gamut Rider... 🛵';
        if (typeof showToast === 'function') showToast(dispatchMsg);
    } else {
        if (typeof showToast === 'function') showToast(`Order marked as ${newStatus}`);
    }

    try {
        const endpoint = newStatus === 'Dispatched' ? 'dispatch' : 'status';
        const body = newStatus === 'Dispatched' ? null : JSON.stringify({ status: newStatus });
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        
        const res = await fetchFn(`${BACKEND_URL}/api/orders/${orderId}/${endpoint}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        
        const result = await res.json();
        
        // NEW: If backend assigned an automated rider, update the UI and notify the cashier
        if (result.success && result.data) {
            if (localOrder) {
                if (result.data.deliveryDriverName) localOrder.deliveryDriverName = result.data.deliveryDriverName;
                if (result.data.driverPhone) localOrder.driverPhone = result.data.driverPhone;
                if (result.data.trackingLink) localOrder.trackingLink = result.data.trackingLink;
                
                if (newStatus === 'Packed' && result.data.deliveryDriverName !== 'Unassigned') {
                     if (typeof showToast === 'function') showToast(`Rider Assigned: ${result.data.deliveryDriverName} 🛵`);
                }
            }
            updateDashboard(); // Re-render to show the new rider data
        }

    } catch(e) {
        if (typeof showToast === 'function') showToast('Network error, order may not have synced.');
    } finally {
        isProcessingOrderAction = false;
    }
}

function updateDashboard(isLastPage = true) {
    const dailyRevenueEl = document.getElementById('daily-revenue');
    const pendingCountEl = document.getElementById('pending-count');
    
    if (dailyRevenueEl) dailyRevenueEl.innerText = `₹${globalPendingRevenue.toFixed(2)}`;
    if (pendingCountEl) pendingCountEl.innerText = globalPendingCount;
    
    let displayOrders = typeof currentOrders !== 'undefined' ? currentOrders.filter(o => o.status !== 'Cancelled' && o.status !== 'Completed') : [];

    if (currentOrderLayout === 'list') {
        if (typeof renderListView === 'function') renderListView(displayOrders.filter(o => o.status === 'Order Placed' || o.status === 'Packing'));
        
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
        if (typeof renderKanbanView === 'function') renderKanbanView(displayOrders);
        const loadBtn = document.getElementById('load-more-orders-btn');
        if(loadBtn) loadBtn.classList.add('hidden');
    }
    
    updateBulkDispatchUI();
    
    const overviewView = document.getElementById('overview-view');
    if (overviewView && overviewView.classList.contains('active') && typeof renderOverview === 'function') {
        renderOverview(); 
    }
}

async function markOrderDispatched() {
    if (isProcessingOrderAction) return;
    if (typeof activeOrder === 'undefined' || !activeOrder) return; 
    
    isProcessingOrderAction = true;
    const targetOrderId = activeOrder._id;
    
    const localOrder = typeof currentOrders !== 'undefined' ? currentOrders.find(o => o._id === targetOrderId) : null;
    if(localOrder) {
        if (localOrder.status === 'Order Placed' || localOrder.status === 'Packing') {
            globalPendingCount = Math.max(0, globalPendingCount - 1);
            globalPendingRevenue = Math.max(0, globalPendingRevenue - (Number(localOrder.totalAmount) || 0));
        }
        localOrder.status = 'Dispatched';
    }
    
    if (typeof selectedOrders !== 'undefined') selectedOrders.delete(targetOrderId);
    if (typeof closeOrderModal === 'function') closeOrderModal(); 
    updateDashboard(); 

    // --- MODIFIED: OMNICHANNEL TOAST AWARENESS ---
    const dispatchMsg = (localOrder && localOrder.fulfillmentType === 'STORE_DELIVERY') 
        ? 'Handing over to Store Fleet...' 
        : 'Dispatching to Gamut Rider... 🛵';
    if (typeof showToast === 'function') showToast(dispatchMsg);
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        await fetchFn(`${BACKEND_URL}/api/orders/${targetOrderId}/dispatch`, { method: 'PUT' });
    } catch (e) { 
        if (typeof showToast === 'function') showToast('Network error updating database.'); 
        fetchOrders(); 
    } finally {
        isProcessingOrderAction = false;
    }
}

function openAssignDriverModal() {
    if (typeof activeOrder === 'undefined' || !activeOrder) {
        if (typeof showToast === 'function') showToast('No order selected.');
        return;
    }
    const nameEl = document.getElementById('assign-driver-name');
    const phoneEl = document.getElementById('assign-driver-phone');
    const modalEl = document.getElementById('assign-driver-modal');
    
    if(nameEl) nameEl.value = activeOrder.deliveryDriverName !== 'Unassigned' ? activeOrder.deliveryDriverName : '';
    if(phoneEl) phoneEl.value = activeOrder.driverPhone || '';
    if(modalEl) modalEl.classList.add('active');
}

function closeAssignDriverModal() {
    const modal = document.getElementById('assign-driver-modal');
    if(modal) modal.classList.remove('active');
}

async function submitAssignDriver(event) {
    event.preventDefault();
    if (typeof activeOrder === 'undefined' || !activeOrder) return;
    
    const driverName = document.getElementById('assign-driver-name').value.trim();
    const driverPhone = document.getElementById('assign-driver-phone').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    
    if (btn) {
        btn.innerText = 'Assigning...';
        btn.disabled = true;
    }

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/${activeOrder._id}/driver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverName, driverPhone })
        });
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast('Driver assigned successfully!');
            const localOrder = typeof currentOrders !== 'undefined' ? currentOrders.find(o => o._id === activeOrder._id) : null;
            if (localOrder) {
                localOrder.deliveryDriverName = driverName;
                localOrder.driverPhone = driverPhone;
            }
            closeAssignDriverModal();
            if (typeof openOrderModal === 'function') openOrderModal(activeOrder); 
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Error assigning driver.');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
    } finally {
        if (btn) {
            btn.innerText = 'Assign Driver';
            btn.disabled = false;
        }
    }
}

let currentRefundItem = null;

function openPartialRefundModal(productId, variantId, name, maxQty, price) {
    currentRefundItem = { productId, variantId, price };
    const nameEl = document.getElementById('refund-item-name');
    const qtyEl = document.getElementById('refund-qty');
    const modal = document.getElementById('partial-refund-modal');
    
    if(nameEl) nameEl.innerText = name;
    if(qtyEl) {
        qtyEl.value = 1;
        qtyEl.max = maxQty;
    }
    if(modal) modal.classList.add('active');
}

function closePartialRefundModal() {
    currentRefundItem = null;
    const modal = document.getElementById('partial-refund-modal');
    if(modal) modal.classList.remove('active');
}

async function submitPartialRefund() {
    if (typeof activeOrder === 'undefined' || !activeOrder || !currentRefundItem) return;
    
    const qtyInput = document.getElementById('refund-qty');
    const qtyToRefund = parseInt(qtyInput ? qtyInput.value : 0);
    
    if (isNaN(qtyToRefund) || qtyToRefund < 1) {
        if (typeof showToast === 'function') showToast("Invalid quantity.");
        return;
    }
    
    const confirmRefund = confirm(`Are you sure you want to remove ${qtyToRefund} unit(s) of this item? Stock will be returned to inventory.`);
    if (!confirmRefund) return;

    const refundValue = qtyToRefund * currentRefundItem.price;
    const newTotalAmount = activeOrder.totalAmount - refundValue;

    closePartialRefundModal();
    if (typeof showToast === 'function') showToast('Processing partial refund...');

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/${activeOrder._id}/partial-refund`, {
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
            if (typeof showToast === 'function') showToast('Item refunded successfully!');
            const localOrder = typeof currentOrders !== 'undefined' ? currentOrders.find(o => o._id === activeOrder._id) : null;
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
            if (typeof openOrderModal === 'function') openOrderModal(activeOrder); 
            if (typeof fetchInventory === 'function') fetchInventory(); 
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Error processing refund.');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
    }
}

// ============================================================================
// --- NEW: PHASE 4 FLEET RIDER APPLICATION ROUTING ---
// ============================================================================
const originalFetchOrdersPhase4 = fetchOrders;
window.fetchOrders = async function() {
    await originalFetchOrdersPhase4();
    
    // Post-fetch filter ensuring enterprise orders are removed from rider views securely
    if (window.currentUser && window.currentUser.role === 'Delivery_Agent') {
        const originalCount = currentOrders.length;
        currentOrders = currentOrders.filter(o => o.fulfillmentType !== 'STORE_DELIVERY'); 
        
        if (currentOrders.length !== originalCount) {
            // Silently update the dashboard array after removing cross-vendor leakages
            updateDashboard(document.getElementById('load-more-orders-btn')?.classList.contains('hidden'));
        }
    }
};

// ============================================================================
// --- NEW: PHASE 5 DISTRIBUTOR FULFILLMENT DASHBOARD ---
// ============================================================================
const originalFetchOrdersPhase5 = window.fetchOrders;
window.fetchOrders = async function() {
    await originalFetchOrdersPhase5();

    if (window.currentUser && window.currentUser.role === 'Distributor') {
        // Distributors only see B2B Purchase Orders assigned to them
        currentOrders = currentOrders.filter(o => 
            o.distributorId === window.currentUser.distributorId || 
            o.distributorId === window.currentUser.tenantId || 
            o.status === 'DRAFT'
        );

        // Dynamically transform the B2C headers into B2B Dashboard titles
        const sectionHeader = document.querySelector('.orders-section h2');
        if (sectionHeader) {
            sectionHeader.innerHTML = '<i data-lucide="truck" class="icon-sm"></i> Wholesale B2B Fulfillment';
        }
        
        const revHeader = document.querySelector('.stats-grid h3');
        if (revHeader) revHeader.textContent = "Accounts Receivable";
        
        updateDashboard(document.getElementById('load-more-orders-btn')?.classList.contains('hidden'));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ============================================================================
// --- NEW: PHASE 7 GEOSPATIAL FLEET ROUTING ALGORITHM ---
// ============================================================================
const originalFetchOrdersPhase7 = window.fetchOrders;
window.fetchOrders = async function() {
    await originalFetchOrdersPhase7();

    // If the user is a rider, optimize their route locally based on GPS
    if (window.currentUser && window.currentUser.role === 'Delivery_Agent') {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                // SECURITY FIX: Ensure the user hasn't logged out while waiting for GPS response
                if (!window.currentUser || window.currentUser.role !== 'Delivery_Agent') return;

                const riderLat = position.coords.latitude;
                const riderLng = position.coords.longitude;
                
                // Sort active platform orders by Manhattan distance proxy
                currentOrders.sort((a, b) => {
                    // Fallback to Pune/Pimpri-Chinchwad operational center if exact coord missing
                    const aLat = a.location ? a.location.lat : 18.6298; 
                    const aLng = a.location ? a.location.lng : 73.7997;
                    const bLat = b.location ? b.location.lat : 18.6298;
                    const bLng = b.location ? b.location.lng : 73.7997;
                    
                    const distA = Math.abs(aLat - riderLat) + Math.abs(aLng - riderLng);
                    const distB = Math.abs(bLat - riderLat) + Math.abs(bLng - riderLng);
                    
                    return distA - distB; // Shortest distance first
                });
                
                // Refresh UI with the optimized array
                updateDashboard(document.getElementById('load-more-orders-btn')?.classList.contains('hidden'));
                
                // Add a visual indicator to the UI that route is optimized
                const header = document.querySelector('.orders-section h2');
                if (header && !header.innerHTML.includes('Optimized')) {
                    header.innerHTML += ' <span style="background:#10b981; color:white; font-size:10px; padding:2px 6px; border-radius:4px; vertical-align:middle; margin-left:8px;">Route Optimized 🛵</span>';
                }
            }, (err) => {
                console.warn("Rider location access denied. Falling back to chronological sorting.");
            });
        }
    }
};

// ============================================================================
// --- NEW: PHASE 9 AUTOMATED B2B TAX INVOICE GENERATOR & PROOF OF DELIVERY ---
// ============================================================================
window.generateB2BTaxInvoicePDF = function(orderId) {
    const order = currentOrders.find(o => o._id === orderId);
    if (!order) return;
    
    if (typeof showToast === 'function') showToast("Generating B2B Tax Invoice PDF...");
    
    // Using jsPDF which is already imported in index.html
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("B2B TAX INVOICE", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Invoice Number: ${order.orderNumber || order._id}`, 14, 30);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 35);
    doc.text(`Billed To: ${order.customerName} (${order.customerPhone})`, 14, 40);
    
    let yPos = 50;
    
    const tableData = order.items.map(item => [
        item.name || 'Wholesale Item',
        item.qty,
        `Rs ${item.price.toFixed(2)}`,
        `Rs ${(item.price * item.qty).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: yPos,
        head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    if (order.taxBreakdown) {
        doc.setFontSize(11);
        doc.text(`Subtotal: Rs ${(order.totalAmount - order.taxBreakdown.totalTaxRs).toFixed(2)}`, 14, yPos);
        doc.text(`CGST: Rs ${order.taxBreakdown.cgstRs.toFixed(2)}`, 14, yPos + 6);
        doc.text(`SGST: Rs ${order.taxBreakdown.sgstRs.toFixed(2)}`, 14, yPos + 12);
        doc.setFontSize(14);
        doc.text(`Grand Total: Rs ${order.totalAmount.toFixed(2)}`, 14, yPos + 22);
    } else {
        doc.setFontSize(14);
        doc.text(`Grand Total: Rs ${order.totalAmount.toFixed(2)}`, 14, yPos);
    }
    
    doc.setFontSize(8);
    doc.text("This is a computer generated invoice and does not require a signature.", 14, 280);
    
    doc.save(`B2B_Invoice_${order.orderNumber || order._id}.pdf`);
};

// Intercept updateOrderStatus to inject OTP requirement for riders BEFORE database commit
const originalUpdateOrderStatusPhase9 = window.updateOrderStatus;
window.updateOrderStatus = async function(orderId, newStatus, event) {
    if (newStatus === 'Delivered' && window.currentUser && window.currentUser.role === 'Delivery_Agent') {
        const otp = prompt("PROOF OF DELIVERY: Please enter the 4-digit PIN provided by the customer:");
        if (!otp) {
            if (typeof showToast === 'function') showToast("Delivery cancelled. OTP is mandatory.");
            return;
        }
        
        // Temporarily hijack the adminFetch logic to inject the OTP into the PUT body safely
        const originalFetch = window.adminFetchWithAuth || window.fetch;
        const tempFetch = async (url, options) => {
            if (options && options.body && options.method === 'PUT') {
                try {
                    let bodyObj = JSON.parse(options.body);
                    bodyObj.otp = otp;
                    options.body = JSON.stringify(bodyObj);
                } catch(e) {}
            }
            return await originalFetch(url, options);
        };
        
        if (typeof window.adminFetchWithAuth !== 'undefined') window.adminFetchWithAuth = tempFetch;
        else window.fetch = tempFetch;
        
        await originalUpdateOrderStatusPhase9(orderId, newStatus, event);
        
        // Restore normal fetch behavior
        if (typeof window.adminFetchWithAuth !== 'undefined') window.adminFetchWithAuth = originalFetch;
        else window.fetch = originalFetch;
        
        return;
    }
    
    return await originalUpdateOrderStatusPhase9(orderId, newStatus, event);
};

fetchOrders = window.fetchOrders;
