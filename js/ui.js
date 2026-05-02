/* js/ui.js */

// OPTIMIZATION: Global 503 Circuit Breaker Interceptor
// Instantly catches backend load-shedding events and alerts the user gracefully.
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    if (response.status === 503) {
        console.warn('[CIRCUIT BREAKER] 503 Service Unavailable Detected');
        if (typeof showToast === 'function') {
            showToast('⚠️ System overloaded. Circuit Breaker active. Pausing requests for 30s.');
        }
    }
    return response;
};

const views = {
    overview: document.getElementById('overview-view'),
    pos: document.getElementById('pos-view'),
    orders: document.getElementById('orders-view'),
    inventory: document.getElementById('inventory-view'),
    analytics: document.getElementById('analytics-view'),
    customers: document.getElementById('customers-view')
};

const navBtns = {
    overview: document.getElementById('nav-overview'),
    pos: document.getElementById('nav-pos'),
    orders: document.getElementById('nav-orders'),
    inventory: document.getElementById('nav-inventory'),
    analytics: document.getElementById('nav-analytics'),
    customers: document.getElementById('nav-customers')
};

document.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.getItem('dailypick_dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) btn.innerText = '☀️';
    }

    const isSidebarCollapsed = localStorage.getItem('dailypick_sidebar_collapsed') === 'true';
    if (isSidebarCollapsed && window.innerWidth >= 768) {
        document.body.classList.add('sidebar-collapsed');
    }
    
    window.addEventListener('offline', () => { 
        const banner = document.getElementById('offline-banner');
        if(banner) banner.classList.remove('hidden'); 
    });
    window.addEventListener('online', () => { 
        const banner = document.getElementById('offline-banner');
        if(banner) banner.classList.add('hidden'); 
    });
});

window.toggleSidebar = function() {
    const body = document.body;
    body.classList.toggle('sidebar-collapsed');
    const isCollapsed = body.classList.contains('sidebar-collapsed');
    localStorage.setItem('dailypick_sidebar_collapsed', isCollapsed);
};

window.focusHeaderSearch = function() {
    openCommandSearch();
};

window.switchView = function(viewName) {
    if (typeof window.flushTransientMemory === 'function') window.flushTransientMemory();

    const titles = {
        overview: 'Store Overview', 
        pos: 'In-Store Register', 
        orders: 'Live Operations Center',
        inventory: 'Inventory Management',
        analytics: 'Business Insights',
        customers: 'Customer Directory'
    };
    
    const subtitleEl = document.getElementById('header-subtitle');
    if (subtitleEl) subtitleEl.innerText = titles[viewName] || '';
    
    if (!views || !views.overview) return;
    
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    
    Object.keys(views).forEach(key => {
        if (views[key]) {
            if (key === viewName) { 
                views[key].classList.add('active'); 
                views[key].classList.remove('hidden'); 
                if (navBtns[key]) navBtns[key].classList.add('active'); 
            } else { 
                views[key].classList.remove('active'); 
                views[key].classList.add('hidden'); 
                if (navBtns[key]) navBtns[key].classList.remove('active'); 
            }
        }
    });

    if (viewName === 'pos') {
        if (typeof currentInventory !== 'undefined' && currentInventory.length === 0) {
            if (typeof fetchInventory === 'function') {
                fetchInventory().then(() => { 
                    if (typeof renderPosQuickTap === 'function') renderPosQuickTap(); 
                    if (typeof startPosScanner === 'function') startPosScanner(); 
                }).catch(err => console.log(err));
            }
        } else {
            if (typeof renderPosQuickTap === 'function') renderPosQuickTap();
            if (typeof startPosScanner === 'function') startPosScanner();
        }
    } else {
        if (typeof stopPosScanner === 'function') stopPosScanner();
    }
    
    if (viewName === 'inventory' && typeof currentInventory !== 'undefined' && currentInventory.length === 0 && typeof fetchInventory === 'function') fetchInventory();
    if (viewName === 'analytics' && typeof fetchAnalytics === 'function') fetchAnalytics();
    if (viewName === 'customers' && typeof fetchCustomers === 'function') fetchCustomers();
    if (viewName === 'overview' && typeof window.renderOverview === 'function') window.renderOverview(); 
};

window.jumpToInventoryWithFilter = function(type) {
    window.switchView('inventory');
    if (typeof toggleSpecialFilter === 'function') {
        toggleSpecialFilter(type);
    }
};

