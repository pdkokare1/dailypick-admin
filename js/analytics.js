/* js/analytics.js */

let categoryChartInstance = null; 
let hourlyChartInstance = null;
let revenueChartInstance = null;

async function exportOrdersCSV() {
    showToast('Fetching orders for export...');
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        if (result.success) {
            if (result.data.length === 0) return showToast('No orders to export.');
            
            let csvContent = "Order ID,Date,Customer Name,Phone,Address,Delivery Type,Total Amount,Tax (INR),Discount (INR),Points Redeemed,Payment Method,Status,Items\n";
            result.data.forEach(o => {
                const cleanName = (o.customerName || 'Guest').replace(/,/g, '');
                const cleanPhone = o.customerPhone || '';
                const cleanAddress = (o.deliveryAddress || '').replace(/,/g, ';').replace(/\n/g, ' ');
                const date = new Date(o.createdAt).toLocaleString().replace(/,/g, '');
                const itemsStr = o.items.map(i => `${i.qty}x ${i.name}`).join(' | ');
                
                csvContent += `${o._id},${date},${cleanName},${cleanPhone},${cleanAddress},${o.deliveryType},${o.totalAmount},${o.taxAmount || 0},${o.discountAmount || 0},${o.pointsRedeemed || 0},${o.paymentMethod},${o.status},"${itemsStr}"\n`;
            });
            
            triggerCSVDownload(csvContent, "dailypick_orders_export.csv");
        } else {
            showToast('Failed to fetch orders.');
        }
    } catch(e) {
        showToast('Network error during export.');
    }
}

async function exportCustomersCSV() {
    showToast('Fetching customers for export...');
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/customers`);
        const result = await res.json();
        if (result.success) {
            if (result.data.length === 0) return showToast('No customers to export.');
            
            let csvContent = "Name,Phone Number,Total Orders,Lifetime Value (INR),Last Active Date\n";
            result.data.forEach(c => {
                const cleanName = (c.name || 'Guest').replace(/,/g, '');
                const date = new Date(c.lastOrderDate).toLocaleString().replace(/,/g, '');
                
                csvContent += `${cleanName},${c.phone},${c.orderCount},${c.lifetimeValue},${date}\n`;
            });
            
            triggerCSVDownload(csvContent, "dailypick_customers_export.csv");
        } else {
            showToast('Failed to fetch customers.');
        }
    } catch(e) {
        showToast('Network error during export.');
    }
}

async function exportFinancialsCSV(timeframe) {
    showToast(`Generating ${timeframe} financials export...`);
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders`);
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
        const [orderRes, expenseRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/orders`),
            fetch(`${BACKEND_URL}/api/expenses`)
        ]);
        
        const orderResult = await orderRes.json();
        const expenseResult = await expenseRes.json();
        
        if (orderResult.success) {
            allHistoricalOrders = orderResult.data.filter(o => o.status !== 'Cancelled');
        }

        if (expenseResult.success) {
            allHistoricalExpenses = expenseResult.data;
        }

        updateAnalyticsRange(7); 
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

    // --- NEW: Dynamic Profit Margin Calculation ---
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

    // --- NEW: VIP Customers (CLV) Feed ---
    let vipFeed = document.getElementById('vip-customers-feed');
    if (!vipFeed) {
        const topItemsContainer = document.getElementById('top-items-feed');
        if (topItemsContainer) {
            const header = document.createElement('div');
            header.className = 'section-header';
            header.style.marginTop = '40px';
            header.innerHTML = '<h2>VIP Customers (CLV)</h2>';
            
            vipFeed = document.createElement('div');
            vipFeed.id = 'vip-customers-feed';
            vipFeed.className = 'top-items-list'; 
            
            topItemsContainer.parentNode.insertBefore(header, topItemsContainer.nextSibling);
            header.parentNode.insertBefore(vipFeed, header.nextSibling);
        }
    }

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
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } } 
            }
        }
    });
}

function renderHourlyChart(labels, data) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    if (hourlyChartInstance) hourlyChartInstance.destroy();
    
    hourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Orders',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { ticks: { maxRotation: 45, minRotation: 45, font: {size: 9} } }
            }
        }
    });
}
