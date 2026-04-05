/* js/inventoryOps.js */

async function fetchCategories() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        if (result.success) {
            const selects = ['new-category', 'inventory-cat-filter', 'bulk-assign-category'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'new-category' ? '<option value="">Select Category</option>' : '<option value="All">All Categories</option>';
                    if (id === 'bulk-assign-category') el.innerHTML = '<option value="">-- No Change --</option>';
                    result.data.forEach(c => el.innerHTML += `<option value="${c.name}">${c.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchBrands() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/brands`);
        const result = await res.json();
        if (result.success) {
            const selects = ['new-brand', 'inventory-brand-filter', 'bulk-assign-brand'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'new-brand' ? '<option value="">Select Brand</option>' : '<option value="All">All Brands</option>';
                    if (id === 'bulk-assign-brand') el.innerHTML = '<option value="">-- No Change --</option>';
                    result.data.forEach(b => el.innerHTML += `<option value="${b.name}">${b.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchDistributors() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        if (result.success) {
            const selects = ['new-distributor', 'inventory-dist-filter', 'restock-distributor'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'inventory-dist-filter' ? '<option value="All">All Distributors</option>' : '<option value="">Select Distributor</option>';
                    result.data.forEach(d => el.innerHTML += `<option value="${d.name}">${d.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

function openAddCategoryModal() { 
    document.getElementById('add-category-form').reset(); 
    document.getElementById('add-category-modal').classList.add('active'); 
}

function closeAddCategoryModal() { 
    document.getElementById('add-category-modal').classList.remove('active'); 
}

async function submitNewCategory(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-cat-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/categories`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-cat-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddCategoryModal(); 
            fetchCategories(); 
            showToast('Category Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving category.'); 
    } finally { 
        btn.innerText = 'Save Category'; 
        btn.disabled = false; 
    } 
}

function openAddBrandModal() { 
    document.getElementById('new-brand-name').value = ''; 
    document.getElementById('add-brand-modal').classList.add('active'); 
}

function closeAddBrandModal() { 
    document.getElementById('add-brand-modal').classList.remove('active'); 
}

async function submitNewBrand(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-brand-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/brands`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-brand-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddBrandModal(); 
            fetchBrands(); 
            showToast('Brand Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving brand.'); 
    } finally { 
        btn.innerText = 'Save Brand'; 
        btn.disabled = false; 
    } 
}

function openAddDistributorModal() { 
    document.getElementById('new-dist-name').value = ''; 
    document.getElementById('add-distributor-modal').classList.add('active'); 
}

function closeAddDistributorModal() { 
    document.getElementById('add-distributor-modal').classList.remove('active'); 
}

async function submitNewDistributor(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-dist-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-dist-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            closeAddDistributorModal(); 
            fetchDistributors(); 
            showToast('Distributor Added!'); 
        } else { 
            showToast(result.message); 
        } 
    } catch (err) { 
        showToast('Error saving distributor.'); 
    } finally { 
        btn.innerText = 'Save Distributor'; 
        btn.disabled = false; 
    } 
}

window.generateBulkShelfLabels = function() {
    if (selectedInventory.size === 0) return showToast("Select items to print first.");
    if (typeof window.jspdf === 'undefined' || typeof JsBarcode === 'undefined') {
        return showToast("PDF/Barcode Library is still loading...");
    }

    showToast("Generating A4 Label Sheet...");
    const { jsPDF } = window.jspdf;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const labelWidth = 65; 
    const labelHeight = 35;
    const marginX = 5;
    const marginY = 5;
    const cols = 3;
    const rows = 8;
    
    let currentCol = 0;
    let currentRow = 0;
    let isFirstPage = true;

    const canvas = document.createElement("canvas");

    Array.from(selectedInventory).forEach((id) => {
        const product = currentInventory.find(p => p._id === id);
        if (!product || !product.variants || product.variants.length === 0) return;
        
        const variant = product.variants[0]; 
        const barcodeVal = variant.sku || Math.floor(Math.random() * 1000000000000).toString();
        
        if (currentCol >= cols) {
            currentCol = 0;
            currentRow++;
        }
        if (currentRow >= rows) {
            doc.addPage();
            currentRow = 0;
            currentCol = 0;
            isFirstPage = false;
        }

        const x = marginX + (currentCol * labelWidth);
        const y = marginY + (currentRow * labelHeight);

        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, labelWidth - 2, labelHeight - 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(product.name.substring(0, 30), x + 2, y + 6);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(variant.weightOrVolume, x + 2, y + 10);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`Rs. ${variant.price}`, x + 2, y + 16);

        try {
            JsBarcode(canvas, barcodeVal, {
                format: "CODE128",
                width: 1.5,
                height: 30,
                displayValue: true,
                fontSize: 12,
                margin: 0
            });
            const imgData = canvas.toDataURL("image/jpeg", 1.0);
            doc.addImage(imgData, 'JPEG', x + 2, y + 20, 50, 12);
        } catch (e) {
            console.warn("Barcode generation failed for SKU:", barcodeVal);
        }

        currentCol++;
    });

    doc.save(`Shelf_Labels_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast("Labels Ready for Printing! 🖨️");
    
    selectedInventory.clear();
    updateInventoryBulkUI();
    renderInventory();
};

function openBulkAssignModal() {
    if (selectedInventory.size === 0) return;
    document.getElementById('bulk-assign-count').innerText = `${selectedInventory.size} items selected`;
    
    const catSelect = document.getElementById('bulk-assign-category');
    const brandSelect = document.getElementById('bulk-assign-brand');
    
    if(catSelect && typeof currentCategories !== 'undefined') {
        catSelect.innerHTML = '<option value="">-- No Change --</option>';
        currentCategories.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        });
    }

    if(brandSelect && typeof currentBrands !== 'undefined') {
        brandSelect.innerHTML = '<option value="">-- No Change --</option>';
        currentBrands.forEach(b => {
            brandSelect.innerHTML += `<option value="${b.name}">${b.name}</option>`;
        });
    }

    document.getElementById('bulk-assign-modal').classList.add('active');
}

function closeBulkAssignModal() {
    document.getElementById('bulk-assign-modal').classList.remove('active');
}

async function applyBulkAssign() {
    if (selectedInventory.size === 0) return;
    
    const newCat = document.getElementById('bulk-assign-category').value;
    const newBrand = document.getElementById('bulk-assign-brand').value;
    
    if (!newCat && !newBrand) return showToast("No changes selected.");
    
    closeBulkAssignModal();
    showToast(`Moving ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product) {
                if (newCat) product.category = newCat;
                if (newBrand) product.brand = newBrand;
                
                const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
                await fetchFn(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        showToast("Items moved successfully! 📦");
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) {
        showToast("Error moving items.");
    }
}

function openBulkPriceModal() {
    if (selectedInventory.size === 0) return;
    document.getElementById('bulk-price-count').innerText = `${selectedInventory.size} items selected`;
    document.getElementById('bulk-price-modal').classList.add('active');
}

function closeBulkPriceModal() { 
    document.getElementById('bulk-price-modal').classList.remove('active'); 
}

async function applyBulkPriceEdit() {
    if (selectedInventory.size === 0) return;
    
    const type = document.getElementById('bulk-price-type').value;
    const valueStr = document.getElementById('bulk-price-value').value;
    const value = parseFloat(valueStr);
    
    if (!value || isNaN(value)) return showToast("Enter a valid number");
    
    closeBulkPriceModal();
    showToast(`Updating prices for ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product && product.variants) {
                product.variants.forEach(v => {
                    if (type === 'increase_pct') v.price = v.price + (v.price * (value / 100));
                    if (type === 'decrease_pct') v.price = v.price - (v.price * (value / 100));
                    if (type === 'increase_fixed') v.price = v.price + value;
                    if (type === 'decrease_fixed') v.price = v.price - value;
                    if (v.price < 0) v.price = 0; 
                    v.price = Math.round(v.price * 100) / 100; 
                });
                
                const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
                await fetchFn(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        showToast("Prices Bulk Updated Successfully! 💰");
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) {
        showToast("Error updating prices.");
    }
}

async function bulkDeactivateInventory() {
    if (selectedInventory.size === 0) return;
    
    const btn = document.getElementById('inv-bulk-btn');
    btn.innerText = 'Processing...'; 
    btn.disabled = true;
    
    const ids = Array.from(selectedInventory);
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        await Promise.all(ids.map(id => fetchFn(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' })));
        showToast(`Toggled ${ids.length} products!`);
        selectedInventory.clear();
        fetchInventory(); 
    } catch (err) { 
        showToast('Error during bulk action.'); 
    } finally { 
        btn.disabled = false; 
        updateInventoryBulkUI(); 
    }
}

function closeScannerModal() { 
    if (html5QrcodeScanner) { 
        html5QrcodeScanner.stop().then(() => { 
            html5QrcodeScanner.clear(); 
            html5QrcodeScanner = null; 
        }).catch(err => console.log("Failed to stop scanner", err)); 
    } 
    document.getElementById('scanner-modal').classList.remove('active'); 
}

function startScanner(onSuccessCallback) { 
    document.getElementById('scanner-modal').classList.add('active'); 
    html5QrcodeScanner = new Html5Qrcode("reader"); 
    
    const scannerConfig = { 
        fps: 20, 
        formatsToSupport: [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.UPC_A, 
            Html5QrcodeSupportedFormats.UPC_E, 
            Html5QrcodeSupportedFormats.CODE_128, 
            Html5QrcodeSupportedFormats.CODE_39, 
            Html5QrcodeSupportedFormats.QR_CODE 
        ] 
    }; 
    
    html5QrcodeScanner.start( 
        { facingMode: "environment" }, 
        scannerConfig, 
        (decodedText) => { 
            playBeep(); 
            closeScannerModal(); 
            onSuccessCallback(decodedText); 
        }, 
        (errorMessage) => { } 
    ).catch(err => { 
        showToast("Camera access denied or unavailable."); 
        closeScannerModal(); 
    }); 
}

function startScannerForSku(btnElement) { 
    currentSkuInputTarget = btnElement.previousElementSibling; 
    startScanner((decodedText) => { 
        currentSkuInputTarget.value = decodedText; 
        showToast(`SKU Captured: ${decodedText}`); 
    }); 
}

function printBarcode(btnElement) {
    const sku = btnElement.parentElement.querySelector('.var-sku').value.trim();
    if(!sku) return showToast("Enter a SKU first to generate a barcode.");
    
    const container = document.getElementById('print-barcode-container');
    container.innerHTML = '<svg id="barcode-canvas"></svg>';
    
    JsBarcode("#barcode-canvas", sku, { format: "CODE128", width: 2, height: 100, displayValue: true });
    
    container.classList.add('active-print');
    window.print();
    container.classList.remove('active-print');
}

function openAuditMode() {
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-modal').classList.add('active');
    setTimeout(() => document.getElementById('audit-scan-input').focus(), 100);
}

function closeAuditMode() {
    document.getElementById('audit-modal').classList.remove('active');
}

function handleAuditScan(e) {
    if (e.key === 'Enter') {
        const sku = document.getElementById('audit-scan-input').value.trim();
        if(!sku) return;
        
        let foundProduct = null; let foundVariant = null;
        for (const p of currentInventory) {
            if(!p.variants) continue;
            for (const v of p.variants) {
                if (v.sku === sku) { foundProduct = p; foundVariant = v; break; }
            }
            if (foundProduct) break;
        }

        if (foundProduct && foundVariant) {
            playBeep();
            document.getElementById('audit-item-name').innerText = `${foundProduct.name} (${foundVariant.weightOrVolume})`;
            document.getElementById('audit-expected-stock').innerText = getDisplayStock(foundVariant);
            document.getElementById('audit-actual-stock').value = '';
            document.getElementById('audit-pid').value = foundProduct._id;
            document.getElementById('audit-vid').value = foundVariant._id;
            document.getElementById('audit-result-area').classList.remove('hidden');
            document.getElementById('audit-actual-stock').focus();
        } else {
            showToast(`SKU ${sku} not found in database.`);
            document.getElementById('audit-scan-input').value = '';
        }
    }
}

async function submitAuditCorrection() {
    const actual = parseInt(document.getElementById('audit-actual-stock').value);
    if(isNaN(actual)) return showToast("Enter actual physical count");
    
    const pid = document.getElementById('audit-pid').value;
    const vid = document.getElementById('audit-vid').value;
    const product = currentInventory.find(p => p._id === pid);
    const variant = product.variants.find(v => v._id === vid);
    
    const currentStock = getDisplayStock(variant);

    if (currentStock === actual) {
        showToast("Count matches! No correction needed.");
    } else {
        const diff = actual - currentStock;
        try {
            let endpoint = diff > 0 ? 'restock' : 'rtv'; 
            let payload = {};
            
            if (diff > 0) {
                payload = {
                    variantId: vid,
                    invoiceNumber: 'AUDIT-CORRECTION',
                    addedQuantity: diff,
                    purchasingPrice: 0,
                    newSellingPrice: variant.price,
                    paymentStatus: 'Paid',
                    storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
                };
            } else {
                payload = {
                    variantId: vid,
                    distributorName: 'AUDIT-CORRECTION',
                    returnedQuantity: Math.abs(diff),
                    refundAmount: 0,
                    reason: 'Audit Discrepancy (Missing)',
                    storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
                };
            }

            const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
            const res = await fetchFn(`${BACKEND_URL}/api/products/${pid}/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                showToast(`Inventory updated. Adjusted by ${diff}.`);
                fetchInventory();
            } else {
                showToast("Failed to update inventory.");
            }
        } catch(e) {
            showToast("Network error.");
        }
    }
    
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-scan-input').focus();
}

function addVariantRow(weight = '', price = '', stock = '0', sku = '', threshold = '5', expiry = '') {
    const container = document.getElementById('variants-container');
    const row = document.createElement('div');
    row.classList.add('variant-row');
    row.innerHTML = `
        <input type="text" placeholder="Size (e.g. 500g)" class="var-weight" value="${weight}" required style="min-width: 90px;">
        <input type="number" placeholder="Price (₹)" class="var-price" value="${price}" required style="width: 70px; flex: none;">
        <input type="number" placeholder="Stock" class="var-stock" value="${stock}" required style="width: 65px; flex: none;">
        <input type="number" placeholder="Alert At" class="var-threshold" value="${threshold}" title="Low Stock Alert Threshold" required style="width: 65px; flex: none;">
        <input type="date" class="var-expiry" value="${expiry ? new Date(expiry).toISOString().split('T')[0] : ''}" title="Expiry Date" style="width: 110px; flex: none;">
        <input type="text" placeholder="SKU/Barcode" class="var-sku" value="${sku}" style="min-width: 90px;">
        <button type="button" class="scan-sku-btn" onclick="startScannerForSku(this)" title="Scan Barcode">📷</button>
        <button type="button" class="scan-sku-btn" onclick="printBarcode(this)" title="Generate & Print Label">🖨️</button>
        <button type="button" class="remove-variant-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

// ==============================================================
// ADD PRODUCT MODAL LOGIC - UPDATED FOR BARCODE SCANNER PRE-FILL
// ==============================================================
function openAddProductModal(prefillSku = '') { 
    if (typeof currentCategories !== 'undefined' && currentCategories.length === 0) return showToast("Create a category first!");
    
    document.getElementById('add-product-form').reset();
    document.getElementById('edit-product-id').value = '';
    document.getElementById('modal-form-title').innerText = 'Add New Product';
    document.getElementById('current-image-text').style.display = 'none';
    document.getElementById('variants-container').innerHTML = ''; 
    document.getElementById('drop-zone').classList.remove('dragover');
    
    const previewImg = document.getElementById('drop-zone-preview');
    const dropContent = document.getElementById('drop-zone-content');
    if (previewImg) previewImg.style.display = 'none';
    if (dropContent) dropContent.style.display = 'block';
    
    // Automatically inject the scanned SKU into the first variant row
    addVariantRow('', '', '0', prefillSku, '5', ''); 
    
    // Switch to the inventory view if the user triggered this from the POS view
    switchView('inventory');
    
    document.getElementById('add-product-modal').classList.add('active'); 
}

function openEditProductModal(id, e) {
    if (e) e.stopPropagation();
    const p = currentInventory.find(item => item._id === id);
    if (!p) return;

    document.getElementById('add-product-form').reset();
    document.getElementById('edit-product-id').value = p._id;
    document.getElementById('modal-form-title').innerText = 'Edit Product';
    
    document.getElementById('new-name').value = p.name;
    document.getElementById('new-category').value = p.category;
    document.getElementById('new-brand').value = p.brand || '';
    document.getElementById('new-distributor').value = p.distributorName || '';
    document.getElementById('new-tags').value = p.searchTags || ''; 
    document.getElementById('current-image-text').style.display = p.imageUrl ? 'block' : 'none';

    const previewImg = document.getElementById('drop-zone-preview');
    const dropContent = document.getElementById('drop-zone-content');
    if (p.imageUrl) {
        if (previewImg) {
            previewImg.src = p.imageUrl;
            previewImg.style.display = 'block';
        }
        if (dropContent) dropContent.style.display = 'none';
    } else {
        if (previewImg) previewImg.style.display = 'none';
        if (dropContent) dropContent.style.display = 'block';
    }

    const container = document.getElementById('variants-container');
    container.innerHTML = '';
    
    if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => addVariantRow(v.weightOrVolume, v.price, getDisplayStock(v), v.sku, v.lowStockThreshold || 5, v.expiryDate || ''));
    } else { 
        addVariantRow(p.weightOrVolume || '', p.price || '', 0, '', 5, ''); 
    }

    document.getElementById('add-product-modal').classList.add('active');
}

function closeAddProductModal() { 
    document.getElementById('add-product-modal').classList.remove('active'); 
}

async function autoFillProduct() {
    const nameInput = document.getElementById('new-name').value.trim();
    if (!nameInput) return showToast("Please enter a Product Name first!");

    const btn = document.getElementById('btn-autofill');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="icon-sm"></i> Thinking...';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    btn.disabled = true;

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/autofill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productName: nameInput })
        });

        const result = await res.json();
        
        if (result.success && result.data) {
            const { category, brand, searchTags } = result.data;

            if (category) {
                const catSelect = document.getElementById('new-category');
                for (let i = 0; i < catSelect.options.length; i++) {
                    if (catSelect.options[i].value === category) {
                        catSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            if (brand) {
                const brandSelect = document.getElementById('new-brand');
                let brandFound = false;
                for (let i = 0; i < brandSelect.options.length; i++) {
                    if (brandSelect.options[i].value.toLowerCase() === brand.toLowerCase()) {
                        brandSelect.selectedIndex = i;
                        brandFound = true;
                        break;
                    }
                }
                if (!brandFound) {
                    const newOption = new Option(brand, brand);
                    brandSelect.add(newOption);
                    brandSelect.value = brand;
                }
            }

            if (searchTags) {
                document.getElementById('new-tags').value = searchTags;
            }

            showToast("✨ Auto-Filled via Gemini AI!");
        } else {
            showToast(result.message || "Failed to auto-fill.");
        }
    } catch (err) {
        console.error("Auto-Fill Error:", err);
        showToast("Network error during AI auto-fill.");
    } finally {
        btn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btn.disabled = false;
    }
}

function compressImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

async function submitNewProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-product-btn');
    btn.innerText = 'Saving...'; 
    btn.disabled = true;

    try {
        const editId = document.getElementById('edit-product-id').value;
        const fileInput = document.getElementById('new-image');
        let finalImageUrl = undefined; 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;

        if (fileInput.files.length > 0) {
            const compressedFile = await compressImage(fileInput.files[0]);
            const formData = new FormData();
            formData.append('file', compressedFile);
            
            const uploadRes = await fetchFn(`${BACKEND_URL}/api/products/upload`, { 
                method: 'POST', 
                body: formData 
            });
            const uploadData = await uploadRes.json();
            
            if(!uploadData.success) throw new Error("Image upload failed");
            finalImageUrl = uploadData.imageUrl; 
        } else if (!editId) { 
            finalImageUrl = ''; 
        }

        const variantRows = document.querySelectorAll('.variant-row');
        const variants = [];
        
        variantRows.forEach(row => {
            let expiryInput = row.querySelector('.var-expiry').value;
            let variantObj = { 
                weightOrVolume: row.querySelector('.var-weight').value, 
                price: Number(row.querySelector('.var-price').value), 
                stock: Number(row.querySelector('.var-stock').value),
                lowStockThreshold: Number(row.querySelector('.var-threshold').value),
                sku: row.querySelector('.var-sku').value.trim()
            };
            if (expiryInput) {
                variantObj.expiryDate = expiryInput;
            }
            variants.push(variantObj);
        });

        const p = { 
            name: document.getElementById('new-name').value, 
            category: document.getElementById('new-category').value, 
            brand: document.getElementById('new-brand').value,
            distributorName: document.getElementById('new-distributor').value,
            searchTags: document.getElementById('new-tags').value.trim(), 
            variants: variants 
        };
        
        if (finalImageUrl !== undefined) p.imageUrl = finalImageUrl;

        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `${BACKEND_URL}/api/products/${editId}` : `${BACKEND_URL}/api/products`;

        await fetchFn(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(p) 
        });
        
        closeAddProductModal(); 
        inventoryPage = 1; 
        fetchInventory(); 
        showToast(editId ? 'Product Updated!' : 'Product Added!');
    } catch (err) { 
        console.error("Save Product Error:", err); 
        showToast('Error saving product.'); 
    } finally { 
        btn.innerText = 'Save Product'; 
        btn.disabled = false; 
    }
}

function openRestockModal() { 
    if (typeof currentDistributors !== 'undefined' && currentDistributors.length === 0) {
        return showToast("Create a Distributor first!"); 
    }
    
    document.getElementById('restock-form').reset(); 
    document.getElementById('restock-selected-item').classList.add('hidden'); 
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('margin-display').innerText = 'Margin: --% | Profit: ₹--';
    restockSelectedVariant = null; 
    document.getElementById('submit-restock-btn').disabled = true; 
    document.getElementById('restock-modal').classList.add('active'); 
}

function closeRestockModal() { 
    document.getElementById('restock-modal').classList.remove('active'); 
}

function startScannerForRestock() { 
    startScanner((decodedText) => { 
        document.getElementById('restock-search').value = decodedText; 
        searchRestockItem(decodedText); 
    }); 
}

async function searchRestockItem(overrideSearchTerm = null) {
    const term = overrideSearchTerm || document.getElementById('restock-search').value.trim();
    const resultsContainer = document.getElementById('restock-search-results');
    
    if (term.length < 2) { 
        resultsContainer.innerHTML = ''; 
        return; 
    }
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products?all=true&search=${encodeURIComponent(term)}&limit=10`);
        const result = await res.json();
        
        resultsContainer.innerHTML = '';
        
        if(result.data.length === 0) { 
            resultsContainer.innerHTML = '<p style="padding:10px; font-size:12px; color:var(--text-muted);">No items found.</p>'; 
            return; 
        }
        
        result.data.forEach(p => {
            p.variants.forEach(v => {
                const isMatch = (v.sku === term) || p.name.toLowerCase().includes(term.toLowerCase());
                if (isMatch) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'restock-result-item';
                    itemDiv.innerHTML = `
                        <h4>${p.name}</h4>
                        <p>${v.weightOrVolume} • Current Stock: ${getDisplayStock(v)} • SKU: ${v.sku || 'N/A'}</p>
                    `;
                    itemDiv.onclick = () => selectItemForRestock(p, v);
                    resultsContainer.appendChild(itemDiv);
                }
            });
        });
    } catch (e) { 
        console.error("Search error", e); 
    }
}

