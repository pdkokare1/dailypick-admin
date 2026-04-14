/* js/views/analyticsView.js */

window.categoryChartInstance = null; 
window.hourlyChartInstance = null;
window.revenueChartInstance = null;

window.renderAnalyticsKPIs = function(marginPct, totalPeriodDiscount, totalPeriodPoints, totalPeriodTax) {
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
};

window.renderChart = function(labels, revenueData, profitData) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.revenueChartInstance) window.revenueChartInstance.destroy(); 
    
    window.revenueChartInstance = new Chart(ctx, {
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
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } 
            },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });
};

window.renderCategoryChart = function(labels, data) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.categoryChartInstance) window.categoryChartInstance.destroy();
    
    const backgroundColors = [
        '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', 
        '#14b8a6', '#f43f5e', '#84cc16', '#6366f1', '#eab308'
    ];

    window.categoryChartInstance = new Chart(ctx, {
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
            plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } } }
        }
    });
};

window.renderHourlyChart = function(labels, data) {
    const canvas = document.getElementById('hourlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.hourlyChartInstance) window.hourlyChartInstance.destroy();
    
    const maxVal = Math.max(...data) || 1;
    
    const dynamicColors = data.map(val => {
        const intensity = val / maxVal;
        if (intensity > 0.8) return '#ef4444'; 
        if (intensity > 0.5) return '#f59e0b'; 
        if (intensity > 0) return '#3b82f6';   
        return '#e2e8f0';                      
    });
    
    window.hourlyChartInstance = new Chart(ctx, {
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
};

window.renderTopItems = function(topItems) {
    const feed = document.getElementById('top-items-feed');
    if (!feed) return;
    
    if (topItems.length === 0) {
        feed.innerHTML = `<p class="empty-state">No sales data for the selected timeframe.</p>`;
    } else {
        let htmlStr = '';
        topItems.forEach(item => {
            htmlStr += `
                <div class="top-item-card">
                    <span class="top-item-name">${item.name}</span>
                    <span class="top-item-stats">${item.qty} units • ₹${item.revenue}</span>
                </div>
            `;
        });
        feed.innerHTML = htmlStr;
    }
};

window.renderVIPCustomers = function(topCustomers) {
    let vipFeed = document.getElementById('vip-customers-feed');
    if (!vipFeed) return;

    if (topCustomers.length === 0) {
        vipFeed.innerHTML = `<p class="empty-state">No customer data for this period.</p>`;
    } else {
        let htmlStr = '';
        topCustomers.forEach(c => {
            htmlStr += `
                <div class="top-item-card" style="border-left: 4px solid #D4AF37;">
                    <span class="top-item-name">${c.name} <span style="font-size:11px; color:#94A3B8; font-weight:normal; margin-left:8px;">${c.phone}</span></span>
                    <span class="top-item-stats">${c.orders} Orders • ₹${c.revenue.toFixed(2)}</span>
                </div>
            `;
        });
        vipFeed.innerHTML = htmlStr;
    }
};

window.renderWastageKPIs = function(totalRTVValue, totalRTVItems, totalExpiredValue, totalExpiredItems) {
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
};

window.renderWastageFeed = function(rtvList, expiredList) {
    const wastageFeed = document.getElementById('wastage-returns-feed');
    if (!wastageFeed) return;
    
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
};

window.renderLeaderboard = function(data) {
    const feed = document.getElementById('leaderboard-feed');
    if (!feed) return;

    if (data && data.length > 0) {
        let htmlStr = '';
        data.forEach((staff, index) => {
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

            htmlStr += `
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
        feed.innerHTML = htmlStr;
    } else {
        feed.innerHTML = '<p class="empty-state">No shift data available for leaderboard.</p>';
    }
};