window.openCommandSearch = function() {
    const modal = document.getElementById('command-search-modal');
    modal.classList.add('active');
    document.getElementById('command-input').focus();
    document.getElementById('command-results').innerHTML = '<p style="padding: 16px; font-size: 12px; color: var(--text-muted);">Start typing to find products, orders, or customers...</p>';
};

window.closeCommandSearch = function() {
    document.getElementById('command-search-modal').classList.remove('active');
    document.getElementById('command-input').value = '';
};

window.handleCommandSearch = function(query) {
    const resultsContainer = document.getElementById('command-results');
    query = query.toLowerCase().trim();
    
    if (query.startsWith('>')) {
        const cmd = query.substring(1).trim();
        let resultsHTML = '';
        if ('open shift'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); openShiftModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Open Register / Shift</p></div>`;
        if ('add product'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); window.switchView('inventory'); openAddProductModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Add New Product</p></div>`;
        if ('end of day eod report'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); openEodReport();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: End of Day Report</p></div>`;
        if ('settings'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); window.openSettingsModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Global Settings</p></div>`;

        if (resultsHTML === '') resultsHTML = '<p style="padding: 16px; font-size: 12px; color: var(--text-muted);">No matching actions found.</p>';
        resultsContainer.innerHTML = resultsHTML;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    let resultsHTML = '';

    if (typeof currentOrders !== 'undefined') {
        const orderMatches = currentOrders.filter(o => o._id.toLowerCase().includes(query) || (o.customerPhone && o.customerPhone.includes(query))).slice(0, 3);
        orderMatches.forEach(o => {
            resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); window.openOrderModalById('${o._id}')">
                <div>
                    <p style="font-weight:700; font-size:13px;">Order #${o._id.slice(-4).toUpperCase()}</p>
                    <p style="font-size:11px; color:var(--text-muted);">${o.customerName || 'Guest'} • ₹${o.totalAmount}</p>
                </div>
                <span style="font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px;">Order</span>
            </div>`;
        });
    }

    if (typeof currentInventory !== 'undefined') {
        const productMatches = currentInventory.filter(p => p.name.toLowerCase().includes(query) || (p.variants && p.variants.some(v => v.sku.toLowerCase().includes(query)))).slice(0, 5);
        productMatches.forEach(p => {
            resultsHTML += `<div class="cmd-result-item" onclick="window.closeCommandSearch(); window.switchView('inventory'); openEditProductModal('${p._id}', event)">
                <div>
                    <p style="font-weight:700; font-size:13px;">${p.name}</p>
                    <p style="font-size:11px; color:var(--text-muted);">${p.category} • ${p.variants ? p.variants.length : 0} Variants</p>
                </div>
                <span style="font-size:10px; background:#dcfce7; color:#16a34a; padding:2px 6px; border-radius:4px;">Product</span>
            </div>`;
        });
    }

    if (resultsHTML === '') resultsHTML = '<p style="padding: 16px; font-size: 12px; color: var(--text-muted);">No matching results found.</p>';
    resultsContainer.innerHTML = resultsHTML;
};

window.openOrderModalById = function(id) {
    if (typeof currentOrders === 'undefined') return;
    const order = currentOrders.find(o => o._id === id);
    if(order) {
        window.switchView('orders');
        openOrderModal(order);
    }
};

window.renderOverview = async function() {
    if (typeof currentOrders === 'undefined' || typeof currentInventory === 'undefined') return;
    
    // OPTIMIZED: Single pass array iteration for multiple metrics to save memory and CPU
    let pendingCount = 0;
    let todayRevenue = 0;
    const todayStr = new Date().toDateString();

    currentOrders.forEach(o => {
        if (o.status === 'Order Placed' || o.status === 'Packing') {
            pendingCount++;
        }
        if (new Date(o.createdAt).toDateString() === todayStr && o.status !== 'Cancelled') {
            todayRevenue += o.totalAmount;
        }
    });

    document.getElementById('ov-pending-count').innerText = pendingCount;

    let lowStockCount = 0;
    currentInventory.forEach(p => {
        if (p.variants) {
            p.variants.forEach(v => {
                if (v.stock <= (v.lowStockThreshold || 5)) lowStockCount++;
            });
        }
    });
    document.getElementById('ov-low-stock-count').innerText = lowStockCount;

    if (typeof getOfflineCount === 'function') {
        try {
            const offlineCount = await getOfflineCount();
            const offlineCard = document.getElementById('ov-offline-card');
            
            if (offlineCount > 0) {
                offlineCard.style.display = 'block';
                document.getElementById('ov-offline-count').innerText = offlineCount;
            } else {
                offlineCard.style.display = 'none';
            }
        } catch(e) {}
    }

    const target = 10000;
    const progressPct = Math.min((todayRevenue / target) * 100, 100).toFixed(1);
    
    const progressBar = document.getElementById('ov-progress-bar');
    const progressText = document.getElementById('ov-progress-text');
    if (progressBar && progressText) {
        progressBar.style.width = `${progressPct}%`;
        progressText.innerText = `₹${todayRevenue.toFixed(2)} (${progressPct}%)`;
        if (progressPct >= 100) {
            progressBar.style.background = '#3b82f6';
            progressText.innerText = `🎉 Goal Reached! ₹${todayRevenue.toFixed(2)}`;
        } else {
            progressBar.style.background = '#10b981';
        }
    }

    const actionFeed = document.getElementById('action-center-feed');
    if (actionFeed) {
        actionFeed.innerHTML = '';
        let criticalTasks = [];

        let failedSyncs = JSON.parse(localStorage.getItem('dailypick_failed_syncs') || '[]');
        failedSyncs.forEach((failItem, index) => {
            criticalTasks.push({
                type: 'error',
                title: `Offline Sync Failed (Order: ₹${failItem.totalAmount || 0})`,
                msg: `Reason: ${failItem.failReason}. Please review and adjust stock manually if needed.`,
                action: () => {
                    if (confirm("Clear this error? Ensure you have adjusted stock manually if necessary.")) {
                        let currentFails = JSON.parse(localStorage.getItem('dailypick_failed_syncs') || '[]');
                        currentFails.splice(index, 1);
                        localStorage.setItem('dailypick_failed_syncs', JSON.stringify(currentFails));
                        window.renderOverview();
                    }
                }
            });
        });
        
        currentInventory.forEach(p => {
            if(p.variants) {
                p.variants.forEach(v => {
                    if (v.stock <= 0) {
                        criticalTasks.push({
                            type: 'error',
                            title: `Out of Stock: ${p.name}`,
                            msg: `Variant (${v.weightOrVolume}) is empty. Customer orders for this item will fail.`,
                            action: () => window.jumpToInventoryWithFilter('out')
                        });
                    }
                    else if (v.stock <= (v.lowStockThreshold || 5)) {
                        let runway = typeof calculateStockRunway === 'function' ? calculateStockRunway(v) : null;
                        criticalTasks.push({
                            type: 'warning',
                            title: `Restock Needed: ${p.name}`,
                            msg: `Only ${v.stock} left. ${runway ? `Estimated to last ${runway} days.` : 'Order soon.'}`,
                            action: () => openRestockModal()
                        });
                    }
                });
            }
        });
        
        // ENTERPRISE OPTIMIZATION: DOM Fragment to eliminate rendering lag on lower-end tablets
        if (criticalTasks.length > 0) {
            const feedFragment = document.createDocumentFragment();
            criticalTasks.sort((a,b) => a.type === 'error' ? -1 : 1).forEach(task => {
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.style.borderLeft = `4px solid ${task.type === 'error' ? '#ef4444' : '#f59e0b'}`;
                card.style.padding = '12px';
                card.style.cursor = 'pointer';
                card.onclick = task.action;
                card.innerHTML = `
                    <h4 style="color:${task.type === 'error' ? '#ef4444' : '#f59e0b'}; margin-bottom:4px;">${task.title}</h4>
                    <p style="font-size:12px;">${task.msg}</p>
                `;
                feedFragment.appendChild(card);
            });
            actionFeed.appendChild(feedFragment);
        } else {
            actionFeed.innerHTML = '<p class="empty-state">✅ Your store is healthy. No critical actions required today.</p>';
        }
    }
};

window.openExpenseModal = async function() {
    const formGroup = document.querySelector('#expense-modal .form-card form .input-group');
    if (formGroup && !document.getElementById('expense-receipt-upload')) {
        const uploadWrapper = document.createElement('div');
        uploadWrapper.style.width = '100%';
        uploadWrapper.style.marginTop = '16px';
        uploadWrapper.style.marginBottom = '8px';
        uploadWrapper.style.textAlign = 'left';
        uploadWrapper.innerHTML = `
            <label style="font-size:12px; font-weight:600; color:var(--text-muted);">📸 Attach Receipt (Optional)</label>
            <input type="file" id="expense-receipt-upload" accept="image/*" style="width:100%; padding:8px; border:1px dashed #cbd5e1; border-radius:8px; margin-top:4px;">
        `;
        formGroup.parentNode.insertBefore(uploadWrapper, formGroup.nextSibling);
    }
    
    document.getElementById('expense-modal').classList.add('active');
    document.getElementById('expense-list-container').innerHTML = '<p class="empty-state">Loading cloud expenses...</p>';
    if (typeof window.renderExpenseList === 'function') await window.renderExpenseList();
};

window.closeExpenseModal = function() {
    document.getElementById('expense-modal').classList.remove('active');
};

window.submitExpense = async function(e) {
    e.preventDefault();
    const desc = document.getElementById('expense-desc').value.trim();
    const amt = parseFloat(document.getElementById('expense-amount').value);
    if(!desc || isNaN(amt)) return;
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = '...'; 
    btn.disabled = true;

    try {
        let receiptUrl = '';
        const fileInput = document.getElementById('expense-receipt-upload');
        
        if (fileInput && fileInput.files.length > 0) {
            if (typeof window.showToast === 'function') window.showToast('Uploading receipt image...');
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const uploadRes = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/expenses/upload`, {
                method: 'POST',
                body: formData 
            });
            const uploadData = await uploadRes.json();
            
            if (uploadData.success) {
                receiptUrl = uploadData.receiptUrl;
            } else {
                if (typeof window.showToast === 'function') window.showToast('Warning: Image upload failed. Saving text only.');
            }
        }

        const payload = {
            desc: desc,
            amount: amt,
            dateStr: new Date().toDateString(),
            timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            receiptUrl: receiptUrl
        };

        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('expense-desc').value = '';
            document.getElementById('expense-amount').value = '';
            if (fileInput) fileInput.value = '';
            if (typeof window.renderExpenseList === 'function') await window.renderExpenseList();
            if (typeof window.showToast === 'function') window.showToast('Expense logged to cloud! ☁️💸');
        } else {
            if (typeof window.showToast === 'function') window.showToast('Failed to log expense.');
        }
    } catch(err) {
        if (typeof window.showToast === 'function') window.showToast('Network error.');
    } finally {
        btn.innerText = 'Add'; 
        btn.disabled = false;
    }
};