function selectItemForRestock(product, variant) {
    restockSelectedVariant = { productId: product._id, variantId: variant._id };
    
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('restock-search').value = '';
    
    document.getElementById('restock-item-name').innerText = product.name;
    document.getElementById('restock-item-variant').innerText = `${variant.weightOrVolume} (Current Stock: ${getDisplayStock(variant)})`;
    document.getElementById('restock-product-id').value = product._id; 
    document.getElementById('restock-variant-id').value = variant._id;
    document.getElementById('restock-sell').value = variant.price; 
    
    document.getElementById('restock-selected-item').classList.remove('hidden'); 
    document.getElementById('submit-restock-btn').disabled = false;
}

function calculateMargin() {
    const costInput = document.getElementById('restock-cost').value;
    const sellInput = document.getElementById('restock-sell').value;
    const display = document.getElementById('margin-display');
    
    if (!display) return;

    const cost = parseFloat(costInput);
    const sell = parseFloat(sellInput);

    if (cost > 0 && sell > 0) {
        const profit = sell - cost;
        const margin = ((profit / sell) * 100).toFixed(1);
        display.innerText = `Margin: ${margin}% | Profit: ₹${profit.toFixed(2)}`;
        if (profit < 0) {
            display.style.color = '#991b1b';
            display.style.background = '#fef2f2';
        } else {
            display.style.color = '#0c4a6e';
            display.style.background = '#e0f2fe';
        }
    } else {
        display.innerText = `Margin: --% | Profit: ₹--`;
        display.style.color = '#0c4a6e';
        display.style.background = '#e0f2fe';
    }
}

