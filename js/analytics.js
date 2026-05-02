/* js/analytics.js */

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
        fetchLeaderboard();

        // NEW ENTERPRISE INTEGRATION: Fire secondary fetches for advanced backend computations
        fetchEnterprisePnl();
        fetchAIForecast();
        
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

    // ENTERPRISE OPTIMIZATION: Build O(1) Data Dictionaries to prevent O(N^2) lockups
    const inventoryMap = new Map();
    const variantMap = new Map();
    if (typeof currentInventory !== 'undefined') {
        currentInventory.forEach(p => {
            inventoryMap.set(p._id, p);
            if (p.variants) {
                p.variants.forEach(v => {
                    variantMap.set(v._id, { product: p, variant: v });
                });
            }
        });
    }

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

            // OPTIMIZED O(1) Cache lookups instead of .find() iterations
            if (cogsMap[orderDate] !== undefined) {
                const cachedData = variantMap.get(i.variantId);
                if (cachedData && cachedData.variant && cachedData.variant.purchaseHistory && cachedData.variant.purchaseHistory.length > 0) {
                    const cost = cachedData.variant.purchaseHistory[cachedData.variant.purchaseHistory.length - 1].purchasingPrice;
                    cogsMap[orderDate] += (cost * i.qty);
                }
            }

            let catName = 'Uncategorized';
            const invItemByProduct = inventoryMap.get(i.productId);
            if (invItemByProduct && invItemByProduct.category) {
                catName = invItemByProduct.category;
            }

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

    if (typeof window.renderAnalyticsKPIs === 'function') {
        window.renderAnalyticsKPIs(marginPct, totalPeriodDiscount, totalPeriodPoints, totalPeriodTax);
    }

    const revenueData = labels.map(label => revenueMap[label]);
    const profitData = labels.map(label => revenueMap[label] - cogsMap[label] - expenseMap[label]);

    if (typeof window.renderChart === 'function') window.renderChart(labels, revenueData, profitData);

    const catLabels = Object.keys(categoryRevenue);
    const catData = Object.values(categoryRevenue);
    if (typeof window.renderCategoryChart === 'function') window.renderCategoryChart(catLabels, catData);

    const hourLabels = Array.from({length: 24}, (_, i) => {
        const ampm = i >= 12 ? 'PM' : 'AM';
        const h = i % 12 || 12;
        return `${h} ${ampm}`;
    });
    if (typeof window.renderHourlyChart === 'function') window.renderHourlyChart(hourLabels, hourlyDistribution);

    const topItems = Object.entries(itemFrequency)
        .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 8); 

    if (typeof window.renderTopItems === 'function') window.renderTopItems(topItems);

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
        
    if (typeof window.renderVIPCustomers === 'function') window.renderVIPCustomers(topCustomers);

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

        if (typeof window.renderWastageKPIs === 'function') {
            window.renderWastageKPIs(totalRTVValue, totalRTVItems, totalExpiredValue, totalExpiredItems);
        }
        if (typeof window.renderWastageFeed === 'function') {
            window.renderWastageFeed(rtvList, expiredList);
        }
    }
}

async function fetchLeaderboard() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/leaderboard`);
        const result = await res.json();
        
        if (typeof window.renderLeaderboard === 'function') {
            window.renderLeaderboard(result.success ? result.data : null);
        }
    } catch (e) {
        console.warn("Leaderboard fetch failed", e);
        if (typeof window.renderLeaderboard === 'function') window.renderLeaderboard(null);
    }
}

// ENTERPRISE INTEGRATION: Asynchronously fetch server-side DB Rollups
async function fetchEnterprisePnl() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/pnl`);
        const result = await res.json();
        if (result.success) {
            console.log("[ENTERPRISE PNL SYNC]", result.data);
            // Can be hooked into future DOM elements easily
        }
    } catch (e) {
        console.warn("Materialized PNL Rollup sync delayed.");
    }
}

// ENTERPRISE INTEGRATION: Pull Gemini AI forecasts for active actions
async function fetchAIForecast() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/analytics/forecast`);
        const result = await res.json();
        if (result.success && result.data && result.data.recommendations) {
            console.log("[GEMINI AI FORECAST]", result.data.recommendations);
            // Output AI recommendations natively into the console for store manager review
        }
    } catch (e) {
        console.warn("AI Forecast unavailable.");
    }
}
