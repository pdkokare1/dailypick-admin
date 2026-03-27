/* js/ui.js */

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

    // NEW: Initialize Collapsed Sidebar State
    const isSidebarCollapsed = localStorage.getItem('dailypick_sidebar_collapsed') === 'true';
    if (isSidebarCollapsed && window.innerWidth >= 768) {
        document.body.classList.add('sidebar-collapsed');
    }
    
    // NEW: Offline/Online listeners for banner
    window.addEventListener('offline', () => { 
        const banner = document.getElementById('offline-banner');
        if(banner) banner.classList.remove('hidden'); 
    });
    window.addEventListener('online', () => { 
        const banner = document.getElementById('offline-banner');
        if(banner) banner.classList.add('hidden'); 
    });
});

// NEW: Sidebar Toggle Logic
window.toggleSidebar = function() {
    const body = document.body;
    body.classList.toggle('sidebar-collapsed');
    const isCollapsed = body.classList.contains('sidebar-collapsed');
    localStorage.setItem('dailypick_sidebar_collapsed', isCollapsed);
};

// NEW: Header Search Focus routing
window.focusHeaderSearch = function() {
    openCommandSearch();
};

function showToast(m) { 
    const t = document.createElement('div'); 
    t.classList.add('toast'); 
    t.innerText = m; 
    document.getElementById('toast-container').appendChild(t); 
    setTimeout(() => t.remove(), 3000); 
}

function playBeep() { 
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    const oscillator = audioCtx.createOscillator(); 
    const gainNode = audioCtx.createGain(); 
    oscillator.connect(gainNode); 
    gainNode.connect(audioCtx.destination); 
    oscillator.type = 'sine'; 
    oscillator.frequency.value = 800; 
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); 
    oscillator.start(audioCtx.currentTime); 
    oscillator.stop(audioCtx.currentTime + 0.1); 
}

function playNewOrderAudio() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
        osc.start(audioCtx.currentTime + startTime);
        osc.stop(audioCtx.currentTime + startTime + duration);
    };
    playNote(600, 0, 0.15);
    playNote(800, 0.2, 0.15);
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('dailypick_dark_mode', isDark);
    
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.innerText = isDark ? '☀️' : '🌙';
}

