/* js/analytics.js */

let categoryChartInstance = null; 
let hourlyChartInstance = null;
let revenueChartInstance = null;
let allHistoricalOrders = [];
let allHistoricalExpenses = [];

async function exportOrdersCSV() {
    showToast('Fetching orders for export...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/export`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Orders_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Export successful!");
    } catch(e) {
        showToast('Network error during export.');
    }
}

async function exportCustomersCSV() {
    showToast('Fetching customers for export...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers/export`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Customers_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Export successful!");
    } catch(e) {
        showToast('Network error during export.');
    }
}

async function exportFinancialsCSV(timeframe) {
    showToast(`Generating ${timeframe} financials export...`);
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        if (result.success) {
            const orders = result.data.filter(o => o.status !== 'Cancelled');
            if (orders.length === 0) return showToast('No sales data available.');
            
            let groupedData = {};
            
            orders.forEach(o => {
                const date = new Date(o.createdAt);
                let key = '';
                
                if (timeframe === 'Daily') {
                    key = date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
                } else if (timeframe === 'Monthly') {
                    key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                } else if (timeframe === 'Quarterly') {
                    const q = Math.floor(date.getMonth() / 3) + 1;
                    key = `Q${q} ${date.getFullYear()}`;
                } else if (timeframe === 'Annual') {
                    key = `${date.getFullYear()}`;
                }
                
                if (!groupedData[key]) {
                    groupedData[key] = { orders: 0, revenue: 0, tax: 0, discount: 0, points: 0 };
                }
                groupedData[key].orders += 1;
                groupedData[key].revenue += o.totalAmount;
                groupedData[key].tax += (o.taxAmount || 0);
                groupedData[key].discount += (o.discountAmount || 0);
                groupedData[key].points += (o.pointsRedeemed || 0);
            });
            
            let csvContent = `Time Period (${timeframe}),Total Orders,Total Revenue (INR),Total Tax (INR),Total Discount (INR),Points Redeemed,Average Order Value (INR)\n`;
            Object.keys(groupedData).forEach(key => {
                const d = groupedData[key];
                const aov = (d.revenue / d.orders).toFixed(2);
                csvContent += `${key},${d.orders},${d.revenue},${d.tax},${d.discount},${d.points},${aov}\n`;
            });
            
            triggerCSVDownload(csvContent, `dailypick_financials_${timeframe.toLowerCase()}.csv`);
        } else {
            showToast('Failed to fetch data.');
        }
    } catch(e) {
        showToast('Network error during export.');
    }
}

function triggerCSVDownload(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function fetchAnalytics() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const [orderRes, expenseRes] = await Promise.all([
            fetchFn(`${BACKEND_URL}/api/orders`),
            fetchFn(`${BACKEND_URL}/api/expenses`)
        ]);
        
        const orderResult = await orderRes.json();
        const expenseResult = await expenseRes.json();
        
        if (orderResult.success) {
            allHistoricalOrders = orderResult.data.filter(o => o.status !== 'Cancelled');
        }

        if (expenseResult.success) {
            allHistoricalExpenses = expenseResult.data;
        }
        
        if (typeof currentInventory !== 'undefined' && currentInventory.length === 0 && typeof fetchInventory === 'function') {
            await fetchInventory();
        }

        updateAnalyticsRange(7); 
        
        // --- PHASE 6: Invoke Leaderboard Fetch ---
        fetchLeaderboard();
        
    } catch (e) {
        console.error("Analytics Error", e);
    }
}

