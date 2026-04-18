/* js/crm.js */

async function fetchCustomers() {
    const feed = document.getElementById('crm-feed');
    if (feed) feed.innerHTML = '<p class="empty-state">Loading customers...</p>';
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/orders/customers`);
        const result = await res.json();
        
        if (result.success) {
            if (typeof allHistoricalOrders !== 'undefined' && allHistoricalOrders.length === 0) {
                const orderRes = await adminFetchWithAuth(`${BACKEND_URL}/api/orders`);
                const orderData = await orderRes.json();
                if(orderData.success) allHistoricalOrders = orderData.data;
            }

            if (typeof window.renderCustomerList === 'function') {
                window.renderCustomerList(result.data);
            }
        }
    } catch (e) {
        if (feed) feed.innerHTML = '<p class="empty-state">Error loading CRM.</p>';
    }
}

async function openCustomerModal(phone, name) {
    window.currentCustomerPhone = phone; 
    document.getElementById('deep-dive-name').innerText = name;
    document.getElementById('deep-dive-phone').innerText = phone;
    
    let customerOrders = [];
    if (typeof allHistoricalOrders !== 'undefined') {
        customerOrders = allHistoricalOrders.filter(o => o.customerPhone === phone).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (typeof window.renderCustomerHistory === 'function') {
        window.renderCustomerHistory(customerOrders);
    }

    await fetchCustomerCreditProfile(phone);
    document.getElementById('customer-modal').classList.add('active');
}

function closeCustomerModal() {
    window.currentCustomerPhone = null;
    document.getElementById('customer-modal').classList.remove('active');
}

async function fetchCustomerCreditProfile(phone) {
    if (typeof window.updateCreditProfileUI === 'function') {
        window.updateCreditProfileUI(false, 'loading');
    }

    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/customers/profile/${phone}`);
        const result = await res.json();
        
        if (result.success && result.data) {
            if (typeof window.updateCreditProfileUI === 'function') {
                window.updateCreditProfileUI(true, result.data);
            }
        } else {
            if (typeof window.updateCreditProfileUI === 'function') {
                window.updateCreditProfileUI(false, null);
            }
        }
    } catch (e) {
        if (typeof window.updateCreditProfileUI === 'function') {
            window.updateCreditProfileUI(false, null);
        }
    }
}

async function toggleCredit() {
    if (typeof window.currentCustomerPhone === 'undefined' || !window.currentCustomerPhone) return;
    
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
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/customers/profile/${window.currentCustomerPhone}/limit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCreditEnabled: newStatus, creditLimit: limitInput, name: nameInput })
        });
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast(newStatus ? 'Credit Enabled!' : 'Credit Disabled!');
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
        if (typeof showToast === 'function') showToast('Network error updating credit. Reverting...');
    }
}

async function saveCreditLimit() {
    if (typeof window.currentCustomerPhone === 'undefined' || !window.currentCustomerPhone) return;
    const limitInput = document.getElementById('credit-limit-input').value;
    const nameInput = document.getElementById('deep-dive-name').innerText;
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/customers/profile/${window.currentCustomerPhone}/limit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCreditEnabled: true, creditLimit: limitInput, name: nameInput })
        });
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast(`Credit limit saved: ₹${limitInput}`);
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Failed to save limit.');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error saving limit.');
    }
}

async function submitPayment() {
    if (typeof window.currentCustomerPhone === 'undefined' || !window.currentCustomerPhone) return;
    const paymentInput = document.getElementById('payment-amount-input');
    const amount = Number(paymentInput.value);
    
    if (!amount || amount <= 0) {
        if (typeof showToast === 'function') showToast("Enter a valid payment amount.");
        return;
    }
    
    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/customers/profile/${window.currentCustomerPhone}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount })
        });
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast(`Recorded payment of ₹${amount}!`);
            paymentInput.value = ''; 
            document.getElementById('credit-used-display').innerText = `₹${result.data.creditUsed}`;
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Failed to record payment.');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Network error processing payment.');
    }
}

async function openKhataReminders() {
    document.getElementById('khata-reminders-modal').classList.add('active');
    const container = document.getElementById('khata-reminders-list');
    if (container) container.innerHTML = '<p class="empty-state">Scanning customer ledgers...</p>';

    try {
        const res = await adminFetchWithAuth(`${BACKEND_URL}/api/customers`); 
        
        if (res.ok) {
            const result = await res.json();
            const debtors = result.data.filter(c => c.creditUsed > 0);
            
            if (typeof window.renderKhataRemindersList === 'function') {
                window.renderKhataRemindersList(debtors);
            }
        } else {
            if (container) container.innerHTML = '<p class="empty-state">Failed to load Khata debtors.</p>';
        }
    } catch (e) {
        if (container) container.innerHTML = '<p class="empty-state">Network Error fetching ledgers.</p>';
    }
}

function closeKhataReminders() {
    document.getElementById('khata-reminders-modal').classList.remove('active');
}
