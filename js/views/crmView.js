/* js/views/crmView.js */

window.renderCustomerList = function(customers) {
    const feed = document.getElementById('crm-feed');
    if (!feed) return;

    if (customers.length === 0) {
        feed.innerHTML = '<p class="empty-state">No customers found.</p>';
        return;
    }

    const today = new Date();
    let htmlStr = '';

    customers.forEach(c => {
        const wLink = `https://wa.me/91${c.phone}?text=Hi%20${c.name.split(' ')[0]},%20here%20is%20a%20special%20offer%20from%20DailyPick!`;
        
        let badges = '';
        if (c.lifetimeValue > 2000) badges += `<span class="badge-vip">🌟 VIP</span>`;
        
        const lastOrderDate = new Date(c.lastOrderDate);
        const daysSinceLastOrder = (today - lastOrderDate) / (1000 * 60 * 60 * 24);
        if (daysSinceLastOrder > 30) badges += `<span class="badge-churn">⚠️ Churn Risk</span>`;

        htmlStr += `
            <div class="customer-card" onclick="if(typeof openCustomerModal === 'function') openCustomerModal('${c.phone}', '${c.name.replace(/'/g, "\\'")}')">
                <h3>${c.name} ${badges}</h3>
                <p>📞 ${c.phone}</p>
                <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom: 12px;">
                    <span>Orders: ${c.orderCount}</span>
                    <span style="color:#0A3622;">LTV: ₹${c.lifetimeValue}</span>
                </div>
                <div style="display:flex; gap: 8px;" onclick="event.stopPropagation()">
                    <a href="${wLink}" target="_blank" class="whatsapp-btn">💬 Promo Message</a>
                    <button class="history-btn" onclick="if(typeof openCustomerModal === 'function') openCustomerModal('${c.phone}', '${c.name.replace(/'/g, "\\'")}')">View History</button>
                </div>
            </div>
        `;
    });

    feed.innerHTML = htmlStr;
};

