/* js/modules/adminFinancials.js */
// Extracted from adminDashboard.js

window.openAIForecastModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('ai-forecast-modal', true);
    await window.generateAIForecast();
};

window.closeAIForecastModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('ai-forecast-modal', false);
};

window.generateAIForecast = async function() {
    const container = document.getElementById('ai-forecast-container');
    
    // Reset to loading state
    container.innerHTML = `
        <div class="skeleton" style="height: 60px;"></div>
        <div class="skeleton" style="height: 60px;"></div>
        <div class="skeleton" style="height: 60px;"></div>
    `;

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/analytics/forecast`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success && data.data && data.data.recommendations) {
            container.innerHTML = '';
            
            if (data.data.recommendations.length === 0) {
                container.innerHTML = `<p class="empty-state" style="color: #10b981;">${data.data.message || 'Inventory is healthy. No critical action needed.'}</p>`;
                return;
            }

            data.data.recommendations.forEach(rec => {
                let badgeColor = rec.priority === 'CRITICAL' ? '#ef4444' : (rec.priority === 'HIGH' ? '#f59e0b' : '#3b82f6');
                
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; border-left: 4px solid ${badgeColor};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <strong style="font-size:15px; color:var(--text-main);">${rec.itemName}</strong>
                            <span style="background:${badgeColor}20; color:${badgeColor}; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px;">${rec.priority}</span>
                        </div>
                        <p style="font-size:13px; font-weight:700; color:var(--primary); margin-bottom:4px;"><i data-lucide="zap" class="icon-sm"></i> Action: ${rec.suggestedAction}</p>
                        <p style="font-size:12px; color:var(--text-muted); line-height:1.4;">${rec.reasoning}</p>
                    </div>
                `;
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            container.innerHTML = `<p class="empty-state" style="color:#ef4444;">${data.message || 'Could not generate forecast.'}</p>`;
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Network Error while contacting AI Engine.</p>`;
    }
};

window.openSourcingModal = function() {
    const listContainer = document.getElementById('sourcing-list-container');
    listContainer.innerHTML = '';
    
    let supplierMap = {};
    
    if (typeof currentInventory !== 'undefined') {
        currentInventory.forEach(p => {
            if(p.variants) {
                p.variants.forEach(v => {
                    if(v.stock <= (v.lowStockThreshold || 5)) {
                        let dist = p.distributorName || 'Unassigned Supplier';
                        if(!supplierMap[dist]) supplierMap[dist] = [];
                        supplierMap[dist].push(`${p.name} (${v.weightOrVolume}) - Current Stock: ${v.stock}`);
                    }
                });
            }
        });
    }
    
    if(Object.keys(supplierMap).length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Inventory is healthy. No items require sourcing.</p>';
    } else {
        Object.keys(supplierMap).forEach(dist => {
            const items = supplierMap[dist];
            const safeItemsJson = JSON.stringify(items).replace(/"/g, '&quot;');
            
            const msg = `Hi ${dist},%0AWe need to restock the following items for our supermarket:%0A%0A` + items.map(i => `- ${i}`).join('%0A') + `%0A%0APlease arrange delivery ASAP.`;
            
            listContainer.innerHTML += `
                <div class="sourcing-item">
                    <div>
                        <h4 style="font-size:14px; margin-bottom:4px;">${dist}</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">${items.length} items to order</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="primary-btn-small" style="background:#ef4444; color:white; border:none;" onclick="generatePDFPO('${dist}', ${safeItemsJson})" title="Download PDF PO"><i data-lucide="file-text" class="icon-sm" style="margin:0;"></i></button>
                        <a href="https://wa.me/?text=${msg}" target="_blank" class="whatsapp-btn" style="margin:0;"><i data-lucide="message-circle" class="icon-sm"></i> WhatsApp</a>
                    </div>
                </div>
            `;
        });
    }
    
    if (typeof window.toggleModal === 'function') window.toggleModal('sourcing-modal', true);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.generatePDFPO = function(distributorName, itemsList) {
    if (typeof window.jspdf === 'undefined') {
        if (typeof showToast === 'function') return showToast("PDF Library is still loading...");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let storeName = (globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
    let storeAddress = (globalStoreSettings && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "Retail Supermarket";
    let gstin = (globalStoreSettings && globalStoreSettings.gstin) ? globalStoreSettings.gstin : "N/A";
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PURCHASE ORDER", 105, 20, null, null, "center");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Buyer: ${storeName}`, 14, 35);
    doc.text(`Address: ${storeAddress}`, 14, 40);
    doc.text(`GSTIN: ${gstin}`, 14, 45);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Supplier: ${distributorName}`, 140, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 40);
    doc.text(`PO Ref: PO-${Date.now().toString().slice(-6)}`, 140, 45);
    
    const tableData = itemsList.map((itemStr, index) => {
        const parts = itemStr.split(' - Current Stock: ');
        return [
            index + 1,
            parts[0] || itemStr,
            "10 (Suggested)", 
            "__________" 
        ];
    });

    doc.autoTable({
        startY: 55,
        head: [['#', 'Item Description', 'Requested Qty', 'Unit Price']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [6, 44, 30] }, 
        styles: { fontSize: 10 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 60;
    doc.text("Authorized Signature: _______________________", 14, finalY + 30);
    
    doc.save(`PO_${distributorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    if (typeof showToast === 'function') showToast(`PDF Generated for ${distributorName}`);
};

