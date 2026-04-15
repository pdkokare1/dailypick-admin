/* js/exports.js */

async function exportOrdersCSV() {
    showToast('Fetching orders for export...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/export`);
        
        // Receives the streamed backend chunks as a complete blob safely in the browser
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
        
        // Receives the streamed backend chunks as a complete blob safely in the browser
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

// NEW FUNCTION: Added to support the missing P&L Report button in index.html
async function exportPnLReport() {
    showToast('Generating P&L Report...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        
        // Fetch both orders and expenses concurrently to calculate Profit & Loss
        const [orderRes, expenseRes] = await Promise.all([
            fetchFn(`${BACKEND_URL}/api/orders`),
            fetchFn(`${BACKEND_URL}/api/expenses`)
        ]);
        
        const orderResult = await orderRes.json();
        const expenseResult = await expenseRes.json();
        
        if (orderResult.success && expenseResult.success) {
            const orders = orderResult.data.filter(o => o.status !== 'Cancelled');
            const expenses = expenseResult.data;
            
            let totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
            let totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
            let netProfit = totalRevenue - totalExpenses;
            
            let csvContent = "Report Type,Amount (INR)\n";
            csvContent += `Gross Revenue,${totalRevenue.toFixed(2)}\n`;
            csvContent += `Total Expenses,${totalExpenses.toFixed(2)}\n`;
            csvContent += `Net Profit,${netProfit.toFixed(2)}\n`;
            
            triggerCSVDownload(csvContent, `dailypick_pnl_report_${new Date().toISOString().split('T')[0]}.csv`);
            showToast('P&L Export successful!');
        } else {
            showToast('Failed to fetch data for P&L.');
        }
    } catch(e) {
        showToast('Network error during P&L export.');
    }
}
