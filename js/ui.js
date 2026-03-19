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

let globalBarcodeBuffer = '';
let globalBarcodeTimeout = null;

document.addEventListener('keydown', (e) => {
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

    // NEW PHASE 3: Daily Target Progress Bar Logic
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
            progressBar.style.background = '#3b82f6'; // Turn blue when goal is hit
            progressText.innerText = `🎉 Goal Reached! ₹${todayRevenue.toFixed(2)}`;
        } else {
            progressBar.style.background = '#10b981';
        }
    }
}