window.renderExpenseList = async function() {
    const container = document.getElementById('expense-list-container');
    const todayStr = new Date().toDateString();
    
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/expenses?dateStr=${todayStr}`);
        const result = await res.json();
        
        container.innerHTML = '';
        if(result.success && result.data.length > 0) {
            result.data.forEach((ex) => {
                const receiptHtml = ex.receiptUrl 
                    ? `<a href="${ex.receiptUrl}" target="_blank" style="margin-left:8px; font-size:11px; color:#3b82f6; text-decoration:underline;">[View Receipt]</a>` 
                    : '';
                    
                container.innerHTML += `
                    <div style="background: #fef2f2; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; border: 1px solid #fecaca; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 13px; color: #991b1b;">${ex.desc}</strong>${receiptHtml}<br>
                            <span style="font-size: 10px; color: #b91c1c;">${ex.timeStr}</span>
                        </div>
                        <div style="font-weight: bold; color: #dc2626;">₹${ex.amount.toFixed(2)}</div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">No expenses logged today.</p>';
        }
    } catch(e) {
        container.innerHTML = '<p class="empty-state" style="color:red;">Error loading expenses.</p>';
    }
};

window.openEodReport = async function() {
    document.getElementById('eod-expected-cash').innerText = '...';
    document.getElementById('eod-expected-upi').innerText = '...';
    document.getElementById('eod-expected-paylater').innerText = '...';
    document.getElementById('eod-total-revenue').innerText = '...';
    const expEl = document.getElementById('eod-total-expenses');
    const netEl = document.getElementById('eod-net-profit');
    if(expEl) expEl.innerText = '...';
    if(netEl) netEl.innerText = '...';
    document.getElementById('eod-actual-cash').value = '';
    document.getElementById('eod-discrepancy-result').innerHTML = '';
    
    document.getElementById('eod-modal').classList.add('active');

    const todayStr = new Date().toDateString();
    let cash = 0, upi = 0, payLater = 0;
    
    if (typeof currentOrders !== 'undefined') {
        currentOrders.filter(o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'Cancelled').forEach(o => {
            if (o.paymentMethod === 'Cash') cash += o.totalAmount;
            else if (o.paymentMethod === 'UPI') upi += o.totalAmount;
            else if (o.paymentMethod === 'Pay Later') payLater += o.totalAmount;
            else if (o.paymentMethod === 'Split' && o.splitDetails) {
                cash += (o.splitDetails.cash || 0);
                upi += (o.splitDetails.upi || 0);
            }
        });
    }
    
    const totalRev = cash + upi + payLater;
    
    let totalExp = 0;
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/expenses?dateStr=${todayStr}`);
        const result = await res.json();
        // ENTERPRISE FIX: Safe array checking and Number coercion to prevent reduce from throwing TypeErrors
        if(result.success && Array.isArray(result.data)) {
            totalExp = result.data.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
        }
    } catch(e) {
        console.error('Failed to fetch expenses for EOD');
    }
    
    const netProfit = totalRev - totalExp;
    
    document.getElementById('eod-expected-cash').innerText = cash.toFixed(2);
    document.getElementById('eod-expected-upi').innerText = upi.toFixed(2);
    document.getElementById('eod-expected-paylater').innerText = payLater.toFixed(2);
    document.getElementById('eod-total-revenue').innerText = totalRev.toFixed(2);
    
    if(expEl) expEl.innerText = totalExp.toFixed(2);
    if(netEl) netEl.innerText = netProfit.toFixed(2);
};

window.closeEodReport = function() { 
    document.getElementById('eod-modal').classList.remove('active'); 
};

window.calculateEodDiscrepancy = function() {
    const expectedCash = parseFloat(document.getElementById('eod-expected-cash').innerText);
    const actualCash = parseFloat(document.getElementById('eod-actual-cash').value);
    const resultDiv = document.getElementById('eod-discrepancy-result');
    
    if(isNaN(actualCash)) {
        resultDiv.innerHTML = '<span style="color: #ef4444;">Please enter a valid physical cash amount.</span>';
        return;
    }
    
    const diff = actualCash - expectedCash;
    if (diff === 0) {
        resultDiv.innerHTML = '<span style="color: #10b981; font-weight: bold;">Perfect Match! ⚖️ All cash accounted for.</span>';
    } else if (diff < 0) {
        resultDiv.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Shortage Warning: You are short ₹${Math.abs(diff).toFixed(2)} ⚠️</span>`;
    } else {
        resultDiv.innerHTML = `<span style="color: #f59e0b; font-weight: bold;">Overage Note: You are over by ₹${Math.abs(diff).toFixed(2)} 📈</span>`;
    }
};

