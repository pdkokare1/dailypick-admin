/* js/ui.js */

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

function switchView(viewName) {
    const titles = {
        overview: 'Store Overview', 
        pos: 'In-Store Register', 
        orders: 'Live Operations Center',
        inventory: 'Inventory Management',
        analytics: 'Business Insights',
        customers: 'Customer Directory'
    };
    document.getElementById('header-subtitle').innerText = titles[viewName];
    
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

    if (viewName === 'pos') {
        if (currentInventory.length === 0) {
            fetchInventory().then(() => { renderPosQuickTap(); startPosScanner(); });
        } else {
            renderPosQuickTap();
            startPosScanner();
        }
    } else {
        stopPosScanner();
    }
    
    if (viewName === 'inventory' && currentInventory.length === 0) fetchInventory();
    if (viewName === 'analytics') fetchAnalytics();
    if (viewName === 'customers') fetchCustomers();
    if (viewName === 'overview') renderOverview(); 
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
    if (document.getElementById('pos-view').classList.contains('active')) {
        if(e.key === 'F1') { e.preventDefault(); processPosCheckout('Cash'); return; }
        if(e.key === 'F2') { e.preventDefault(); processPosCheckout('UPI'); return; }
        if(e.key === 'F4') { e.preventDefault(); clearPosCart(); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openCommandSearch();
        return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }

    if (e.key === 'Enter' && globalBarcodeBuffer.length > 3) {
        if (document.getElementById('pos-view').classList.contains('active')) {
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

function renderOverview() {
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

    const offlineQueue = JSON.parse(localStorage.getItem('dailypick_offline_pos') || '[]');
    const offlineCard = document.getElementById('ov-offline-card');
    if (offlineQueue.length > 0) {
        offlineCard.style.display = 'block';
        document.getElementById('ov-offline-count').innerText = offlineQueue.length;
    } else {
        offlineCard.style.display = 'none';
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
        let negativeStock = [];
        let deadStockItems = [];
        
        currentInventory.forEach(p => {
            if(p.variants) {
                p.variants.forEach(v => {
                    if (v.stock < 0) negativeStock.push(`${p.name} (${v.weightOrVolume})`);
                    if (v.stock > 15) deadStockItems.push(`${p.name} (${v.weightOrVolume})`);
                });
            }
        });
        
        if (negativeStock.length > 0) {
            actionFeed.innerHTML += `<div class="stat-card" style="border-left: 4px solid #ef4444; padding: 12px;"><h4 style="color:#ef4444; margin-bottom:4px;">⚠️ Critical: Negative Stock</h4><p style="font-size:12px;">${negativeStock.length} items have negative stock quantities.</p></div>`;
        }
        if (deadStockItems.length > 0) {
            actionFeed.innerHTML += `<div class="stat-card" style="border-left: 4px solid #f59e0b; padding: 12px;"><h4 style="color:#f59e0b; margin-bottom:4px;">📦 Overstocked / Dead Stock</h4><p style="font-size:12px;">${deadStockItems.length} items are currently heavily overstocked (>15 units).</p></div>`;
        }
        if (actionFeed.innerHTML === '') {
            actionFeed.innerHTML = '<p class="empty-state">No critical actions required today.</p>';
        }
    }
}

// NEW: Expense Ledger Logic
function openExpenseModal() {
    renderExpenseList();
    document.getElementById('expense-modal').classList.add('active');
}

function closeExpenseModal() {
    document.getElementById('expense-modal').classList.remove('active');
}

function submitExpense(e) {
    e.preventDefault();
    const desc = document.getElementById('expense-desc').value.trim();
    const amt = parseFloat(document.getElementById('expense-amount').value);
    if(!desc || isNaN(amt)) return;
    
    dailyExpenses.push({
        id: Date.now(),
        date: new Date().toDateString(),
        desc: desc,
        amount: amt,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    localStorage.setItem('dailypick_expenses', JSON.stringify(dailyExpenses));
    
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
    renderExpenseList();
    showToast('Expense logged! 💸');
}

function renderExpenseList() {
    const container = document.getElementById('expense-list-container');
    container.innerHTML = '';
    const todayStr = new Date().toDateString();
    const todaysExpenses = dailyExpenses.filter(ex => ex.date === todayStr);
    
    if(todaysExpenses.length === 0) {
        container.innerHTML = '<p class="empty-state">No expenses logged today.</p>';
        return;
    }
    
    todaysExpenses.forEach((ex) => {
        container.innerHTML += `
            <div style="background: #fef2f2; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; border: 1px solid #fecaca;">
                <div><strong style="font-size: 13px; color: #991b1b;">${ex.desc}</strong><br><span style="font-size: 10px; color: #b91c1c;">${ex.time}</span></div>
                <div style="font-weight: bold; color: #dc2626;">₹${ex.amount.toFixed(2)}</div>
            </div>
        `;
    });
}

// MODIFIED: Injected Expense & Net Profit Math
function openEodReport() {
    const todayStr = new Date().toDateString();
    let cash = 0, upi = 0, payLater = 0;
    
    currentOrders.filter(o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'Cancelled').forEach(o => {
        if (o.paymentMethod === 'Cash') cash += o.totalAmount;
        else if (o.paymentMethod === 'UPI') upi += o.totalAmount;
        else if (o.paymentMethod === 'Pay Later') payLater += o.totalAmount;
    });
    
    const totalRev = cash + upi + payLater;
    
    // Calculate total expenses for today
    const todaysExpenses = dailyExpenses.filter(ex => ex.date === todayStr);
    const totalExp = todaysExpenses.reduce((sum, ex) => sum + ex.amount, 0);
    const netProfit = totalRev - totalExp;
    
    document.getElementById('eod-expected-cash').innerText = cash.toFixed(2);
    document.getElementById('eod-expected-upi').innerText = upi.toFixed(2);
    document.getElementById('eod-expected-paylater').innerText = payLater.toFixed(2);
    document.getElementById('eod-total-revenue').innerText = totalRev.toFixed(2);
    
    const expEl = document.getElementById('eod-total-expenses');
    const netEl = document.getElementById('eod-net-profit');
    if(expEl) expEl.innerText = totalExp.toFixed(2);
    if(netEl) netEl.innerText = netProfit.toFixed(2);
    
    document.getElementById('eod-actual-cash').value = '';
    document.getElementById('eod-discrepancy-result').innerHTML = '';
    
    document.getElementById('eod-modal').classList.add('active');
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
