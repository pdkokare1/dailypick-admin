/* js/crm.js */

async function fetchCustomers() {
    const feed = document.getElementById('crm-feed');
    feed.innerHTML = '<p class="empty-state">Loading customers...</p>';
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/customers`);
        const result = await res.json();
        
        if (result.success) {
            feed.innerHTML = '';
            if (result.data.length === 0) {
                feed.innerHTML = '<p class="empty-state">No customers found.</p>';
                return;
            }
            
            if (allHistoricalOrders.length === 0) {
                const orderRes = await fetch(`${BACKEND_URL}/api/orders`);
                const orderData = await orderRes.json();
                if(orderData.success) allHistoricalOrders = orderData.data;
            }

            const today = new Date();

            result.data.forEach(c => {
                const wLink = `https://wa.me/91${c.phone}?text=Hi%20${c.name.split(' ')[0]},%20here%20is%20a%20special%20offer%20from%20DailyPick!`;
                
                let badges = '';
                if (c.lifetimeValue > 2000) {
                    badges += `<span class="badge-vip">🌟 VIP</span>`;
                }
                const lastOrderDate = new Date(c.lastOrderDate);
                const daysSinceLastOrder = (today - lastOrderDate) / (1000 * 60 * 60 * 24);
                if (daysSinceLastOrder > 30) {
                    badges += `<span class="badge-churn">⚠️ Churn Risk</span>`;
                }

                feed.innerHTML += `
                    <div class="customer-card" onclick="openCustomerModal('${c.phone}', '${c.name.replace(/'/g, "\\'")}')">
                        <h3>${c.name} ${badges}</h3>
                        <p>📞 ${c.phone}</p>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom: 12px;">
                            <span>Orders: ${c.orderCount}</span>
                            <span style="color:#0A3622;">LTV: ₹${c.lifetimeValue}</span>
                        </div>
                        <div style="display:flex; gap: 8px;" onclick="event.stopPropagation()">
                            <a href="${wLink}" target="_blank" class="whatsapp-btn">💬 Promo Message</a>
                            <button class="history-btn" onclick="openCustomerModal('${c.phone}', '${c.name.replace(/'/g, "\\'")}')">View History</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch (e) {
        feed.innerHTML = '<p class="empty-state">Error loading CRM.</p>';
    }
}

async function openCustomerModal(phone, name) {
    currentCustomerPhone = phone; 
    document.getElementById('deep-dive-name').innerText = name;
    document.getElementById('deep-dive-phone').innerText = phone;
    
    const container = document.getElementById('customer-history-container');
    container.innerHTML = '';

    const customerOrders = allHistoricalOrders.filter(o => o.customerPhone === phone).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (customerOrders.length === 0) {
        container.innerHTML = '<p class="empty-state">No orders found.</p>';
    } else {
        customerOrders.forEach(o => {
            const dateStr = new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const itemPreview = o.items.map(i => `${i.qty}x ${i.name}`).join(', ').substring(0, 40) + '...';
            
            container.innerHTML += `
                <div class="history-order-card">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${dateStr}</span>
                        <span style="font-size: 11px; font-weight: 800; color: var(--primary);">₹${o.totalAmount}</span>
                    </div>
                    <p style="font-size: 12px; color: var(--text-main); font-weight: 600; margin-bottom: 4px;">${o.deliveryType} Delivery</p>
                    <p style="font-size: 11px; color: var(--text-muted);">${itemPreview}</p>
                </div>
            `;
        });
    }

    await fetchCustomerCreditProfile(phone);

    document.getElementById('customer-modal').classList.add('active');
}

function closeCustomerModal() {
    currentCustomerPhone = null;
    document.getElementById('customer-modal').classList.remove('active');
}

async function fetchCustomerCreditProfile(phone) {
    const toggle = document.getElementById('credit-toggle');
    const details = document.getElementById('credit-details');
    const msg = document.getElementById('credit-disabled-msg');
    
    toggle.classList.remove('active');
    details.classList.add('hidden');
    msg.innerText = "Loading credit profile...";
    msg.classList.remove('hidden');

    try {
        const res = await fetch(`${BACKEND_URL}/api/customers/profile/${phone}`);
        const result = await res.json();
        
        if (result.success && result.data) {
            const p = result.data;
            document.getElementById('credit-limit-input').value = p.creditLimit || 0;
            document.getElementById('credit-used-display').innerText = `₹${p.creditUsed || 0}`;
            
            if (p.isCreditEnabled) {
                toggle.classList.add('active');
                details.classList.remove('hidden');
                msg.classList.add('hidden');
            } else {
                msg.innerText = "Credit facility is currently disabled for this user.";
            }
        } else {
            document.getElementById('credit-limit-input').value = 0;
            document.getElementById('credit-used-display').innerText = `₹0`;
            toggle.classList.remove('active');
            details.classList.remove('hidden');
            msg.classList.add('hidden');
        }
    } catch (e) {
        msg.innerText = "Failed to load credit profile.";
    }
}

async function toggleCredit() {
    if (!currentCustomerPhone) return;
    
    const toggle = document.getElementById('credit-toggle');
    const details = document.getElementById('credit-details');
    const msg = document.getElementById('credit-disabled-msg');
    
    const isCurrentlyActive = toggle.classList.contains('active');
    const newStatus = !isCurrentlyActive; 
    
    const limitInput = document.getElementById('credit-limit-input').value || 0;
    const nameInput = document.getElementById('deep-dive-name').innerText;
    
    if (newStatus) {
        toggle.classList.add('active');
        details.classList.remove('hidden');
        msg.classList.add('hidden');
    } else {
        toggle.classList.remove('active');
        details.classList.add('hidden');
        msg.innerText = "Credit facility is currently disabled for this user.";
        msg.classList.remove('hidden');
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/customers/profile/${currentCustomerPhone}/limit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCreditEnabled: newStatus, creditLimit: limitInput, name: nameInput })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(newStatus ? 'Credit Enabled!' : 'Credit Disabled!');
        } else {
            throw new Error(result.message || 'Failed to update credit status.');
        }
    } catch (e) {
        if (isCurrentlyActive) {
            toggle.classList.add('active');
            details.classList.remove('hidden');
            msg.classList.add('hidden');
        } else {
            toggle.classList.remove('active');
            details.classList.add('hidden');
            msg.classList.remove('hidden');
        }
        showToast('Network error updating credit. Reverting...');
    }
}

async function saveCreditLimit() {
    if (!currentCustomerPhone) return;
    const limitInput = document.getElementById('credit-limit-input').value;
    const nameInput = document.getElementById('deep-dive-name').innerText;
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/customers/profile/${currentCustomerPhone}/limit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCreditEnabled: true, creditLimit: limitInput, name: nameInput })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(`Credit limit saved: ₹${limitInput}`);
        } else {
            showToast(result.message || 'Failed to save limit.');
        }
    } catch (e) {
        showToast('Network error saving limit.');
    }
}

async function submitPayment() {
    if (!currentCustomerPhone) return;
    const paymentInput = document.getElementById('payment-amount-input');
    const amount = Number(paymentInput.value);
    
    if (!amount || amount <= 0) return showToast("Enter a valid payment amount.");
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/customers/profile/${currentCustomerPhone}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount })
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(`Recorded payment of ₹${amount}!`);
            paymentInput.value = ''; 
            document.getElementById('credit-used-display').innerText = `₹${result.data.creditUsed}`;
        } else {
            showToast(result.message || 'Failed to record payment.');
        }
    } catch (e) {
        showToast('Network error processing payment.');
    }
}

// --- Phase 5: Khata Reminders Logic ---
async function openKhataReminders() {
    document.getElementById('khata-reminders-modal').classList.add('active');
    const container = document.getElementById('khata-reminders-list');
    container.innerHTML = '<p class="empty-state">Scanning customer ledgers...</p>';

    try {
        const res = await fetch(`${BACKEND_URL}/api/customers`); 
        
        if (res.ok) {
            const result = await res.json();
            const debtors = result.data.filter(c => c.creditUsed > 0);
            
            if (debtors.length === 0) {
                container.innerHTML = '<p class="empty-state">🎉 Great news! No customers currently owe any Khata balances.</p>';
                return;
            }

            container.innerHTML = '';
            debtors.forEach(c => {
                const message = `Hi ${c.name.split(' ')[0]}, a gentle reminder from DailyPick that your pending Khata balance is ₹${c.creditUsed}. Please settle it at your earliest convenience. Thank you!`;
                const wLink = `https://wa.me/91${c.phone}?text=${encodeURIComponent(message)}`;
                
                container.innerHTML += `
                    <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <h4 style="margin: 0; font-size: 14px; color: var(--text-main);">${c.name}</h4>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #DC2626; font-weight: 700;">Owes: ₹${c.creditUsed}</p>
                        </div>
                        <a href="${wLink}" target="_blank" class="primary-btn-small" style="background: #25D366; text-decoration: none;">💬 WhatsApp</a>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">Failed to load Khata debtors.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state">Network Error fetching ledgers.</p>';
    }
}

function closeKhataReminders() {
    document.getElementById('khata-reminders-modal').classList.remove('active');
}
// ------------------------------------------
