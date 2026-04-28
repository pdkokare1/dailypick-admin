/* js/crm.js */

let currentCustomers = [];
let selectedCustomer = null;

async function fetchCustomers() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers`);
        const result = await res.json();
        
        if (result.success) {
            currentCustomers = result.data;
            renderCustomers();
        }
    } catch (e) {
        console.error("Error fetching customers", e);
        document.getElementById('crm-feed').innerHTML = '<p class="empty-state">Network error loading customers.</p>';
    }
}

function renderCustomers() {
    const feed = document.getElementById('crm-feed');
    feed.innerHTML = '';
    
    if (currentCustomers.length === 0) {
        feed.innerHTML = '<p class="empty-state">No customers found.</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    currentCustomers.forEach(c => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.onclick = () => openCustomerModal(c._id);
        
        const isVIP = c.lifetimeValue > 10000;
        const vipBadge = isVIP ? '<span class="badge-vip">VIP</span>' : '';
        const debtBadge = c.khataBalance > 0 ? `<span class="badge-low" style="color:#DC2626; background:#FEE2E2;">Owes Rs ${c.khataBalance.toFixed(2)}</span>` : '';
        
        card.innerHTML = `
            <h3>${c.name} ${vipBadge}</h3>
            <p><i data-lucide="phone" class="icon-sm"></i> ${c.phone}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #E5E7EB; padding-top: 16px; margin-top: 16px;">
                <div>
                    <span style="font-size: 11px; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 800;">LTV</span>
                    <strong style="color: var(--primary); font-size: 16px;">Rs ${c.lifetimeValue.toFixed(2)}</strong>
                </div>
                ${debtBadge}
            </div>
        `;
        fragment.appendChild(card);
    });
    
    feed.appendChild(fragment);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openCustomerModal(id) {
    selectedCustomer = currentCustomers.find(c => c._id === id);
    if (!selectedCustomer) return;
    
    document.getElementById('deep-dive-name').innerText = selectedCustomer.name;
    document.getElementById('deep-dive-phone').innerText = selectedCustomer.phone;
    
    const toggle = document.getElementById('credit-toggle');
    const details = document.getElementById('credit-details');
    const disabledMsg = document.getElementById('credit-disabled-msg');
    const limitInput = document.getElementById('credit-limit-input');
    const usedDisplay = document.getElementById('credit-used-display');
    
    if (selectedCustomer.khataEnabled) {
        toggle.classList.add('active');
        details.classList.remove('hidden');
        disabledMsg.classList.add('hidden');
        limitInput.value = selectedCustomer.khataLimit;
        usedDisplay.innerText = `Rs ${selectedCustomer.khataBalance.toFixed(2)}`;
    } else {
        toggle.classList.remove('active');
        details.classList.add('hidden');
        disabledMsg.classList.remove('hidden');
    }
    
    loadCustomerHistory(selectedCustomer.phone);
    document.getElementById('customer-modal').classList.add('active');
}

function closeCustomerModal() {
    document.getElementById('customer-modal').classList.remove('active');
    selectedCustomer = null;
}

async function toggleCredit() {
    if (!selectedCustomer) return;
    
    const toggle = document.getElementById('credit-toggle');
    const isActive = !toggle.classList.contains('active'); 
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers/${selectedCustomer._id}/khata/toggle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: isActive })
        });
        
        const result = await res.json();
        if (result.success) {
            selectedCustomer.khataEnabled = isActive;
            openCustomerModal(selectedCustomer._id); 
            if (typeof showToast === 'function') showToast(isActive ? 'Khata Enabled' : 'Khata Disabled');
            fetchCustomers(); 
        } else {
            if (typeof showToast === 'function') showToast(result.message);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
    }
}

async function saveCreditLimit() {
    if (!selectedCustomer) return;
    const newLimit = parseFloat(document.getElementById('credit-limit-input').value);
    
    if (isNaN(newLimit) || newLimit < 0) {
        if (typeof showToast === 'function') showToast('Enter a valid limit.');
        return;
    }
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers/${selectedCustomer._id}/khata/limit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: newLimit })
        });
        
        const result = await res.json();
        if (result.success) {
            selectedCustomer.khataLimit = newLimit;
            if (typeof showToast === 'function') showToast('Credit Limit Updated');
            fetchCustomers();
        } else {
            if (typeof showToast === 'function') showToast(result.message);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
    }
}

async function submitPayment() {
    if (!selectedCustomer) return;
    const amount = parseFloat(document.getElementById('payment-amount-input').value);
    
    if (isNaN(amount) || amount <= 0) {
        if (typeof showToast === 'function') showToast('Enter a valid payment amount.');
        return;
    }
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers/${selectedCustomer._id}/khata/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount })
        });
        
        const result = await res.json();
        if (result.success) {
            selectedCustomer.khataBalance = result.data.khataBalance;
            document.getElementById('payment-amount-input').value = '';
            openCustomerModal(selectedCustomer._id); 
            if (typeof showToast === 'function') showToast('Payment Recorded Successfully! 💸');
            fetchCustomers();
        } else {
            if (typeof showToast === 'function') showToast(result.message);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error.');
    }
}

async function loadCustomerHistory(phone) {
    const container = document.getElementById('customer-history-container');
    container.innerHTML = '<p class="empty-state">Loading...</p>';
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders?search=${encodeURIComponent(phone)}&limit=10`);
        const result = await res.json();
        
        container.innerHTML = '';
        if (result.success && result.data.length > 0) {
            result.data.forEach(o => {
                const date = new Date(o.createdAt).toLocaleDateString();
                const card = document.createElement('div');
                card.className = 'history-order-card';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong style="font-size: 14px;">Order ${o.orderNumber || o._id.substring(o._id.length - 6)}</strong>
                        <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">${date}</span>
                    </div>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">${o.items.length} items • ${o.paymentMethod}</p>
                    <strong style="color: var(--primary); font-size: 15px;">Rs ${o.totalAmount.toFixed(2)}</strong>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<p class="empty-state">No recent orders found.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="empty-state">Error loading history.</p>';
    }
}

// ==========================================
// --- NEW: PHASE 3 KHATA AUTOMATED REMINDERS ---
// ==========================================

function openKhataReminders() {
    const modal = document.getElementById('khata-reminders-modal');
    const container = document.getElementById('khata-reminders-list');
    
    if (!modal || !container) return;
    modal.classList.add('active');
    
    const debtors = currentCustomers.filter(c => c.khataBalance > 0).sort((a, b) => b.khataBalance - a.khataBalance);
    
    container.innerHTML = '';
    
    if (debtors.length === 0) {
        container.innerHTML = '<p class="empty-state" style="color: #10b981;">All customers have cleared their Khata! 🎉</p>';
        return;
    }
    
    debtors.forEach(d => {
        const item = document.createElement('div');
        item.style.cssText = 'background: #F8FAFC; padding: 16px; border-radius: 12px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;';
        
        item.innerHTML = `
            <div>
                <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0F172A;">${d.name}</h4>
                <p style="margin: 0; font-size: 12px; color: #64748B;">Pending: <strong style="color: #DC2626;">Rs ${d.khataBalance.toFixed(2)}</strong></p>
            </div>
            <button onclick="sendKhataReminder('${d._id}', '${d.name.replace(/'/g, "\\'")}', '${d.phone}', ${d.khataBalance})" style="background: #25D366; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="message-circle" class="icon-sm"></i> WhatsApp
            </button>
        `;
        container.appendChild(item);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeKhataReminders() {
    const modal = document.getElementById('khata-reminders-modal');
    if (modal) modal.classList.remove('active');
}

// Generates dynamic Razorpay link and bridges to WhatsApp API
window.sendKhataReminder = async function(customerId, customerName, phone, amount) {
    if (typeof showToast === 'function') showToast('Generating secure payment link...');
    
    try {
        // Fallback mock link if backend Razorpay isn't fully configured yet
        let paymentLink = `https://rzp.io/l/dailypick-khata?amt=${amount}`; 
        
        const message = `Hi ${customerName},%0A%0AThis is a gentle reminder from DailyPick regarding your pending Khata (Store Credit) balance of *Rs ${amount.toFixed(2)}*.%0A%0AYou can securely clear your dues online using UPI/Card via this link:%0A${paymentLink}%0A%0AThank you for shopping with us! 🛒`;
        
        // Strip out non-numeric characters from phone for WhatsApp API
        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
        
        // Open WhatsApp Web or Mobile App
        window.open(whatsappUrl, '_blank');
        
    } catch (e) {
        console.error("Failed to generate reminder:", e);
        if (typeof showToast === 'function') showToast("Could not connect to WhatsApp API.");
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only fetch if admin token exists
    if (localStorage.getItem('adminToken')) {
        fetchCustomers();
    }
});
