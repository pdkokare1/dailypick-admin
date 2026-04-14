/* js/views/inventoryOpsView.js */

window.openAddCategoryModal = function() { 
    document.getElementById('add-category-form').reset(); 
    document.getElementById('add-category-modal').classList.add('active'); 
};
window.closeAddCategoryModal = function() { 
    document.getElementById('add-category-modal').classList.remove('active'); 
};

window.openAddBrandModal = function() { 
    document.getElementById('new-brand-name').value = ''; 
    document.getElementById('add-brand-modal').classList.add('active'); 
};
window.closeAddBrandModal = function() { 
    document.getElementById('add-brand-modal').classList.remove('active'); 
};

window.openAddDistributorModal = function() { 
    document.getElementById('new-dist-name').value = ''; 
    document.getElementById('add-distributor-modal').classList.add('active'); 
};
window.closeAddDistributorModal = function() { 
    document.getElementById('add-distributor-modal').classList.remove('active'); 
};

window.openBulkAssignModal = function() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return;
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
};
window.closeBulkAssignModal = function() {
    document.getElementById('bulk-assign-modal').classList.remove('active');
};

window.openBulkPriceModal = function() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return;
    document.getElementById('bulk-price-count').innerText = `${selectedInventory.size} items selected`;
    document.getElementById('bulk-price-modal').classList.add('active');
};
window.closeBulkPriceModal = function() { 
    document.getElementById('bulk-price-modal').classList.remove('active'); 
};

window.generateBulkShelfLabels = function() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return showToast("Select items to print first.");
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
    if (typeof updateInventoryBulkUI === 'function') updateInventoryBulkUI();
    if (typeof renderInventory === 'function') renderInventory();
};

window.closeScannerModal = function() { 
    if (typeof html5QrcodeScanner !== 'undefined' && html5QrcodeScanner) { 
        html5QrcodeScanner.stop().then(() => { 
            html5QrcodeScanner.clear(); 
            html5QrcodeScanner = null; 
        }).catch(err => console.log("Failed to stop scanner", err)); 
    } 
    document.getElementById('scanner-modal').classList.remove('active'); 
};

window.startScanner = function(onSuccessCallback) { 
    document.getElementById('scanner-modal').classList.add('active'); 
    window.html5QrcodeScanner = new Html5Qrcode("reader"); 
    
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
    
    window.html5QrcodeScanner.start( 
        { facingMode: "environment" }, 
        scannerConfig, 
        (decodedText) => { 
            if (typeof playBeep === 'function') playBeep(); 
            closeScannerModal(); 
            onSuccessCallback(decodedText); 
        }, 
        (errorMessage) => { } 
    ).catch(err => { 
        if (typeof showToast === 'function') showToast("Camera access denied or unavailable."); 
        closeScannerModal(); 
    }); 
};

window.startScannerForSku = function(btnElement) { 
    window.currentSkuInputTarget = btnElement.previousElementSibling; 
    startScanner((decodedText) => { 
        window.currentSkuInputTarget.value = decodedText; 
        if (typeof showToast === 'function') showToast(`SKU Captured: ${decodedText}`); 
    }); 
};

window.printBarcode = function(btnElement) {
    const sku = btnElement.parentElement.querySelector('.var-sku').value.trim();
    if(!sku) return typeof showToast === 'function' ? showToast("Enter a SKU first to generate a barcode.") : null;
    
    const container = document.getElementById('print-barcode-container');
    container.innerHTML = '<svg id="barcode-canvas"></svg>';
    
    if (typeof JsBarcode !== 'undefined') {
        JsBarcode("#barcode-canvas", sku, { format: "CODE128", width: 2, height: 100, displayValue: true });
        
        container.classList.add('active-print');
        window.print();
        container.classList.remove('active-print');
    }
};

window.openAuditMode = function() {
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-modal').classList.add('active');
    setTimeout(() => document.getElementById('audit-scan-input').focus(), 100);
};

window.closeAuditMode = function() {
    document.getElementById('audit-modal').classList.remove('active');
};