window.renderCustomerHistory = function(customerOrders) {
    const container = document.getElementById('customer-history-container');
    if (!container) return;
    container.innerHTML = '';

    if (customerOrders.length === 0) {
        container.innerHTML = '<p class="empty-state">No orders found.</p>';
    } else {
        const fragment = document.createDocumentFragment();

        customerOrders.forEach(o => {
            const dateStr = new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const itemPreview = o.items.map(i => `${i.qty}x ${i.name}`).join(', ').substring(0, 40) + '...';
            
            const div = document.createElement('div');
            div.className = 'history-order-card';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${dateStr}</span>
                    <span style="font-size: 11px; font-weight: 800; color: var(--primary);">₹${o.totalAmount}</span>
                </div>
                <p style="font-size: 12px; color: var(--text-main); font-weight: 600; margin-bottom: 4px;">${o.deliveryType} Delivery</p>
                <p style="font-size: 11px; color: var(--text-muted);">${itemPreview}</p>
            `;
            fragment.appendChild(div);
        });

        container.appendChild(fragment);
    }
};

window.updateCreditProfileUI = function(isSuccess, data) {
    const toggle = document.getElementById('credit-toggle');
    const details = document.getElementById('credit-details');
    const msg = document.getElementById('credit-disabled-msg');
    
    if (!toggle || !details || !msg) return;

    if (isSuccess && data) {
        document.getElementById('credit-limit-input').value = data.creditLimit || 0;
        document.getElementById('credit-used-display').innerText = `₹${data.creditUsed || 0}`;
        
        if (data.isCreditEnabled) {
            toggle.classList.add('active');
            details.classList.remove('hidden');
            msg.classList.add('hidden');
        } else {
            toggle.classList.remove('active');
            details.classList.add('hidden');
            msg.innerText = "Credit facility is currently disabled for this user.";
            msg.classList.remove('hidden');
        }
    } else {
        document.getElementById('credit-limit-input').value = 0;
        document.getElementById('credit-used-display').innerText = `₹0`;
        toggle.classList.remove('active');
        details.classList.remove('hidden');
        if (data === 'loading') {
            msg.innerText = "Loading credit profile...";
            msg.classList.remove('hidden');
        } else {
            msg.innerText = "Failed to load credit profile or currently disabled.";
            msg.classList.remove('hidden');
        }
    }
};

window.renderKhataRemindersList = function(debtors) {
    const container = document.getElementById('khata-reminders-list');
    if (!container) return;

    if (!debtors || debtors.length === 0) {
        container.innerHTML = '<p class="empty-state">🎉 Great news! No customers currently owe any Khata balances.</p>';
        return;
    }

    let htmlStr = '';
    debtors.forEach(c => {
        const message = `Hi ${c.name.split(' ')[0]}, a gentle reminder from DailyPick that your pending Khata balance is ₹${c.creditUsed}. Please settle it at your earliest convenience. Thank you!`;
        const wLink = `https://wa.me/91${c.phone}?text=${encodeURIComponent(message)}`;
        
        htmlStr += `
            <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                    <h4 style="margin: 0; font-size: 14px; color: var(--text-main);">${c.name}</h4>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #DC2626; font-weight: 700;">Owes: ₹${c.creditUsed}</p>
                </div>
                <a href="${wLink}" target="_blank" class="primary-btn-small" style="background: #25D366; text-decoration: none;">💬 WhatsApp</a>
            </div>
        `;
    });
    container.innerHTML = htmlStr;
};

// ============================================================================
// --- NEW: PHASE 4 ENTERPRISE DEVELOPER PORTAL LOGIC ---
// ============================================================================

window.openDeveloperPortal = async function() {
    const modal = document.getElementById('developer-portal-modal');
    if (!modal) return;
    
    modal.classList.add('active');
    
    // Check DLQ health immediately
    if (typeof window.fetchFailedWebhooks === 'function') {
        window.fetchFailedWebhooks();
    }
    
    try {
        // Automatically fetch the current store's existing integration details
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/stores/my-store`);
        const result = await res.json();
        
        if (result.success && result.data && result.data.apiIntegration) {
            const apiBox = document.getElementById('dev-api-key-box');
            const webhookBox = document.getElementById('dev-webhook-url');
            
            if (apiBox && result.data.apiIntegration.apiSecretKey) {
                apiBox.value = result.data.apiIntegration.apiSecretKey;
            }
            if (webhookBox && result.data.apiIntegration.webhookUrl) {
                webhookBox.value = result.data.apiIntegration.webhookUrl;
            }
        }
    } catch (e) {
        console.warn('Could not fetch existing enterprise integrations.', e);
    }
};

window.generatePartnerKey = async function() {
    if(!confirm("⚠️ Warning: Generating a new key will instantly invalidate your old key. All active ERP integrations will disconnect until updated. Continue?")) return;
    
    const btn = document.getElementById('generate-key-btn');
    const ogText = btn.innerText;
    btn.innerText = 'Generating...';
    btn.disabled = true;
    
    try {
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/generate-key`, { method: 'POST' });
        const result = await res.json();
        
        if (result.success) {
            document.getElementById('dev-api-key-box').value = result.apiKey;
            if(typeof window.showToast === 'function') window.showToast("New Enterprise API Key generated successfully! 🎉");
        } else {
            if(typeof window.showToast === 'function') window.showToast(result.message || "Failed to generate API key.");
        }
    } catch(e) {
        if(typeof window.showToast === 'function') window.showToast("Network error. Please try again.");
    } finally {
        btn.innerText = ogText;
        btn.disabled = false;
    }
};