window.exportPnLReport = async function() {
    if (typeof window.jspdf === 'undefined') {
        if (typeof showToast === 'function') return showToast("PDF Library loading...");
        return;
    }
    
    if (typeof showToast === 'function') showToast("Calculating Financials...");
    
    try {
        const d = new Date();
        const endDate = d.toISOString();
        d.setDate(d.getDate() - 30);
        const startDate = d.toISOString();
        
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/analytics/pnl?startDate=${startDate}&endDate=${endDate}`);
        const data = await res.json();
        
        if (!data.success || !data.data) {
            if (typeof showToast === 'function') return showToast("Failed to fetch financial data.");
            return;
        }
        
        const metrics = data.data;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let storeName = (globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(`${storeName} - Financial Report (P&L)`, 105, 20, null, null, "center");
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Report Period: Last 30 Days (${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()})`, 105, 28, null, null, "center");
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 105, 33, null, null, "center");

        const tableData = [
            ['Gross Revenue (Sales)', `Rs. ${metrics.totalRevenue.toFixed(2)}`],
            ['Cost of Goods Sold (COGS)', `- Rs. ${metrics.totalCOGS.toFixed(2)}`],
            ['Taxes Collected (GST)', `- Rs. ${metrics.totalTax.toFixed(2)}`],
            ['Discounts Provided', `- Rs. ${metrics.totalDiscounts.toFixed(2)}`],
            ['Gross Profit', `Rs. ${metrics.grossProfit.toFixed(2)}`],
            ['Operational Expenses', `- Rs. ${metrics.totalExpenses.toFixed(2)}`],
            ['Net Profit / Loss', `Rs. ${metrics.netProfit.toFixed(2)}`]
        ];

        doc.autoTable({
            startY: 45,
            head: [['Financial Metric', 'Value (INR)']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }, 
            styles: { fontSize: 11, cellPadding: 6 },
            didParseCell: function(data) {
                if (data.row.index === 4 || data.row.index === 6) { 
                    data.cell.styles.fontStyle = 'bold';
                    if (data.row.index === 6) {
                        data.cell.styles.textColor = metrics.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68];
                    }
                }
            }
        });
        
        doc.save(`${storeName.replace(/\s+/g, '_')}_PnL_Report.pdf`);
        if (typeof showToast === 'function') showToast("P&L Report Downloaded!");

    } catch (e) {
        if (typeof showToast === 'function') showToast("Error generating P&L.");
    }
};

// --- NEW: VENDOR SETTLEMENT UI GENERATOR ---
window.openVendorLedgerModal = async function() {
    let modal = document.getElementById('vendor-ledger-modal');
    
    // Dynamically inject the modal if it doesn't exist yet
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'vendor-ledger-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Gamut Settlements & Payouts</h2>
                    <button class="close-btn" onclick="document.getElementById('vendor-ledger-modal').classList.remove('active')">&times;</button>
                </div>
                <div class="modal-body" id="vendor-ledger-container" style="max-height: 400px; overflow-y: auto;">
                    <p class="empty-state">Loading your financial ledger...</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.classList.add('active');
    const container = document.getElementById('vendor-ledger-container');
    container.innerHTML = '<p class="empty-state">Loading your financial ledger...</p>';

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const BACKEND_URL = typeof CONFIG !== 'undefined' ? CONFIG.BACKEND_URL : window.BACKEND_URL;
        
        // Fetch settlements specific to this logged-in store
        const res = await fetchFn(`${BACKEND_URL}/api/settlements`);
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
            let html = '';
            let totalOwed = 0;

            result.data.forEach(s => {
                if (s.status === 'Pending') totalOwed += s.netPayoutToStore;

                const statusColor = s.status === 'Pending' ? '#f59e0b' : (s.status === 'Paid' ? '#10b981' : '#ef4444');
                
                html += `
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                            <strong style="font-size: 14px;">Order #${s.orderNumber}</strong>
                            <span style="color:${statusColor}; font-weight:800; font-size:12px;">${s.status}</span>
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                            Gamut Commission Deducted: Rs ${s.platformCommission}
                        </div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                            Net Payout to You: Rs ${s.netPayoutToStore}
                        </div>
                    </div>
                `;
            });

            const headerHtml = `
                <div style="background: #e0e7ff; padding: 16px; border-radius: 8px; border: 1px solid #c7d2fe; margin-bottom: 16px; text-align: center;">
                    <p style="font-size: 12px; color: #3730a3; font-weight: 600;">Total Pending Payout from Gamut</p>
                    <h2 style="font-size: 24px; color: #312e81; margin: 4px 0 0 0;">Rs ${totalOwed.toFixed(2)}</h2>
                </div>
            `;

            container.innerHTML = headerHtml + html;
        } else {
            container.innerHTML = '<p class="empty-state">No settlement data found. You have no pending payouts.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color:#ef4444;">Network error while fetching ledger.</p>';
    }
};