async function submitRestock(e) {
    e.preventDefault();
    if (!restockSelectedVariant) return showToast("Please select an item to restock.");
    
    const btn = document.getElementById('submit-restock-btn'); 
    btn.innerText = 'Processing...'; 
    btn.disabled = true;
    
    const paymentStatusEl = document.getElementById('restock-payment-status');
    const paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'Paid';

    const payload = {
        invoiceNumber: document.getElementById('restock-invoice').value.trim(),
        variantId: document.getElementById('restock-variant-id').value,
        addedQuantity: document.getElementById('restock-qty').value,
        purchasingPrice: document.getElementById('restock-cost').value,
        newSellingPrice: document.getElementById('restock-sell').value,
        paymentStatus: paymentStatus,
        storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
    };
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const productId = document.getElementById('restock-product-id').value;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${productId}/restock`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        const result = await res.json();
        
        if (result.success) { 
            showToast('Shipment Received & Logged! 📦'); 
            closeRestockModal(); 
            fetchInventory(); 
            if (paymentStatus === 'Credit') fetchDistributors(); 
        } else { 
            showToast('Failed to process restock.'); 
        }
    } catch (err) { 
        showToast('Network error.'); 
    } finally { 
        btn.innerText = 'Process Restock'; 
        btn.disabled = false; 
    }
}

async function openAccountsPayable() {
    const container = document.getElementById('ap-ledger-list');
    if (!container) return;
    
    document.getElementById('accounts-payable-modal').classList.add('active');
    container.innerHTML = '<p class="empty-state">Loading distributor balances...</p>';
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        
        if (result.success) {
            currentDistributors = result.data; 
            const debtors = currentDistributors.filter(d => d.totalPendingAmount > 0);
            
            container.innerHTML = '';
            if (debtors.length === 0) {
                container.innerHTML = '<p class="empty-state" style="color:#10b981;">All supplier bills are paid! 🎉</p>';
                return;
            }
            
            debtors.forEach(d => {
                container.innerHTML += `
                    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="color:#991b1b; margin-bottom:4px;">${d.name}</h4>
                            <p style="font-size:12px; color:#b91c1c; font-weight:600;">Total Paid Lifetime: ₹${d.totalPaidAmount.toFixed(2)}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size:18px; font-weight:800; color:#dc2626; margin-bottom:8px;">₹${d.totalPendingAmount.toFixed(2)}</div>
                            <button class="primary-btn-small" style="background:#dc2626;" onclick="promptDistributorPayment('${d._id}', '${d.name}', ${d.totalPendingAmount})">Log Payment</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch(e) {
        container.innerHTML = '<p class="empty-state">Error loading balances.</p>';
    }
}

