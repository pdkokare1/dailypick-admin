/* js/modules/adminInventoryTools.js */
// Extracted from adminDashboard.js

window.openBulkImportModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('bulk-import-modal', true);
    document.getElementById('bulk-import-results').innerHTML = '';
};

window.closeBulkImportModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('bulk-import-modal', false);
    document.getElementById('bulk-csv-upload').value = '';
};

window.downloadSampleCSV = function() {
    const csvContent = "data:text/csv;charset=utf-8,Name,Category,Brand,Distributor,Barcode/SKU,Cost Price,Selling Price,Stock,Weight/Volume\nSample Apple,Fruits,,Supplier A,1001,40,50,100,1kg\nSample Milk,Dairy,FreshCo,,1002,25,30,50,500ml";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "DailyPick_Bulk_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.submitBulkImport = async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('bulk-csv-upload');
    const btn = document.getElementById('bulk-import-submit-btn');
    const resultsDiv = document.getElementById('bulk-import-results');

    if (fileInput.files.length === 0) {
        if (typeof showToast === 'function') showToast("Please select a CSV file.");
        return;
    }

    const file = fileInput.files[0];
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
        if (typeof showToast === 'function') showToast("Invalid file format. Please upload a .csv file.");
        return;
    }

    btn.innerText = "Processing...";
    btn.disabled = true;
    resultsDiv.innerHTML = '<span style="color:#0ea5e9;">Uploading and processing. Do not close this window...</span>';

    try {
        const formData = new FormData();
        formData.append('csvFile', file);

        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/products/bulk`, {
            method: 'POST',
            body: formData 
        });

        const data = await res.json();
        if (data.success) {
            resultsDiv.innerHTML = `<span style="color:#10b981;">✅ Import Successful! Loaded ${data.count || 'multiple'} items.</span>`;
            if (typeof showToast === 'function') showToast("Bulk import successful.");
            if (typeof fetchInventory === 'function') fetchInventory(); 
            fileInput.value = '';
        } else {
            resultsDiv.innerHTML = `<span style="color:#ef4444;">❌ Error: ${data.message || 'Data formatting issue.'}</span>`;
            if (typeof showToast === 'function') showToast("Import failed. Check format.");
        }
    } catch (e) {
        console.error(e);
        resultsDiv.innerHTML = `<span style="color:#ef4444;">❌ Network Error during upload.</span>`;
        if (typeof showToast === 'function') showToast("Network Error.");
    } finally {
        btn.innerHTML = `<i data-lucide="upload-cloud" class="icon-sm"></i> Start Import`;
        btn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.openStockTransferModal = async function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('stock-transfer-modal', true);
    document.getElementById('transfer-selected-item').classList.add('hidden');
    document.getElementById('submit-transfer-btn').disabled = true;
    
    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/stores`);
        const data = await res.json();
        if (data.success) {
            const fromSelect = document.getElementById('transfer-from-store');
            const toSelect = document.getElementById('transfer-to-store');
            let options = '<option value="">Select Store...</option>';
            data.data.forEach(s => {
                options += `<option value="${s._id}">${s.name} (${s.location})</option>`;
            });
            fromSelect.innerHTML = options;
            toSelect.innerHTML = options;
        }
    } catch (e) {
        console.error("Failed to load stores for transfer", e);
    }
};

window.closeStockTransferModal = function() {
    if (typeof window.toggleModal === 'function') window.toggleModal('stock-transfer-modal', false);
    document.getElementById('transfer-search').value = '';
    document.getElementById('transfer-search-results').innerHTML = '';
    document.getElementById('transfer-qty').value = '';
};

window.searchTransferItem = function() {
    const query = document.getElementById('transfer-search').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('transfer-search-results');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }

    let resultsHTML = '';
    const matches = currentInventory.filter(p => p.name.toLowerCase().includes(query) || (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(query)))).slice(0, 5);

    matches.forEach(p => {
        if (p.variants) {
            p.variants.forEach(v => {
                resultsHTML += `
                    <div class="restock-result-item" onclick="selectTransferItem('${p._id}', '${v._id}', '${p.name.replace(/'/g, "\\'")}', '${v.weightOrVolume}')">
                        <strong>${p.name}</strong> <span style="color:var(--text-muted); font-size:12px;">(${v.weightOrVolume})</span>
                        <div style="font-size:11px; color:#10b981;">Total Stock: ${v.stock}</div>
                    </div>
                `;
            });
        }
    });

    resultsDiv.innerHTML = resultsHTML || '<div style="padding:12px; font-size:12px;">No matches found</div>';
};

window.selectTransferItem = function(pId, vId, pName, vName) {
    document.getElementById('transfer-product-id').value = pId;
    document.getElementById('transfer-variant-id').value = vId;
    document.getElementById('transfer-item-name').innerText = pName;
    document.getElementById('transfer-item-variant').innerText = vName;
    
    document.getElementById('transfer-search-results').innerHTML = '';
    document.getElementById('transfer-search').value = '';
    
    document.getElementById('transfer-selected-item').classList.remove('hidden');
    window.validateTransferStores();
};

window.validateTransferStores = function() {
    const pId = document.getElementById('transfer-product-id').value;
    const fromS = document.getElementById('transfer-from-store').value;
    const toS = document.getElementById('transfer-to-store').value;
    const btn = document.getElementById('submit-transfer-btn');
    
    if (pId && fromS && toS && fromS !== toS) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
};

window.submitStockTransfer = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-transfer-btn');
    btn.disabled = true;
    btn.innerText = 'Transferring...';

    const payload = {
        productId: document.getElementById('transfer-product-id').value,
        variantId: document.getElementById('transfer-variant-id').value,
        fromStoreId: document.getElementById('transfer-from-store').value,
        toStoreId: document.getElementById('transfer-to-store').value,
        quantity: Number(document.getElementById('transfer-qty').value)
    };

    if (payload.fromStoreId === payload.toStoreId) {
        if (typeof showToast === 'function') showToast("Source and destination must be different.");
        btn.disabled = false;
        btn.innerText = 'Transfer Stock';
        return;
    }

    try {
        const res = await window.adminFetchWithAuth(`${window.BACKEND_URL}/api/products/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            if (typeof showToast === 'function') showToast("Stock transferred successfully!");
            closeStockTransferModal();
            if (typeof fetchInventory === 'function') fetchInventory();
        } else {
            if (typeof showToast === 'function') showToast(data.message || "Failed to transfer stock.");
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast("Network Error.");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Transfer Stock';
    }
};