function updateAnalyticsRange(daysLimit) {
    document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('active'));
    const btnId = daysLimit === 999 ? 'date-btn-all' : `date-btn-${daysLimit}`;
    const targetBtn = document.getElementById(btnId);
    if(targetBtn) targetBtn.classList.add('active');

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - (daysLimit - 1));
    cutoffDate.setHours(0, 0, 0, 0);

    const filteredOrders = allHistoricalOrders.filter(o => new Date(o.createdAt) >= cutoffDate && new Date(o.createdAt) <= today);
    const filteredExpenses = allHistoricalExpenses.filter(ex => new Date(ex.createdAt) >= cutoffDate && new Date(ex.createdAt) <= today);

    let revenueMap = {};
    let expenseMap = {};
    let cogsMap = {}; 
    let labels = [];
    
    let totalPeriodTax = 0;
    let totalPeriodDiscount = 0;
    let totalPeriodPoints = 0;
    
    const pointsToGraph = Math.min(daysLimit, 30);
    for (let i = pointsToGraph - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        labels.push(label);
        revenueMap[label] = 0;
        expenseMap[label] = 0;
        cogsMap[label] = 0;
    }

    let itemFrequency = {};
    let categoryRevenue = {}; 
    let hourlyDistribution = new Array(24).fill(0); 

    filteredOrders.forEach(o => {
        totalPeriodTax += (o.taxAmount || 0);
        totalPeriodDiscount += (o.discountAmount || 0);
        totalPeriodPoints += (o.pointsRedeemed || 0);

        const orderDate = new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (revenueMap[orderDate] !== undefined) {
            revenueMap[orderDate] += o.totalAmount;
        }

        o.items.forEach(i => {
            const key = `${i.name} (${i.selectedVariant || i.weightOrVolume || 'Standard'})`;
            if (!itemFrequency[key]) itemFrequency[key] = { qty: 0, revenue: 0 };
            itemFrequency[key].qty += i.qty;
            itemFrequency[key].revenue += (i.price * i.qty);

            if (cogsMap[orderDate] !== undefined) {
                const invItem = currentInventory.find(p => p._id === i.productId);
                if (invItem && invItem.variants) {
                    const variant = invItem.variants.find(v => v._id === i.variantId);
                    if (variant && variant.purchaseHistory && variant.purchaseHistory.length > 0) {
                        const cost = variant.purchaseHistory[variant.purchaseHistory.length - 1].purchasingPrice;
                        cogsMap[orderDate] += (cost * i.qty);
                    }
                }
            }

            let catName = 'Uncategorized';
            const invItem = currentInventory.find(inv => inv.name === i.name);
            if (invItem && invItem.category) catName = invItem.category;

            if (!categoryRevenue[catName]) categoryRevenue[catName] = 0;
            categoryRevenue[catName] += (i.price * i.qty);
        });

        const hour = new Date(o.createdAt).getHours();
        hourlyDistribution[hour]++;
    });

    filteredExpenses.forEach(ex => {
        const exDate = new Date(ex.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (expenseMap[exDate] !== undefined) {
            expenseMap[exDate] += ex.amount;
        }
    });

    let marginPct = 0;
    const totalRev = Object.values(revenueMap).reduce((a,b)=>a+b, 0);
    const totalCogs = Object.values(cogsMap).reduce((a,b)=>a+b, 0);
    const totalExp = Object.values(expenseMap).reduce((a,b)=>a+b, 0);
    if (totalRev > 0) {
        marginPct = (((totalRev - totalCogs - totalExp) / totalRev) * 100).toFixed(1);
    }

    let kpiRow = document.getElementById('analytics-kpi-row');
    if (!kpiRow) {
        const dateRow = document.querySelector('.date-picker-row');
        if (dateRow) {
            kpiRow = document.createElement('div');
            kpiRow.id = 'analytics-kpi-row';
            kpiRow.style.marginBottom = '24px';
            kpiRow.style.marginTop = '16px';
            kpiRow.style.display = 'grid';
            kpiRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
            kpiRow.style.gap = '16px';
            dateRow.parentNode.insertBefore(kpiRow, dateRow.nextSibling);
        }
    }
    
    if (kpiRow) {
        kpiRow.innerHTML = `
            <div class="stat-card" style="padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <h3 style="font-size: 12px; color: #166534; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Net Profit Margin</h3>
                <p style="font-size: 24px; font-weight: 800; color: #15803d;">${marginPct}%</p>
                <p style="font-size: 11px; color: #16a34a; margin-top: 4px;">After COGS & Expenses</p>
            </div>
            <div class="stat-card" style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <h3 style="font-size: 12px; color: #991b1b; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Promotions (Discounts)</h3>
                <p style="font-size: 24px; font-weight: 800; color: #dc2626;">-₹${totalPeriodDiscount.toFixed(2)}</p>
                <p style="font-size: 11px; color: #b91c1c; margin-top: 4px;">Revenue invested in offers</p>
            </div>
            <div class="stat-card" style="padding: 16px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <h3 style="font-size: 12px; color: #6b21a8; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Points Redeemed</h3>
                <p style="font-size: 24px; font-weight: 800; color: #8b5cf6;">${totalPeriodPoints}</p>
                <p style="font-size: 11px; color: #7e22ce; margin-top: 4px;">Points cashed in by customers</p>
            </div>
            <div class="stat-card" style="padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <h3 style="font-size: 12px; color: #b45309; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Tax Collected (GST)</h3>
                <p style="font-size: 24px; font-weight: 800; color: #f59e0b;">₹${totalPeriodTax.toFixed(2)}</p>
                <p style="font-size: 11px; color: #d97706; margin-top: 4px;">Total tax liability for period</p>
            </div>
        `;
    }

    const revenueData = labels.map(label => revenueMap[label]);
    const profitData = labels.map(label => revenueMap[label] - cogsMap[label] - expenseMap[label]);

    renderChart(labels, revenueData, profitData);

    const catLabels = Object.keys(categoryRevenue);
    const catData = Object.values(categoryRevenue);
    renderCategoryChart(catLabels, catData);

    const hourLabels = Array.from({length: 24}, (_, i) => {
        const ampm = i >= 12 ? 'PM' : 'AM';
        const h = i % 12 || 12;
        return `${h} ${ampm}`;
    });
    renderHourlyChart(hourLabels, hourlyDistribution);

    const topItems = Object.entries(itemFrequency)
        .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 8); 

    const feed = document.getElementById('top-items-feed');
    if (feed) {
        feed.innerHTML = '';
        if (topItems.length === 0) {
            feed.innerHTML = `<p class="empty-state">No sales data for the selected timeframe.</p>`;
        } else {
            topItems.forEach(item => {
                feed.innerHTML += `
                    <div class="top-item-card">
                        <span class="top-item-name">${item.name}</span>
                        <span class="top-item-stats">${item.qty} units • ₹${item.revenue}</span>
                    </div>
                `;
            });
        }
    }

    let vipFeed = document.getElementById('vip-customers-feed');
    if (vipFeed) {
        let customerLTV = {};
        filteredOrders.forEach(o => {
            const phone = o.customerPhone || 'Walk-in / Guest';
            if(!customerLTV[phone]) customerLTV[phone] = { name: o.customerName || 'Guest', revenue: 0, orders: 0 };
            customerLTV[phone].revenue += o.totalAmount;
            customerLTV[phone].orders += 1;
        });
        const topCustomers = Object.entries(customerLTV)
            .map(([phone, data]) => ({phone, ...data}))
            .sort((a,b) => b.revenue - a.revenue)
            .slice(0, 5);
        
        vipFeed.innerHTML = '';
        if (topCustomers.length === 0) {
            vipFeed.innerHTML = `<p class="empty-state">No customer data for this period.</p>`;
        } else {
            topCustomers.forEach(c => {
                vipFeed.innerHTML += `
                    <div class="top-item-card" style="border-left: 4px solid #D4AF37;">
                        <span class="top-item-name">${c.name} <span style="font-size:11px; color:#94A3B8; font-weight:normal; margin-left:8px;">${c.phone}</span></span>
                        <span class="top-item-stats">${c.orders} Orders • ₹${c.revenue.toFixed(2)}</span>
                    </div>
                `;
            });
        }
    }

    if (typeof currentInventory !== 'undefined') {
        let totalRTVValue = 0;
        let totalRTVItems = 0;
        let totalExpiredValue = 0;
        let totalExpiredItems = 0;
        let rtvList = [];
        let expiredList = [];

        currentInventory.forEach(p => {
            if(p.variants) {
                p.variants.forEach(v => {
                    if (v.returnHistory && v.returnHistory.length > 0) {
                        v.returnHistory.forEach(rtv => {
                            totalRTVValue += (rtv.refundAmount || 0);
                            totalRTVItems += (rtv.returnedQuantity || 0);
                            rtvList.push({ name: p.name, reason: rtv.reason, qty: rtv.returnedQuantity, loss: rtv.refundAmount });
                        });
                    }

                    if (v.expiryDate) {
                        const expDate = new Date(v.expiryDate);
                        if (expDate < today && v.stock > 0) {
                            const loss = v.stock * v.price; 
                            totalExpiredValue += loss;
                            totalExpiredItems += v.stock;
                            expiredList.push({ name: p.name, qty: v.stock, loss: loss, date: expDate.toLocaleDateString() });
                        }
                    }
                });
            }
        });

        const wastageKpiRow = document.getElementById('wastage-kpi-row');
        if (wastageKpiRow) {
            wastageKpiRow.innerHTML = `
                <div class="stat-card" style="padding: 16px; background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <h3 style="font-size: 12px; color: #be123c; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Returned to Vendor (RTV)</h3>
                    <p style="font-size: 24px; font-weight: 800; color: #e11d48;">₹${totalRTVValue.toFixed(2)}</p>
                    <p style="font-size: 11px; color: #9f1239; margin-top: 4px;">${totalRTVItems} units returned historically</p>
                </div>
                <div class="stat-card" style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <h3 style="font-size: 12px; color: #991b1b; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Expired Stock (Unsold)</h3>
                    <p style="font-size: 24px; font-weight: 800; color: #dc2626;">₹${totalExpiredValue.toFixed(2)}</p>
                    <p style="font-size: 11px; color: #b91c1c; margin-top: 4px;">${totalExpiredItems} units currently expired on shelves</p>
                </div>
            `;
        }

        const wastageFeed = document.getElementById('wastage-returns-feed');
        if (wastageFeed) {
            wastageFeed.innerHTML = '';
            if (rtvList.length === 0 && expiredList.length === 0) {
                wastageFeed.innerHTML = '<p class="empty-state">No wastage or returns recorded.</p>';
            } else {
                rtvList.sort((a,b) => b.loss - a.loss);
                expiredList.sort((a,b) => b.loss - a.loss);
                
                let combinedOffenders = [];
                rtvList.slice(0,3).forEach(i => combinedOffenders.push(`
                    <div class="top-item-card" style="border-left: 4px solid #e11d48;">
                        <span class="top-item-name">${i.name} <span style="font-size:11px; color:#94A3B8; font-weight:normal; margin-left:8px;">RTV: ${i.reason}</span></span>
                        <span class="top-item-stats">${i.qty} units • ₹${i.loss.toFixed(2)}</span>
                    </div>
                `));
                expiredList.slice(0,3).forEach(i => combinedOffenders.push(`
                    <div class="top-item-card" style="border-left: 4px solid #dc2626;">
                        <span class="top-item-name">${i.name} <span style="font-size:11px; color:#94A3B8; font-weight:normal; margin-left:8px;">Expired: ${i.date}</span></span>
                        <span class="top-item-stats">${i.qty} units • ₹${i.loss.toFixed(2)}</span>
                    </div>
                `));
                wastageFeed.innerHTML = combinedOffenders.join('');
            }
        }
    }
}

