/* js/utils/hardwareScanner.js */

let globalBarcodeBuffer = '';
let globalBarcodeTimeout = null;

document.addEventListener('keydown', (e) => {
    const posView = document.getElementById('pos-view');
    const isPosActive = posView && posView.classList.contains('active');
    
    const commandModal = document.getElementById('command-search-modal');
    const isCommandActive = commandModal && commandModal.classList.contains('active');
    
    const addProductModal = document.getElementById('add-product-modal');
    const isAddProductActive = addProductModal && addProductModal.classList.contains('active');

    if (isPosActive) {
        if(e.key === 'F1') { e.preventDefault(); window.processPosCheckout('Cash'); return; }
        if(e.key === 'F2') { e.preventDefault(); window.processPosCheckout('UPI'); return; }
        if(e.key === 'F4') { e.preventDefault(); window.clearPosCart(); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (typeof window.openCommandSearch === 'function') window.openCommandSearch();
        return;
    }

    if (e.key === 'Enter' && globalBarcodeBuffer.length > 3) {
        e.preventDefault(); 
        const sku = globalBarcodeBuffer;
        
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.activeElement.value = document.activeElement.value.replace(sku, '');
            document.activeElement.blur();
        }

        globalBarcodeBuffer = '';
        clearTimeout(globalBarcodeTimeout);

        if (isPosActive) {
            if (typeof window.handlePosScan === 'function') window.handlePosScan(sku);
        } else if (isAddProductActive) {
            const skuInputs = Array.from(document.querySelectorAll('.var-sku'));
            const emptySkuInput = skuInputs.find(input => !input.value.trim());
            
            if (emptySkuInput) {
                emptySkuInput.value = sku;
                if (typeof window.showToast === 'function') window.showToast(`SKU Captured: ${sku}`);
                if (typeof window.playBeep === 'function') window.playBeep();
            } else {
                if (typeof window.addVariantRow === 'function') {
                    window.addVariantRow('', '', '0', sku, '5', '');
                    if (typeof window.showToast === 'function') window.showToast(`New size added with SKU: ${sku}`);
                    if (typeof window.playBeep === 'function') window.playBeep();
                }
            }
        } else {
            if (!isCommandActive && typeof window.openCommandSearch === 'function') window.openCommandSearch();
            const cmdInput = document.getElementById('command-input');
            if (cmdInput) cmdInput.value = sku;
            if (typeof window.handleCommandSearch === 'function') window.handleCommandSearch(sku);
            
            setTimeout(() => {
                const results = document.querySelectorAll('#command-results .cmd-result-item');
                if (results.length === 1) {
                    results[0].click();
                } else if (results.length === 0) {
                    if (typeof window.playBeep === 'function') window.playBeep();
                    const addNow = confirm(`Barcode ${sku} not found. Do you want to add it to your catalog?`);
                    if (addNow) {
                        if (typeof window.closeCommandSearch === 'function') window.closeCommandSearch();
                        if (typeof window.openAddProductModal === 'function') window.openAddProductModal(sku);
                    }
                }
            }, 100);
        }
        return;
    }

    if (e.key.length === 1) {
        globalBarcodeBuffer += e.key;
        clearTimeout(globalBarcodeTimeout);
        globalBarcodeTimeout = setTimeout(() => { 
            globalBarcodeBuffer = ''; 
        }, 30);
    }
});