function switchView(viewName) {
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
        if (currentInventory.length === 0) {
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
    
    if (viewName === 'inventory' && currentInventory.length === 0 && typeof fetchInventory === 'function') fetchInventory();
    if (viewName === 'analytics' && typeof fetchAnalytics === 'function') fetchAnalytics();
    if (viewName === 'customers' && typeof fetchCustomers === 'function') fetchCustomers();
    if (viewName === 'overview' && typeof renderOverview === 'function') renderOverview(); 
}

function jumpToInventoryWithFilter(type) {
    switchView('inventory');
    if (typeof toggleSpecialFilter === 'function') {
        toggleSpecialFilter(type);
    }
}

let globalBarcodeBuffer = '';
let globalBarcodeTimeout = null;

document.addEventListener('keydown', (e) => {
    const posView = document.getElementById('pos-view');
    if (posView && posView.classList.contains('active')) {
        if(e.key === 'F1') { e.preventDefault(); processPosCheckout('Cash'); return; }
        if(e.key === 'F2') { e.preventDefault(); processPosCheckout('UPI'); return; }
        if(e.key === 'F4') { e.preventDefault(); clearPosCart(); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openCommandSearch();
        return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Enter' && globalBarcodeBuffer.length > 3) {
        if (posView && posView.classList.contains('active')) {
            handlePosScan(globalBarcodeBuffer);
        } else {
            openCommandSearch();
            document.getElementById('command-input').value = globalBarcodeBuffer;
            handleCommandSearch(globalBarcodeBuffer);
        }
        globalBarcodeBuffer = '';
        return;
    }

    if (e.key.length === 1) {
        globalBarcodeBuffer += e.key;
        clearTimeout(globalBarcodeTimeout);
        globalBarcodeTimeout = setTimeout(() => { globalBarcodeBuffer = ''; }, 50);
    }
});

function openCommandSearch() {
    const modal = document.getElementById('command-search-modal');
    modal.classList.add('active');
    document.getElementById('command-input').focus();
    document.getElementById('command-results').innerHTML = '<p style="padding: 16px; font-size: 12px; color: var(--text-muted);">Start typing to find products, orders, or customers...</p>';
}

function closeCommandSearch() {
    document.getElementById('command-search-modal').classList.remove('active');
    document.getElementById('command-input').value = '';
}

function handleCommandSearch(query) {
    const resultsContainer = document.getElementById('command-results');
    query = query.toLowerCase().trim();
    
    // NEW: Action Palette
    if (query.startsWith('>')) {
        const cmd = query.substring(1).trim();
        let resultsHTML = '';
        if ('open shift'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); openShiftModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Open Register / Shift</p></div>`;
        if ('add product'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); switchView('inventory'); openAddProductModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Add New Product</p></div>`;
        if ('end of day eod report'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); openEodReport();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: End of Day Report</p></div>`;
        if ('settings'.includes(cmd) || cmd === '') resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); openSettingsModal();"><p style="font-weight:800; color:var(--primary);"><i data-lucide="zap" class="icon-sm"></i> Action: Global Settings</p></div>`;

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

    const orderMatches = currentOrders.filter(o => o._id.toLowerCase().includes(query) || (o.customerPhone && o.customerPhone.includes(query))).slice(0, 3);
    orderMatches.forEach(o => {
        resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); openOrderModalById('${o._id}')">
            <div>
                <p style="font-weight:700; font-size:13px;">Order #${o._id.slice(-4).toUpperCase()}</p>
                <p style="font-size:11px; color:var(--text-muted);">${o.customerName || 'Guest'} • ₹${o.totalAmount}</p>
            </div>
            <span style="font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px;">Order</span>
        </div>`;
    });

    const productMatches = currentInventory.filter(p => p.name.toLowerCase().includes(query) || (p.variants && p.variants.some(v => v.sku.toLowerCase().includes(query)))).slice(0, 5);
    productMatches.forEach(p => {
        resultsHTML += `<div class="cmd-result-item" onclick="closeCommandSearch(); switchView('inventory'); openEditProductModal('${p._id}', event)">
            <div>
                <p style="font-weight:700; font-size:13px;">${p.name}</p>
                <p style="font-size:11px; color:var(--text-muted);">${p.category} • ${p.variants ? p.variants.length : 0} Variants</p>
            </div>
            <span style="font-size:10px; background:#dcfce7; color:#16a34a; padding:2px 6px; border-radius:4px;">Product</span>
        </div>`;
    });

    if (resultsHTML === '') resultsHTML = '<p style="padding: 16px; font-size: 12px; color: var(--text-muted);">No matching results found.</p>';
    resultsContainer.innerHTML = resultsHTML;
}

function openOrderModalById(id) {
    const order = currentOrders.find(o => o._id === id);
    if(order) {
        switchView('orders');
        openOrderModal(order);
    }
}

async function renderOverview() {
    const trulyPending = currentOrders.filter(o => o.status === 'Order Placed' || o.status === 'Packing');
    document.getElementById('ov-pending-count').innerText = trulyPending.length;

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

    const todayStr = new Date().toDateString();
    const todayRevenue = currentOrders
        .filter(o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'Cancelled')
        .reduce((sum, o) => sum + o.totalAmount, 0);
    
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

        // --- NEW: Offline Conflict Resolution UI Injection ---
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
                        renderOverview(); // Refresh the list
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
                            action: () => jumpToInventoryWithFilter('out')
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
        
        if (criticalTasks.length > 0) {
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
                actionFeed.appendChild(card);
            });
        } else {
            actionFeed.innerHTML = '<p class="empty-state">✅ Your store is healthy. No critical actions required today.</p>';
        }
    }
}

async function openExpenseModal() {
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
    await renderExpenseList();
}

function closeExpenseModal() {
    document.getElementById('expense-modal').classList.remove('active');
}

async function submitExpense(e) {
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
            showToast('Uploading receipt image...');
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const uploadRes = await fetch(`${BACKEND_URL}/api/expenses/upload`, {
                method: 'POST',
                body: formData 
            });
            const uploadData = await uploadRes.json();
            
            if (uploadData.success) {
                receiptUrl = uploadData.receiptUrl;
            } else {
                showToast('Warning: Image upload failed. Saving text only.');
            }
        }

        const payload = {
            desc: desc,
            amount: amt,
            dateStr: new Date().toDateString(),
            timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            receiptUrl: receiptUrl
        };

        const res = await fetch(`${BACKEND_URL}/api/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('expense-desc').value = '';
            document.getElementById('expense-amount').value = '';
            if (fileInput) fileInput.value = '';
            await renderExpenseList();
            showToast('Expense logged to cloud! ☁️💸');
        } else {
            showToast('Failed to log expense.');
        }
    } catch(err) {
        showToast('Network error.');
    } finally {
        btn.innerText = 'Add'; 
        btn.disabled = false;
    }
}

async function renderExpenseList() {
    const container = document.getElementById('expense-list-container');
    const todayStr = new Date().toDateString();
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/expenses?dateStr=${todayStr}`);
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
}

async function openEodReport() {
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
    
    currentOrders.filter(o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'Cancelled').forEach(o => {
        if (o.paymentMethod === 'Cash') cash += o.totalAmount;
        else if (o.paymentMethod === 'UPI') upi += o.totalAmount;
        else if (o.paymentMethod === 'Pay Later') payLater += o.totalAmount;
        else if (o.paymentMethod === 'Split' && o.splitDetails) {
            cash += (o.splitDetails.cash || 0);
            upi += (o.splitDetails.upi || 0);
        }
    });
    
    const totalRev = cash + upi + payLater;
    
    let totalExp = 0;
    try {
        const res = await fetch(`${BACKEND_URL}/api/expenses?dateStr=${todayStr}`);
        const result = await res.json();
        if(result.success) {
            totalExp = result.data.reduce((sum, ex) => sum + ex.amount, 0);
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
}

function closeEodReport() { 
    document.getElementById('eod-modal').classList.remove('active'); 
}

function calculateEodDiscrepancy() {
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
}

async function openStoreManagementModal() {
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
    await renderStoreManagementList();
}

async function renderStoreManagementList() {
    try {
        const listEl = document.getElementById('store-management-list');
        const selectEl = document.getElementById('new-register-store');
        
        const res = await fetch(`${BACKEND_URL}/api/stores`);
        const storeData = await res.json();
        
        if (storeData.success && storeData.data.length > 0) {
            listEl.innerHTML = '';
            selectEl.innerHTML = '<option value="">Select Store...</option>';
            
            for (const store of storeData.data) {
                selectEl.innerHTML += `<option value="${store._id}">${store.name}</option>`;
                
                let registersHtml = '<span style="font-size:11px; color:var(--text-muted);">No terminals yet.</span>';
                const regRes = await fetch(`${BACKEND_URL}/api/stores/${store._id}/registers`);
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
}

async function submitNewStore() {
    const name = document.getElementById('new-store-name').value.trim();
    const location = document.getElementById('new-store-location').value.trim();
    if (!name || !location) return showToast("Name and Location required.");
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/stores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, location })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Store created successfully!");
            document.getElementById('new-store-name').value = '';
            document.getElementById('new-store-location').value = '';
            await renderStoreManagementList();
        } else {
            showToast(data.message || "Error creating store");
        }
    } catch (e) { showToast("Network error"); }
}

async function submitNewRegister() {
    const storeId = document.getElementById('new-register-store').value;
    const name = document.getElementById('new-register-name').value.trim();
    if (!storeId || !name) return showToast("Store and Terminal Name required.");
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/registers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, storeId })
        });
        const data = await res.json();
        if (data.success) {
            showToast("Terminal created successfully!");
            document.getElementById('new-register-name').value = '';
            await renderStoreManagementList();
        } else {
            showToast(data.message || "Error creating terminal");
        }
    } catch (e) { showToast("Network error"); }
}