function renderChart(labels, revenueData, profitData) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy(); 
    
    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gross Revenue (₹)',
                    data: revenueData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Net Profit (₹)',
                    data: profitData,
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000, easing: 'easeOutQuart' }, 
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { boxWidth: 12, font: { size: 10 } }
                } 
            },
            scales: { 
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderCategoryChart(labels, data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    const backgroundColors = [
        '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', 
        '#14b8a6', '#f43f5e', '#84cc16', '#6366f1', '#eab308'
    ];

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000, easing: 'easeOutQuart' }, 
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } } 
            }
        }
    });
}

function renderHourlyChart(labels, data) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    if (hourlyChartInstance) hourlyChartInstance.destroy();
    
    const maxVal = Math.max(...data) || 1;
    
    const dynamicColors = data.map(val => {
        const intensity = val / maxVal;
        if (intensity > 0.8) return '#ef4444'; 
        if (intensity > 0.5) return '#f59e0b'; 
        if (intensity > 0) return '#3b82f6';   
        return '#e2e8f0';                      
    });
    
    hourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Orders',
                data: data,
                backgroundColor: dynamicColors, 
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000, easing: 'easeOutQuart' }, 
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { ticks: { maxRotation: 45, minRotation: 45, font: {size: 9} } }
            }
        }
    });
}

