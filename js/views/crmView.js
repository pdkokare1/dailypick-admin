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
