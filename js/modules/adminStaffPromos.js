/* js/modules/adminStaffPromos.js */
// Extracted from adminDashboard.js 

window.openStaffModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('staff-modal', true);
    await fetchStaff();
};

window.closeStaffModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('staff-modal', false);
};

window.fetchStaff = async function() {
    const container = document.getElementById('staff-list-container');
    container.innerHTML = '<p class="empty-state">Loading staff...</p>';
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/users/staff`); 
        if (!res.ok) throw new Error('Failed to load staff');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(user => {
                const roleBadgeColor = user.role === 'Admin' ? '#8b5cf6' : '#10b981';
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">${user.name}</p>
                            <p style="font-size: 12px; color: var(--text-muted); font-weight: 600;">@${user.username}</p>
                        </div>
                        <span style="background: ${roleBadgeColor}20; color: ${roleBadgeColor}; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800;">${user.role}</span>
                    </div>
                `;
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            container.innerHTML = '<p class="empty-state">No active staff found.</p>';
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Error: ${e.message}</p>`;
    }
};

window.submitNewStaff = async function(e) {
    e.preventDefault();
    const name = document.getElementById('new-staff-name').value.trim();
    const username = document.getElementById('new-staff-username').value.trim();
    const pin = document.getElementById('new-staff-pin').value.trim();
    const role = document.getElementById('new-staff-role').value;

    if (!name || !username || pin.length !== 4) {
        if (typeof showToast === 'function') showToast("Please provide valid details. PIN must be 4 digits.");
        return;
    }

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, pin, role })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast("User created successfully!");
            document.getElementById('new-staff-name').value = '';
            document.getElementById('new-staff-username').value = '';
            document.getElementById('new-staff-pin').value = '';
            await fetchStaff();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Failed to create user");
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("Network Error: Could not save user.");
    }
};

window.openPromotionsModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('promotions-modal', true);
    await fetchPromotionsList();
};

window.closePromotionsModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('promotions-modal', false);
};

window.fetchPromotionsList = async function() {
    const container = document.getElementById('promotions-list-container');
    container.innerHTML = '<p class="empty-state">Loading active promotions...</p>';
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/promotions`); 
        if (!res.ok) throw new Error('Failed to load promotions');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(promo => {
                const isPercentage = promo.discountType === 'percentage';
                const discountText = isPercentage ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`;
                container.innerHTML += `
                    <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-weight: 800; font-size: 15px; margin-bottom: 4px; color: #BE185D;">${promo.code}</p>
                            <p style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Min Order: ₹${promo.minOrderValue || 0}</p>
                        </div>
                        <span style="background: #FBCFE8; color: #9D174D; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800;">${discountText}</span>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="empty-state">No active promotions.</p>';
        }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:#ef4444;">Error: ${e.message}</p>`;
    }
};

window.submitNewPromotion = async function(e) {
    e.preventDefault();
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    const type = document.getElementById('promo-type').value;
    const value = parseFloat(document.getElementById('promo-value').value);
    const minOrder = parseFloat(document.getElementById('promo-min-order').value) || 0;

    if (!code || isNaN(value)) {
        if (typeof showToast === 'function') showToast("Valid code and discount value required.");
        return;
    }

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/promotions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discountType: type, discountValue: value, minOrderValue: minOrder })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast("Promotion launched!");
            document.getElementById('promo-code').value = '';
            document.getElementById('promo-value').value = '';
            document.getElementById('promo-min-order').value = '';
            await fetchPromotionsList();
            if (typeof fetchPromotions === 'function') fetchPromotions(); 
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Failed to create promo");
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("Network Error: Could not save promo.");
    }
};