window.savePartnerWebhook = async function() {
    const urlInput = document.getElementById('dev-webhook-url');
    const btn = document.getElementById('save-webhook-btn');
    const url = urlInput ? urlInput.value.trim() : '';
    
    if(!url || !url.startsWith('http')) {
        if(typeof window.showToast === 'function') window.showToast("Please enter a valid HTTP/HTTPS URL.");
        return;
    }
    
    const ogText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    try {
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/webhook`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: url })
        });
        const result = await res.json();
        
        if(result.success) {
            if(typeof window.showToast === 'function') window.showToast("Fulfillment Webhook URL saved securely! 🚀");
        } else {
            if(typeof window.showToast === 'function') window.showToast(result.message || "Failed to save Webhook URL.");
        }
    } catch(e) {
        if(typeof window.showToast === 'function') window.showToast("Network error. Please try again.");
    } finally {
        btn.innerText = ogText;
        btn.disabled = false;
    }
};

// ============================================================================
// --- NEW: PHASE 5 DEAD LETTER QUEUE (DLQ) RETRY ENGINE ---
// ============================================================================

window.fetchFailedWebhooks = async function() {
    const container = document.getElementById('dlq-logs-container');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">Analyzing logs...</p>';
    try {
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/webhooks/failed`);
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
            let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
            result.data.forEach(log => {
                html += `
                    <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="margin: 0; font-size: 12px; font-weight: 800; color: #7F1D1D;">Error: ${log.error}</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #991B1B;">Endpoint: ${log.webhookUrl}</p>
                        </div>
                        <button class="primary-btn-small" style="background: #DC2626;" onclick="retryWebhook('${log._id}', this)">Retry</button>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="empty-state" style="color: #10B981; margin:0;">✅ System Healthy. No failed webhooks detected.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color: #DC2626; margin:0;">Failed to load DLQ status.</p>';
    }
};

window.retryWebhook = async function(id, btn) {
    const ogText = btn.innerText;
    btn.innerText = 'Retrying...';
    btn.disabled = true;
    try {
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/webhooks/retry/${id}`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            if(typeof window.showToast === 'function') window.showToast("Webhook retry successful! 🚀");
            window.fetchFailedWebhooks(); // Refresh list immediately
        } else {
            if(typeof window.showToast === 'function') window.showToast("Retry failed: " + result.message);
            btn.innerText = 'Failed';
        }
    } catch(e) {
        if(typeof window.showToast === 'function') window.showToast("Network error during retry.");
        btn.innerText = 'Retry';
        btn.disabled = false;
    }
};

// ============================================================================
// --- NEW: PHASE 5 B2B WHOLESALE PROCUREMENT ENGINE ---
// ============================================================================

window.openB2BMarketplace = function() {
    const modal = document.getElementById('b2b-marketplace-modal');
    if (modal) {
        modal.classList.add('active');
        window.fetchWholesaleCatalog();
    }
};

window.fetchWholesaleCatalog = async function() {
    const container = document.getElementById('b2b-catalog-container');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">Loading Wholesale Catalog...</p>';
    try {
        // Fetch the master catalog
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/catalog`);
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
            let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">';
            result.data.forEach(item => {
                const variant = item.variants && item.variants[0] ? item.variants[0] : null;
                if(!variant) return;
                
                html += `
                    <div style="background: white; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: var(--text-main);">${item.name}</h4>
                        <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--text-muted);">SKU: ${variant.sku}</p>
                        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                            <input type="number" id="b2b-qty-${item._id}" placeholder="Qty" min="1" value="10" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #CBD5E1; font-weight: 700;">
                            <input type="text" id="b2b-pincode-${item._id}" placeholder="Pincode" value="411033" style="width: 100px; padding: 8px; border-radius: 6px; border: 1px solid #CBD5E1; font-weight: 700;">
                        </div>
                        <button class="primary-btn-small" style="width: 100%; background: #0EA5E9;" onclick="submitB2BOrder('${item._id}', '${variant._id}')">Route PO to Supplier</button>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="empty-state">No wholesale items available.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state" style="color: #DC2626;">Failed to load catalog.</p>';
    }
};

window.submitB2BOrder = async function(masterProductId, variantId) {
    const qtyInput = document.getElementById(`b2b-qty-${masterProductId}`);
    const pincodeInput = document.getElementById(`b2b-pincode-${masterProductId}`);
    const qty = qtyInput ? qtyInput.value : null;
    const pincode = pincodeInput ? pincodeInput.value : null;
    
    if(!qty || !pincode) {
        if(typeof window.showToast === 'function') window.showToast("Please enter Qty and Pincode.");
        return;
    }

    try {
        // The endpoint we built in Phase 1
        const res = await window.storeFetchWithAuth(`${window.BACKEND_URL || 'https://dailypick-backend-production-05d6.up.railway.app'}/api/enterprise/procurement/create-po`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeId: 'DUMMY_STORE_IF_NOT_IN_TOKEN', // Fallback, backend relies on JWT tenantId first
                masterProductId,
                variantId,
                requestedQty: Number(qty),
                deliveryPincode: pincode
            })
        });
        const result = await res.json();
        
        if (result.success) {
            if(typeof window.showToast === 'function') window.showToast(`🎉 PO Drafted: Route found via ${result.data.distributorName} at Rs ${result.data.unitPriceRs}/unit.`);
        } else {
            if(typeof window.showToast === 'function') window.showToast(result.message || "Failed to draft Purchase Order.");
        }
    } catch(e) {
        if(typeof window.showToast === 'function') window.showToast("Network error while submitting PO.");
    }
};
