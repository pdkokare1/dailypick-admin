/* js/shiftManager.js */

async function checkCurrentShift() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/shifts/current`);
        const result = await res.json();
        if (result.success && result.data) {
            currentActiveShift = result.data;
        } else {
            currentActiveShift = null;
        }
    } catch(e) {
        console.error("Shift check failed", e);
    }
}

function openShiftModal() {
    const openView = document.getElementById('shift-open-view');
    const closeView = document.getElementById('shift-close-view');
    
    if (currentActiveShift) {
        if(openView) openView.classList.add('hidden');
        if(closeView) closeView.classList.remove('hidden');
        
        const openTimeEl = document.getElementById('shift-open-time');
        const floatEl = document.getElementById('shift-display-float');
        const cashEl = document.getElementById('shift-actual-cash');
        
        if(openTimeEl) openTimeEl.innerText = new Date(currentActiveShift.startTime).toLocaleTimeString();
        if(floatEl) floatEl.innerText = currentActiveShift.startingFloat.toFixed(2);
        if(cashEl) cashEl.value = '';
    } else {
        if(openView) openView.classList.remove('hidden');
        if(closeView) closeView.classList.add('hidden');
        
        const startFloatEl = document.getElementById('shift-starting-float');
        if(startFloatEl) startFloatEl.value = '';
    }
    
    const modal = document.getElementById('shift-modal');
    if(modal) modal.classList.add('active');
}

function closeShiftModal() {
    const modal = document.getElementById('shift-modal');
    if(modal) modal.classList.remove('active');
}

async function submitOpenShift() {
    if (isProcessingCheckout) return;
    const floatInput = document.getElementById('shift-starting-float');
    const floatAmt = floatInput ? floatInput.value : '';
    
    if (!floatAmt || Number(floatAmt) < 0) return showToast("Enter a valid starting float amount.");
    
    isProcessingCheckout = true;
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/shifts/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userName: typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'Unknown Staff',
                startingFloat: Number(floatAmt),
                storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null,
                registerId: typeof currentRegisterId !== 'undefined' ? currentRegisterId : null
            })
        });
        const result = await res.json();
        if (result.success) {
            currentActiveShift = result.data;
            if (typeof showToast === 'function') showToast('Register Opened! 🏪 Ready for sales.');
            closeShiftModal();
        } else {
            if (typeof showToast === 'function') showToast(result.message);
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Network error opening shift.');
    } finally {
        isProcessingCheckout = false;
    }
}

async function submitCloseShift(event) {
    if (isProcessingCheckout) return;
    const cashInput = document.getElementById('shift-actual-cash');
    const actualCashStr = cashInput ? cashInput.value : '';
    
    if (!actualCashStr) {
        if (typeof showToast === 'function') showToast("Enter the actual physical cash counted in the drawer.");
        return;
    }
    const actualCash = parseFloat(actualCashStr);
    
    isProcessingCheckout = true;
    const btn = event ? event.target : null;
    let originalText = 'Close Register';
    
    if (btn) {
        originalText = btn.innerText;
        btn.innerText = 'Verifying...';
        btn.disabled = true;
    }

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/shifts/close`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shiftId: currentActiveShift._id,
                actualCash: actualCash
            })
        });
        
        const result = await res.json();
        
        if (result.success) {
            currentActiveShift = null;
            const disc = result.discrepancy;
            
            if (typeof showToast === 'function') {
                if (disc === 0) {
                    showToast("Register Closed. Perfect Match! ✅");
                } else if (disc < 0) {
                    showToast(`Register Closed. Warning: Drawer is SHORT by ₹${Math.abs(disc).toFixed(2)}`);
                } else {
                    showToast(`Register Closed. Drawer is OVER by ₹${Math.abs(disc).toFixed(2)}`);
                }
            }
            
            closeShiftModal();
            if (typeof renderOverview === 'function') renderOverview(); 
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Failed to close register.');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Network error closing shift.');
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
        isProcessingCheckout = false;
    }
}