window.addVariantRow = function(weight = '', price = '', stock = '0', sku = '', threshold = '5', expiry = '') {
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
};

window.openAddProductModal = function(prefillSku = '') { 
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
    
    addVariantRow('', '', '0', prefillSku, '5', ''); 
    
    if (typeof switchView === 'function') switchView('inventory');
    document.getElementById('add-product-modal').classList.add('active'); 
};

window.openEditProductModal = function(id, e) {
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
        p.variants.forEach(v => addVariantRow(v.weightOrVolume, v.price, (typeof getDisplayStock === 'function' ? getDisplayStock(v) : v.stock), v.sku, v.lowStockThreshold || 5, v.expiryDate || ''));
    } else { 
        addVariantRow(p.weightOrVolume || '', p.price || '', 0, '', 5, ''); 
    }

    document.getElementById('add-product-modal').classList.add('active');
};

window.closeAddProductModal = function() { 
    document.getElementById('add-product-modal').classList.remove('active'); 
};

window.openRestockModal = function() { 
    if (typeof currentDistributors !== 'undefined' && currentDistributors.length === 0) {
        return showToast("Create a Distributor first!"); 
    }
    
    document.getElementById('restock-form').reset(); 
    document.getElementById('restock-selected-item').classList.add('hidden'); 
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('margin-display').innerText = 'Margin: --% | Profit: ₹--';
    window.restockSelectedVariant = null; 
    document.getElementById('submit-restock-btn').disabled = true; 
    document.getElementById('restock-modal').classList.add('active'); 
};

window.closeRestockModal = function() { 
    document.getElementById('restock-modal').classList.remove('active'); 
};

window.startScannerForRestock = function() { 
    startScanner((decodedText) => { 
        document.getElementById('restock-search').value = decodedText; 
        if (typeof searchRestockItem === 'function') searchRestockItem(decodedText); 
    }); 
};

window.selectItemForRestock = function(product, variant) {
    window.restockSelectedVariant = { productId: product._id, variantId: variant._id };
    
    document.getElementById('restock-search-results').innerHTML = ''; 
    document.getElementById('restock-search').value = '';
    
    document.getElementById('restock-item-name').innerText = product.name;
    document.getElementById('restock-item-variant').innerText = `${variant.weightOrVolume} (Current Stock: ${typeof getDisplayStock === 'function' ? getDisplayStock(variant) : variant.stock})`;
    document.getElementById('restock-product-id').value = product._id; 
    document.getElementById('restock-variant-id').value = variant._id;
    document.getElementById('restock-sell').value = variant.price; 
    
    document.getElementById('restock-selected-item').classList.remove('hidden'); 
    document.getElementById('submit-restock-btn').disabled = false;
};

window.calculateMargin = function() {
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
};

window.closeAccountsPayable = function() {
    document.getElementById('accounts-payable-modal').classList.remove('active');
};

window.openRTVModal = function(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;
    
    window.rtvSelectedVariant = { productId, variantId };
    
    document.getElementById('rtv-form').reset();
    document.getElementById('rtv-item-name').innerText = product.name;
    const dStock = typeof getDisplayStock === 'function' ? getDisplayStock(variant) : variant.stock; 
    document.getElementById('rtv-item-variant').innerText = `${variant.weightOrVolume} (Current Stock: ${dStock})`;
    document.getElementById('rtv-distributor').value = product.distributorName || '';
    document.getElementById('rtv-max-qty').innerText = dStock;
    document.getElementById('rtv-qty').max = dStock;
    
    document.getElementById('rtv-modal').classList.add('active');
};

window.closeRTVModal = function() {
    document.getElementById('rtv-modal').classList.remove('active');
    window.rtvSelectedVariant = null;
};

window.generateReturnChalanPDF = function(distributor, itemName, qty, refund, reason) {
    try {
        if (typeof window.jspdf === 'undefined') return;
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
        if (typeof showToast === 'function') showToast("RTV processed, but PDF failed to generate.");
    }
};

window.openRestockHistory = function(productId, variantId, event) {
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
};

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