function closeAccountsPayable() {
    document.getElementById('accounts-payable-modal').classList.remove('active');
}

function promptDistributorPayment(id, name, maxAmount) {
    const amountStr = prompt(`Logging payment to ${name}.\nOutstanding Balance: ₹${maxAmount}\n\nEnter amount paid (₹):`, maxAmount);
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return showToast("Invalid amount.");
    
    const mode = prompt("Payment Mode (e.g. Bank Transfer, Cash, UPI):", "Bank Transfer");
    const note = prompt("Reference Note / Check Number (Optional):", "");
    
    submitDistributorPayment(id, amount, mode, note);
}

async function submitDistributorPayment(id, amount, mode, note) {
    showToast('Processing payment record...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors/${id}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, paymentMode: mode, referenceNote: note })
        });
        
        const result = await res.json();
        if (result.success) {
            showToast('Supplier payment logged successfully! ✅');
            openAccountsPayable(); 
        } else {
            showToast(result.message || 'Error processing payment.');
        }
    } catch(e) {
        showToast('Network error logging payment.');
    }
}

function quickRestock(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;

    openRestockModal();
    selectItemForRestock(product, variant);
}

let rtvSelectedVariant = null;

function openRTVModal(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;
    
    rtvSelectedVariant = { productId, variantId };
    
    document.getElementById('rtv-form').reset();
    document.getElementById('rtv-item-name').innerText = product.name;
    const dStock = getDisplayStock(variant); 
    document.getElementById('rtv-item-variant').innerText = `${variant.weightOrVolume} (Current Stock: ${dStock})`;
    document.getElementById('rtv-distributor').value = product.distributorName || '';
    document.getElementById('rtv-max-qty').innerText = dStock;
    document.getElementById('rtv-qty').max = dStock;
    
    document.getElementById('rtv-modal').classList.add('active');
}

