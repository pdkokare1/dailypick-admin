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
        openView.classList.add('hidden');
        closeView.classList.remove('hidden');
        document.getElementById('shift-open-time').innerText = new Date(currentActiveShift.startTime).toLocaleTimeString();
        document.getElementById('shift-display-float').innerText = currentActiveShift.startingFloat.toFixed(2);
        document.getElementById('shift-actual-cash').value = '';
    } else {
        openView.classList.remove('hidden');
        closeView.classList.add('hidden');
        document.getElementById('shift-starting-float').value = '';
    }
    
    document.getElementById('shift-modal').classList.add('active');
}

function closeShiftModal() {
    document.getElementById('shift-modal').classList.remove('active');
}

async function submitOpenShift() {
    if (isProcessingCheckout) return;
    const floatAmt = document.getElementById('shift-starting-float').value;
    if (!floatAmt || floatAmt < 0) return showToast("Enter a valid starting float amount.");
    
    isProcessingCheckout = true;
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/shifts/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userName: typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'Unknown Staff',
                startingFloat: floatAmt,
                storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null,
                registerId: typeof currentRegisterId !== 'undefined' ? currentRegisterId : null
            })
        });
        const result = await res.json();
        if (result.success) {
            currentActiveShift = result.data;
            showToast('Register Opened! 🏪 Ready for sales.');
            closeShiftModal();
        } else {
            showToast(result.message);
        }
    } catch(e) {
        showToast('Network error opening shift.');
    } finally {
        isProcessingCheckout = false;
    }
}

async function submitCloseShift() {
    if (isProcessingCheckout) return;
    const actualCashStr = document.getElementById('shift-actual-cash').value;
    
    if (!actualCashStr) {
        return showToast("Enter the actual physical cash counted in the drawer.");
    }
    const actualCash = parseFloat(actualCashStr);
    
    isProcessingCheckout = true;
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Verifying...';
    btn.disabled = true;

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
            
            if (disc === 0) {
                showToast("Register Closed. Perfect Match! ✅");
            } else if (disc < 0) {
                showToast(`Register Closed. Warning: Drawer is SHORT by ₹${Math.abs(disc).toFixed(2)}`);
            } else {
                showToast(`Register Closed. Drawer is OVER by ₹${Math.abs(disc).toFixed(2)}`);
            }
            
            closeShiftModal();
            if (typeof renderOverview === 'function') renderOverview(); 
        } else {
            showToast(result.message || 'Failed to close register.');
        }
    } catch(e) {
        showToast('Network error closing shift.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        isProcessingCheckout = false;
    }
}
