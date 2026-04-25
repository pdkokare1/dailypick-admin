/* js/adminDashboard.js */

// ==========================================
// CORE DASHBOARD & SETTINGS ORCHESTRATOR
// Domain-specific logic has been moved to js/modules/
// ==========================================

window.fetchGlobalSettings = async function() {
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/settings`);
        const data = await res.json();
        if (data.success && data.data) {
            globalStoreSettings = data.data;
        }
    } catch (e) {
        console.warn("Could not fetch global settings", e);
    }
};

window.openSettingsModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('global-settings-modal', true);
    else document.getElementById('global-settings-modal').classList.add('active');
    
    await window.fetchGlobalSettings();
    document.getElementById('settings-store-name').value = globalStoreSettings.storeName || 'DAILYPICK.';
    document.getElementById('settings-store-address').value = globalStoreSettings.storeAddress || '';
    document.getElementById('settings-contact-phone').value = globalStoreSettings.contactPhone || '';
    document.getElementById('settings-gstin').value = globalStoreSettings.gstin || '';
    document.getElementById('settings-receipt-footer').value = globalStoreSettings.receiptFooterMessage || 'Thank you for shopping with us!';
    document.getElementById('settings-loyalty-value').value = globalStoreSettings.loyaltyPointValue || 100;
};

window.closeSettingsModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('global-settings-modal', false);
    else document.getElementById('global-settings-modal').classList.remove('active');
};

window.submitSettings = async function(e) {
    e.preventDefault();
    const payload = {
        storeName: document.getElementById('settings-store-name').value,
        storeAddress: document.getElementById('settings-store-address').value,
        contactPhone: document.getElementById('settings-contact-phone').value,
        gstin: document.getElementById('settings-gstin').value,
        receiptFooterMessage: document.getElementById('settings-receipt-footer').value,
        loyaltyPointValue: Number(document.getElementById('settings-loyalty-value').value) || 100
    };

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            globalStoreSettings = data.data;
            if (typeof showToast === 'function') showToast("Global settings updated!");
            closeSettingsModal();
        } else {
            if (typeof showToast === 'function') showToast("Failed to save settings.");
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("Network Error.");
    }
};

window.openSecurityAuditModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('security-audit-modal', true);
    else document.getElementById('security-audit-modal').classList.add('active');
    
    await window.fetchAuditLogs();
};

window.closeSecurityAuditModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('security-audit-modal', false);
    else document.getElementById('security-audit-modal').classList.remove('active');
};

window.fetchAuditLogs = async function() {
    const container = document.getElementById('audit-logs-container');
    container.innerHTML = '<p class="empty-state">Loading logs...</p>';
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/audit?limit=50`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(log => {
                const time = new Date(log.createdAt).toLocaleString();
                const actionColor = log.action.includes('FAILED') ? '#ef4444' : '#3b82f6';
                let detailsHtml = '';
                if (log.details) {
                    detailsHtml = `<p style="font-size: 10px; color: var(--text-muted); margin-top: 4px; font-family: monospace;">${JSON.stringify(log.details)}</p>`;
                }
                container.innerHTML += `
                    <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; border-left: 3px solid ${actionColor};">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size: 13px; color: ${actionColor};">${log.action}</strong>
                            <span style="font-size: 11px; color: var(--text-muted);">${time}</span>
                        </div>
                        <p style="font-size: 12px; font-weight: 600; margin-top: 4px;">User: @${log.username || 'System'}</p>
                        <p style="font-size: 11px; color: var(--text-main); margin-top: 2px;">Target: ${log.targetType} (${log.targetId})</p>
                        ${detailsHtml}
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">No audit logs found.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color:#ef4444;">Error loading logs.</p>';
    }
};

// ==========================================
// --- NEW: SUPERADMIN GLOBAL DASHBOARD ---
// ==========================================

window.openSuperAdminDashboard = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('superadmin-dashboard-modal', true);
    else document.getElementById('superadmin-dashboard-modal').classList.add('active');
    
    if (typeof window.fetchGlobalSettlements === 'function') await window.fetchGlobalSettlements();
    if (typeof window.fetchGlobalDisputes === 'function') await window.fetchGlobalDisputes();
};

window.closeSuperAdminDashboard = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('superadmin-dashboard-modal', false);
    else document.getElementById('superadmin-dashboard-modal').classList.remove('active');
};

window.renderGlobalSettlements = function() {
    const container = document.getElementById('global-settlements-container');
    if (!container) return;
    
    if (!window.globalSettlements || window.globalSettlements.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending settlements found. All partners are paid.</p>';
        return;
    }
    
    let html = '';
    window.globalSettlements.forEach(s => {
        html += `
            <div style="background: #F8FAFC; padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid #E2E8F0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 14px;">Order ${s.orderNumber}</strong>
                    <span style="background: ${s.status === 'Pending' ? '#FEF08A' : '#D9F99D'}; color: ${s.status === 'Pending' ? '#854D0E' : '#166534'}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">${s.status}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">
                    <span>Total Paid: ₹${s.totalOrderValue}</span>
                    <span>Our Cut: <span style="color:#10b981; font-weight:700;">₹${s.platformCommission}</span></span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #CBD5E1;">
                    <span style="font-weight: 800; font-size: 15px; color: var(--primary);">Net Payout: ₹${s.netPayoutToStore}</span>
                    ${s.status === 'Pending' ? `<button class="primary-btn-small" style="background:#0ea5e9; color:white; border:none; padding:6px 12px;" onclick="processSettlement('${s._id}')">Mark as Paid</button>` : ''}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.renderGlobalDisputes = function() {
    const container = document.getElementById('global-disputes-container');
    if (!container) return;
    
    if (!window.globalDisputes || window.globalDisputes.length === 0) {
        container.innerHTML = '<p class="empty-state">No active disputes.</p>';
        return;
    }
    
    let html = '';
    window.globalDisputes.forEach(d => {
        html += `
            <div style="background: #FEF2F2; padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid #FECACA;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 14px; color:#991B1B;">Order ${d.orderNumber}</strong>
                    <span style="background: #EF4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">Disputed</span>
                </div>
                <p style="font-size: 13px; color: #7F1D1D; margin-bottom: 12px;"><strong>Reason:</strong> ${d.disputeReason}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #FCA5A5;">
                    <span style="font-weight: 800; font-size: 15px; color: #991B1B;">Frozen Payout: ₹${d.netPayoutToStore}</span>
                    <button class="primary-btn-small" style="background:#DC2626; color:white; border:none; padding:6px 12px;" onclick="resolveDispute('${d._id}')">Resolve & Void</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.processSettlement = async function(id) {
    if(!confirm("Have you sent the bank transfer? This will mark the ledger as processed.")) return;
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/settlements/${id}/process`, { method: 'PUT' });
        const data = await res.json();
        if(data.success) {
            if (typeof showToast === 'function') showToast("Payout processed & logged!");
            window.fetchGlobalSettlements();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Failed to process.");
        }
    } catch(e) {
        console.error(e);
    }
};

window.resolveDispute = async function(id) {
    if(!confirm("This will void the payout to the partner. Continue?")) return;
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/settlements/${id}/resolve`, { method: 'PUT' });
        const data = await res.json();
        if(data.success) {
            if (typeof showToast === 'function') showToast("Dispute resolved!");
            window.fetchGlobalDisputes();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Failed to resolve.");
        }
    } catch(e) {
        console.error(e);
    }
};
