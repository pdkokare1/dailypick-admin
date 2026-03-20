// NEW: Added to store active promotions from Phase 1
let currentPromotions = []; 

function connectAdminLiveStream() {
    if (adminEventSource) return; 
    
    adminEventSource = new EventSource(`${BACKEND_URL}/api/orders/stream/admin`);
    
    adminEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER') {
            currentOrders.unshift(data.order);
            updateDashboard();
            playNewOrderAudio(); 
            showToast('🚨 New Order Arrived!');
        }
    };
    
    adminEventSource.onerror = () => {
        console.warn("SSE Connection lost. Reconnecting in 3s...");
        adminEventSource.close();
        adminEventSource = null;
        setTimeout(connectAdminLiveStream, 3000);
    };
}

async function fetchCategories() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        
        if (result.success) { 
            currentCategories = result.data;
            const select = document.getElementById('new-category');
            select.innerHTML = currentCategories.length === 0 ? '<option value="" disabled selected>No Categories Created</option>' : '';
            
            const filterSelect = document.getElementById('inventory-cat-filter');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="All">All Categories</option>';
            }

            currentCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name; 
                option.innerText = cat.name;
                select.appendChild(option);
                
                if (filterSelect) {
                    const filterOption = document.createElement('option');
                    filterOption.value = cat.name; 
                    filterOption.innerText = cat.name;
                    filterSelect.appendChild(filterOption);
                }
            });
        }
    } catch (e) { 
        console.error("Error loading categories", e); 
    }
}

async function fetchBrands() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/brands`);
        const result = await res.json();
        
        if (result.success) {
            currentBrands = result.data;
            const select = document.getElementById('new-brand');
            const filterSelect = document.getElementById('inventory-brand-filter'); 
            
            select.innerHTML = '<option value="">Select Brand (Optional)</option>';
            if (filterSelect) filterSelect.innerHTML = '<option value="All">All Brands</option>';
            
            currentBrands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name; 
                opt.innerText = b.name;
                select.appendChild(opt);

                if (filterSelect) {
                    const filterOpt = document.createElement('option');
                    filterOpt.value = b.name; 
                    filterOpt.innerText = b.name;
                    filterSelect.appendChild(filterOpt);
                }
            });
        }
    } catch (e) { 
        console.error("Error loading brands", e); 
    }
}

async function fetchDistributors() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        
        if (result.success) {
            currentDistributors = result.data;
            const select = document.getElementById('new-distributor');
            const restockSelect = document.getElementById('restock-distributor');
            const filterSelect = document.getElementById('inventory-dist-filter'); 
            
            select.innerHTML = '<option value="">Select Distributor (Optional)</option>';
            restockSelect.innerHTML = '<option value="">Select a Distributor</option>';
            if (filterSelect) filterSelect.innerHTML = '<option value="All">All Distributors</option>';

            currentDistributors.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name; 
                opt.innerText = d.name;
                select.appendChild(opt);
                
                const opt2 = document.createElement('option');
                opt2.value = d.name; 
                opt2.innerText = d.name;
                restockSelect.appendChild(opt2);

                if (filterSelect) {
                    const filterOpt = document.createElement('option');
                    filterOpt.value = d.name; 
                    filterOpt.innerText = d.name;
                    filterSelect.appendChild(filterOpt);
                }
            });
        }
    } catch (e) { 
        console.error("Error loading distributors", e); 
    }
}

// --- NEW: PHASE 2 FUNCTION ---
async function fetchPromotions() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/promotions?all=false`);
        const result = await res.json();
        if (result.success) {
            currentPromotions = result.data;
        }
    } catch (e) {
        console.error("Error loading promotions", e);
    }
}
// -----------------------------
