async function exportOrdersCSV() {
    showToast('Fetching orders for export...');
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        if (result.success) {
            if (result.data.length === 0) return showToast('No orders to export.');
            
            let csvContent = "Order ID,Date,Customer Name,Phone,Address,Delivery Type,Total Amount,Payment Method,Status,Items\n";
            result.data.forEach(o => {
                const cleanName = (o.customerName || 'Guest').replace(/,/g, '');
                const cleanPhone = o.customerPhone || '';
                const cleanAddress = (o.deliveryAddress || '').replace(/,/g, ';').replace(/\n/g, ' ');
                const date = new Date(o.createdAt).toLocaleString().replace(/,/g, '');
                const itemsStr = o.items.map(i => `${i.qty}x ${i.name}`).join(' | ');
                
                csvContent += `${o._id},${date},${cleanName},${cleanPhone},${cleanAddress},${o.deliveryType},${o.totalAmount},${o.paymentMethod},${o.status},"${itemsStr}"\n`;
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
                    groupedData[key] = { orders: 0, revenue: 0 };
                }
                groupedData[key].orders += 1;
                groupedData[key].revenue += o.totalAmount;
            });
            
            let csvContent = `Time Period (${timeframe}),Total Orders,Total Revenue (INR),Average Order Value (INR)\n`;
            Object.keys(groupedData).forEach(key => {
                const d = groupedData[key];
                const aov = (d.revenue / d.orders).toFixed(2);
                csvContent += `${key},${d.orders},${d.revenue},${aov}\n`;
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
        const res = await fetch(`${BACKEND_URL}/api/orders`);
        const result = await res.json();
        
        if (result.success) {
            allHistoricalOrders = result.data.filter(o => o.status !== 'Cancelled');
            updateAnalyticsRange(7); 
        }
    } catch (e) {
        console.error("Analytics Error", e);
    }
}

function updateAnalyticsRange(daysLimit) {
    document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`date-btn-${daysLimit === 999 ? 'all' : daysLimit}`).classList.add('active');

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - (daysLimit - 1));
    cutoffDate.setHours(0, 0, 0, 0);

    const filteredOrders = allHistoricalOrders.filter(o => new Date(o.createdAt) >= cutoffDate && new Date(o.createdAt) <= today);

    let revenueMap = {};
    let labels = [];
    
    const pointsToGraph = Math.min(daysLimit, 30);
    for (let i = pointsToGraph - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        labels.push(label);
        revenueMap[label] = 0;
    }

    let itemFrequency = {};

    filteredOrders.forEach(o => {
        const orderDate = new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (revenueMap[orderDate] !== undefined) {
            revenueMap[orderDate] += o.totalAmount;
        }

        o.items.forEach(i => {
            const key = `${i.name} (${i.selectedVariant || i.weightOrVolume || 'Standard'})`;
            if (!itemFrequency[key]) itemFrequency[key] = { qty: 0, revenue: 0 };
            itemFrequency[key].qty += i.qty;
            itemFrequency[key].revenue += (i.price * i.qty);
        });
    });

    const data = labels.map(label => revenueMap[label]);
    renderChart(labels, data);

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
}

function renderChart(labels, data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy(); 
    
    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}
