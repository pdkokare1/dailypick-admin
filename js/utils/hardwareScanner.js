/* js/utils/hardwareScanner.js */

let globalBarcodeBuffer = '';
let globalBarcodeTimeout = null;

// ENTERPRISE OPTIMIZATION: Strict Debouncing for jittery hardware scanners
let lastScanTime = 0;
let lastScannedSku = '';

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
        
        // ENTERPRISE OPTIMIZATION: Prevent stuttering hardware from double-adding items
        const now = Date.now();
        if (sku === lastScannedSku && (now - lastScanTime) < 500) {
            console.warn(`[SCANNER] Ignored double-scan of ${sku} to prevent accidental double charge.`);
            globalBarcodeBuffer = '';
            return;
        }
        lastScannedSku = sku;
        lastScanTime = now;

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

// ============================================================================
// --- NEW: PHASE 13 HTML5 NATIVE POS CAMERA SCANNER ---
// ============================================================================

window.POSCameraScanner = (function() {
    let videoElement = null;
    let stream = null;
    let scanInterval = null;
    let onDetectCallback = null;

    async function startScanner(videoContainerId, callback) {
        onDetectCallback = callback;
        
        const container = document.getElementById(videoContainerId);
        if (!container) return alert("Scanner UI container not found.");

        videoElement = document.createElement('video');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('playsinline', '');
        
        container.innerHTML = '';
        container.appendChild(videoElement);

        try {
            // Request the rear-facing camera specifically for barcode scanning
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            videoElement.srcObject = stream;

            // If the browser natively supports the modern BarcodeDetector API (Chrome/Android)
            if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'qr_code', 'upc_a'] });
                
                scanInterval = setInterval(async () => {
                    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                        try {
                            const barcodes = await detector.detect(videoElement);
                            if (barcodes.length > 0) {
                                // Trigger callback and pause scanner briefly to prevent duplicate rings
                                stopScanner();
                                if (onDetectCallback) onDetectCallback(barcodes[0].rawValue);
                            }
                        } catch (e) {
                            console.warn("Barcode detection error", e);
                        }
                    }
                }, 300);
            } else {
                console.warn("Native BarcodeDetector API not supported in this browser. Fallback ZXing required.");
                container.innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">Browser lacks native scanning API. Please use Bluetooth Scanner.</p>';
                stopScanner();
            }
        } catch (err) {
            console.error("Camera access denied or hardware error.", err);
            container.innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">Camera Access Denied.</p>';
        }
    }

    function stopScanner() {
        if (scanInterval) clearInterval(scanInterval);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement.remove();
        }
    }

    // Expose public methods safely
    return {
        start: startScanner,
        stop: stopScanner
    };
})();