window.openStoreManagementModal = async function() {
    const modal = document.getElementById('manage-stores-modal');
    modal.classList.add('active');
    
    const formCard = modal.querySelector('.form-card');
    formCard.innerHTML = `
        <div class="form-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2>Store Management</h2>
            <button class="close-btn" onclick="document.getElementById('manage-stores-modal').classList.remove('active')" style="background:none; border:none; font-size:22px; cursor:pointer;"><i data-lucide="x" class="icon-md"></i></button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: left;">
            <div style="background: #F9FAFB; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB;">
                <h3 style="margin-bottom: 12px; font-size: 15px;">Add New Store</h3>
                <div class="input-group">
                    <input type="text" id="new-store-name" placeholder="Store Name (e.g. Downtown)" style="margin-bottom: 8px;">
                    <input type="text" id="new-store-location" placeholder="Location/City" style="margin-bottom: 8px;">
                    <button class="primary-btn" style="background: #10b981;" onclick="submitNewStore()">Create Store</button>
                </div>
            </div>

            <div style="background: #F9FAFB; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB;">
                <h3 style="margin-bottom: 12px; font-size: 15px;">Add Terminal</h3>
                <div class="input-group">
                    <select id="new-register-store" style="margin-bottom: 8px;">
                        <option value="">Select Store...</option>
                    </select>
                    <input type="text" id="new-register-name" placeholder="Terminal Name (e.g. Counter 1)" style="margin-bottom: 8px;">
                    <button class="primary-btn" style="background: #3b82f6;" onclick="submitNewRegister()">Create Terminal</button>
                </div>
            </div>
        </div>

        <div style="margin-top: 24px; text-align: left;">
            <h3 style="margin-bottom: 12px; font-size: 15px;">Active Stores & Terminals</h3>
            <div id="store-management-list" style="max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px;">
                <p class="empty-state">Loading stores...</p>
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    await window.renderStoreManagementList();
};

window.renderStoreManagementList = async function() {
    try {
        const listEl = document.getElementById('store-management-list');
        const selectEl = document.getElementById('new-register-store');
        
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/stores`);
        const storeData = await res.json();
        
        if (storeData.success && storeData.data.length > 0) {
            listEl.innerHTML = '';
            selectEl.innerHTML = '<option value="">Select Store...</option>';
            
            for (const store of storeData.data) {
                selectEl.innerHTML += `<option value="${store._id}">${store.name}</option>`;
                
                let registersHtml = '<span style="font-size:11px; color:var(--text-muted);">No terminals yet.</span>';
                const regRes = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/stores/${store._id}/registers`);
                const regData = await regRes.json();
                
                if (regData.success && regData.data.length > 0) {
                    registersHtml = regData.data.map(r => `<span style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-size:11px; margin-right:4px;">${r.name}</span>`).join('');
                }
                
                listEl.innerHTML += `
                    <div style="padding: 12px; border-bottom: 1px solid #F3F4F6;">
                        <strong style="font-size: 14px; color: var(--primary);">${store.name}</strong> <span style="font-size: 12px; color: var(--text-muted);">(${store.location})</span>
                        <div style="margin-top: 8px;">${registersHtml}</div>
                    </div>
                `;
            }
        } else {
            listEl.innerHTML = '<p class="empty-state">No stores configured yet.</p>';
        }
    } catch (e) {
        console.error("Error loading stores", e);
    }
};