// --- PHASE 6: Cashier Leaderboard Fetcher & Renderer ---
async function fetchLeaderboard() {
    const feed = document.getElementById('leaderboard-feed');
    if (!feed) return;
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/leaderboard`);
        const result = await res.json();

        if (result.success && result.data && result.data.length > 0) {
            feed.innerHTML = '';
            result.data.forEach((staff, index) => {
                const isTop = index === 0;
                
                let accuracyColor = '#10b981'; 
                let accuracyText = 'Excellent Accuracy';
                if (staff.netDiscrepancy < -500) {
                    accuracyColor = '#ef4444'; 
                    accuracyText = 'High Shortage Warning';
                } else if (staff.netDiscrepancy < 0) {
                    accuracyColor = '#f59e0b'; 
                    accuracyText = 'Minor Discrepancies';
                }

                feed.innerHTML += `
                    <div class="top-item-card" style="${isTop ? 'border: 2px solid #8b5cf6;' : ''}">
                        <div style="display:flex; align-items:center; gap:16px; flex: 1;">
                            ${isTop ? `<div style="background:#ede9fe; color:#6d28d9; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👑</div>` : `<div style="background:#F3F4F6; color:var(--text-muted); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">#${index+1}</div>`}
                            <div>
                                <span class="top-item-name" style="display:block; font-size: 15px;">${staff._id}</span>
                                <span style="font-size:11px; color:${accuracyColor}; font-weight:700;">${accuracyText}</span>
                            </div>
                        </div>
                        <div class="top-item-stats" style="text-align: right;">
                            <span style="display:block; color:var(--primary); font-weight:800; font-size:16px;">₹${staff.totalRevenueHandled.toLocaleString()}</span>
                            <span style="font-size:11px; color:var(--text-muted);">${staff.totalShifts} Shifts Completed</span>
                        </div>
                    </div>
                `;
            });
        } else {
            feed.innerHTML = '<p class="empty-state">No shift data available for leaderboard.</p>';
        }
    } catch (e) {
        console.warn("Leaderboard fetch failed", e);
        feed.innerHTML = '<p class="empty-state">Leaderboard data unavailable.</p>';
    }
}