function closeRTVModal() {
    document.getElementById('rtv-modal').classList.remove('active');
    rtvSelectedVariant = null;
}

async function submitRTV(e) {
    e.preventDefault();
    if (!rtvSelectedVariant) return;
    
    const btn = document.getElementById('submit-rtv-btn');
    btn.innerText = 'Processing...';
    btn.disabled = true;
    
    const payload = {
        variantId: rtvSelectedVariant.variantId,
        distributorName: document.getElementById('rtv-distributor').value,
        returnedQuantity: parseInt(document.getElementById('rtv-qty').value),
        refundAmount: parseFloat(document.getElementById('rtv-refund').value) || 0,
        reason: document.getElementById('rtv-reason').value,
        storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
    };
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${rtvSelectedVariant.productId}/rtv`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast('Return Processed Successfully! 🔙');
            generateReturnChalanPDF(
                payload.distributorName, 
                document.getElementById('rtv-item-name').innerText, 
                payload.returnedQuantity, 
                payload.refundAmount, 
                payload.reason
            );
            closeRTVModal();
            fetchInventory();
        } else {
            showToast(result.message || 'Failed to process return.');
        }
    } catch (err) {
        showToast('Network error.');
    } finally {
        btn.innerText = 'Process Return';
        btn.disabled = false;
    }
}

function generateReturnChalanPDF(distributor, itemName, qty, refund, reason) {
    try {
        const doc = new window.jspdf.jsPDF();
        
        doc.setFontSize(22);
        doc.setTextColor(10, 54, 34); 
        doc.text("DAILYPICK.", 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("RETURN CHALLAN (RTV)", 14, 28);
        
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40);
        doc.text(`Distributor: ${distributor}`, 14, 46);
        doc.text(`Challan Ref: RTV-${Date.now().toString().slice(-6)}`, 14, 52);
        
        doc.autoTable({
            startY: 60,
            head: [['Item Description', 'Qty Returned', 'Reason', 'Expected Refund']],
            body: [[itemName, qty, reason, `Rs. ${refund.toFixed(2)}`]],
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] } 
        });
        
        const finalY = doc.lastAutoTable.finalY || 60;
        doc.text("Authorized Signature: ____________________", 14, finalY + 30);
        doc.text("Driver Signature: ________________________", 100, finalY + 30);
        
        doc.save(`RTV_${distributor.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch(e) {
        console.error("PDF Error:", e);
        showToast("RTV processed, but PDF failed to generate.");
    }
}

function openRestockHistory(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;

    document.getElementById('history-item-name').innerText = product.name;
    document.getElementById('history-item-variant').innerText = variant.weightOrVolume;
    
    const container = document.getElementById('history-timeline-container');
    container.innerHTML = '';

    if (!variant.purchaseHistory || variant.purchaseHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No history found for this item.</p>';
    } else {
        const sortedHistory = [...variant.purchaseHistory].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        sortedHistory.forEach(h => {
            const dateStr = new Date(h.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-icon">📦</div>
                <div class="history-details">
                    <h4>+${h.addedQuantity} Units (Inv: ${h.invoiceNumber})</h4>
                    <p>${dateStr} • Cost: ₹${h.purchasingPrice} • Sold For: ₹${h.sellingPrice}</p>
                </div>
            `;
            container.appendChild(item);
        });
    }

    document.getElementById('history-modal').classList.add('active');
}

async function saveInlineEdit(productId, variantId, field, element, event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    element.blur();
    
    const newVal = element.value;
    const product = currentInventory.find(p => p._id === productId);
    const variant = product.variants.find(v => v._id === variantId);
    
    if (Number(newVal) === variant[field]) return; 
    
    variant[field] = Number(newVal);
    showToast('Saving update...');
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        const result = await res.json();
        if (result.success) {
            showToast('Item updated successfully!');
            updateInventoryDashboard();
        } else {
            showToast('Failed to update.');
        }
    } catch(e) {
        showToast('Error saving inline edit.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('new-image');
    const dropZone = document.getElementById('drop-zone');
    const dropContent = document.getElementById('drop-zone-content');
    const previewImg = document.getElementById('drop-zone-preview');

    if (fileInput && dropZone) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if(previewImg) {
                            previewImg.src = e.target.result;
                            previewImg.style.display = 'block';
                        }
                        if(dropContent) dropContent.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            } else {
                if(previewImg) previewImg.style.display = 'none';
                if(dropContent) dropContent.style.display = 'block';
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files && files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change')); 
            }
        });
    }
});
