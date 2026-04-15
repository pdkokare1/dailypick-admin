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
    await window.fetchAuditLogs();
};

window.closeSecurityAuditModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('security-audit-modal', false);
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