window.submitNewStore = async function() {
    const name = document.getElementById('new-store-name').value.trim();
    const location = document.getElementById('new-store-location').value.trim();
    if (!name || !location) {
        if (typeof showToast === 'function') showToast("Name and Location required.");
        return;
    }
    
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/stores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, location })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast("Store created successfully!");
            document.getElementById('new-store-name').value = '';
            document.getElementById('new-store-location').value = '';
            await window.renderStoreManagementList();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Error creating store");
        }
    } catch (e) { if (typeof showToast === 'function') showToast("Network error"); }
};

window.submitNewRegister = async function() {
    const storeId = document.getElementById('new-register-store').value;
    const name = document.getElementById('new-register-name').value.trim();
    if (!storeId || !name) {
        if (typeof showToast === 'function') showToast("Store and Terminal Name required.");
        return;
    }
    
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/registers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, storeId })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast("Terminal created successfully!");
            document.getElementById('new-register-name').value = '';
            await window.renderStoreManagementList();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Error creating terminal");
        }
    } catch (e) { if (typeof showToast === 'function') showToast("Network error"); }
};

// --- NEW: DEVELOPER PORTAL LOGIC ---
window.openDeveloperPortal = function() {
    if (typeof currentStoreId === 'undefined' || !currentStoreId) {
        if (typeof showToast === 'function') showToast("Please log into a specific store to access its API settings.");
        return;
    }
    
    document.getElementById('developer-portal-modal').classList.add('active');
    
    // Check if the store already has an API key saved
    // Note: In a true enterprise app, we wouldn't fetch the key to the frontend again for security, 
    // but for this MVP, we can indicate if one is active.
    document.getElementById('dev-api-key-box').value = "****************************************";
};

window.generatePartnerKey = async function() {
    if (!confirm("Warning: This will invalidate any existing ERP connections. Are you sure you want to generate a new key?")) return;
    
    const btn = document.getElementById('generate-key-btn');
    const keyBox = document.getElementById('dev-api-key-box');
    
    btn.innerText = 'Generating...';
    btn.disabled = true;

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/stores/${currentStoreId}/key`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success && data.data && data.data.apiKey) {
            keyBox.value = data.data.apiKey;
            keyBox.select();
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast("✅ New Key Generated & Copied to Clipboard!");
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Unauthorized: Only Admins can generate keys.");
            keyBox.value = "ERROR: UNAUTHORIZED";
        }
    } catch (e) { 
        if (typeof showToast === 'function') showToast("Network error"); 
    } finally {
        btn.innerText = 'Generate New API Key';
        btn.disabled = false;
    }
};
