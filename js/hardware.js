/* js/hardware.js */

// DEPRECATION CONSULTATION: Basic Serial printing implementation.
/*
let thermalPort = null;
window.connectThermalPrinter = async function() { ... }
async function printThermalReceipt(order) { ... }
async function printHardwareReceipt() { ... }
*/

// ENTERPRISE OPTIMIZATION: Raw ESC/POS Protocol Integration via WebSerial / WebUSB

let activePrinterPort = null;
let printerType = 'serial'; // 'serial' or 'usb'

const ESC_CMD = {
    INIT: '\x1B\x40',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_RIGHT: '\x1B\x61\x02',
    BOLD_ON: '\x1B\x45\x01',
    BOLD_OFF: '\x1B\x45\x00',
    DOUBLE_HEIGHT: '\x1B\x21\x10',
    NORMAL_SIZE: '\x1B\x21\x00',
    CUT_PAPER: '\x1D\x56\x41\x03',
    OPEN_DRAWER: '\x1B\x70\x00\x19\xFA' // Hardware Kick Code for standard RJ11 Cash Drawers
};

window.connectThermalPrinter = async function() {
    try {
        // Prefer WebSerial for standard POS Terminals, fallback to WebUSB
        if ('serial' in navigator) {
            activePrinterPort = await navigator.serial.requestPort();
            await activePrinterPort.open({ baudRate: 9600 }); 
            printerType = 'serial';
            if (typeof showToast === 'function') showToast("Hardware Connected: WebSerial POS Active 🖨️");
        } else if ('usb' in navigator) {
            const device = await navigator.usb.requestDevice({ filters: [{}] });
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);
            activePrinterPort = device;
            printerType = 'usb';
            if (typeof showToast === 'function') showToast("Hardware Connected: WebUSB POS Active 🖨️");
        } else {
            throw new Error("Browser does not support WebSerial or WebUSB.");
        }
    } catch (e) {
        console.error("Hardware connection failed:", e);
        if (typeof showToast === 'function') showToast("Could not connect to POS hardware. Ensure Chrome/Edge is used.");
    }
};

async function writeToPrinter(dataBuffer) {
    if (!activePrinterPort) return;
    try {
        if (printerType === 'serial') {
            const writer = activePrinterPort.writable.getWriter();
            await writer.write(dataBuffer);
            writer.releaseLock();
        } else if (printerType === 'usb') {
            // Standard USB Endpoint for ESC/POS is usually 1, 2, or 3
            await activePrinterPort.transferOut(1, dataBuffer); 
        }
    } catch (e) {
        console.error("Write error:", e);
    }
}

async function printThermalReceipt(order) {
    if (!activePrinterPort) return; 
    
    try {
        let storeName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
        let storeAddress = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "Retail & Supermarket";
        let storeFooter = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.receiptFooterMessage) ? globalStoreSettings.receiptFooterMessage : "Thank you for shopping!";
        let gstin = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.gstin) ? `GSTIN: ${globalStoreSettings.gstin}\n` : "";
        let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;

        let receipt = ESC_CMD.INIT;
        
        // Header
        receipt += ESC_CMD.ALIGN_CENTER + ESC_CMD.DOUBLE_HEIGHT + ESC_CMD.BOLD_ON + `${storeName}\n` + ESC_CMD.NORMAL_SIZE + ESC_CMD.BOLD_OFF;
        receipt += `${storeAddress}\n`;
        if(gstin) receipt += gstin;
        receipt += "--------------------------------\n";
        
        // Metadata
        receipt += ESC_CMD.ALIGN_LEFT;
        receipt += `Order: ${order.orderNumber || order._id.substring(0,8)}\n`;
        receipt += `Date: ${new Date(order.createdAt || Date.now()).toLocaleString()}\n`;
        if (order.customerPhone && order.customerPhone !== 'Guest') {
            receipt += `Customer: ${order.customerPhone}\n`;
        }
        receipt += "--------------------------------\n";
        
        // Items
        let rawSubtotal = 0;
        order.items.forEach(item => {
            receipt += `${item.name.substring(0, 30)}\n`;
            let itemLine = `  ${item.qty} x ${item.price.toFixed(2)}`;
            let totalLine = `Rs. ${(item.qty * item.price).toFixed(2)}`;
            // Pad spaces for alignment
            let spaces = 32 - itemLine.length - totalLine.length;
            receipt += itemLine + " ".repeat(Math.max(0, spaces)) + totalLine + "\n";
            rawSubtotal += (item.qty * item.price);
        });
        
        receipt += "--------------------------------\n";
        
        // Financials
        receipt += `Subtotal:                  Rs. ${rawSubtotal.toFixed(2)}\n`;
        if (order.discountAmount > 0) receipt += `Promo Discount:           -Rs. ${order.discountAmount.toFixed(2)}\n`;
        if (order.pointsRedeemed > 0) receipt += `Loyalty Used:             -Rs. ${order.pointsRedeemed.toFixed(2)}\n`;
        if (order.taxAmount > 0)      receipt += `Included Tax:              Rs. ${order.taxAmount.toFixed(2)}\n`;
        
        receipt += "--------------------------------\n";
        receipt += ESC_CMD.DOUBLE_HEIGHT + ESC_CMD.BOLD_ON + `TOTAL DUE:      Rs. ${order.totalAmount.toFixed(2)}\n` + ESC_CMD.NORMAL_SIZE + ESC_CMD.BOLD_OFF;
        receipt += `Paid via: ${order.paymentMethod}\n`;
        receipt += "--------------------------------\n";
        
        // Footer & Loyalty
        if (order.totalAmount > 0) {
            const earnedPoints = Math.floor(order.totalAmount / loyaltyConv);
            receipt += ESC_CMD.ALIGN_CENTER + `*** You earned ${earnedPoints} Points! ***\n`;
        }
        
        receipt += ESC_CMD.ALIGN_CENTER + `${storeFooter}\n\n\n\n\n`;
        
        // Hardware Execution
        receipt += ESC_CMD.CUT_PAPER;
        receipt += ESC_CMD.OPEN_DRAWER;

        const encoder = new TextEncoder();
        await writeToPrinter(encoder.encode(receipt));

    } catch (e) {
        console.error("Hardware Printing failed", e);
        if (typeof showToast === 'function') showToast("Hardware print failed.");
    }
}

// Redirect old function call to the new robust one
window.printHardwareReceipt = async function() {
    if (!activeOrder) return;
    await printThermalReceipt(activeOrder);
};

// ==========================================
// --- EXISTING SCANNER LOGIC ---
// ==========================================

function startPosScanner() {
    if (posContinuousScanner) return;
    setTimeout(() => {
        posContinuousScanner = new Html5Qrcode("pos-continuous-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        posContinuousScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                if (posScanCooldown) return;
                posScanCooldown = true;
                handlePosScan(decodedText);
                setTimeout(() => { posScanCooldown = false; }, 1500); 
            },
            (errorMessage) => { }
        ).catch(err => {
            document.getElementById('pos-continuous-reader').innerHTML = '<p style="color:white; text-align:center; margin-top:80px; font-size:12px;">Camera not available.</p>';
        });
    }, 300);
}

function stopPosScanner() {
    if (posContinuousScanner) {
        try {
            posContinuousScanner.stop().then(() => {
                posContinuousScanner.clear();
                posContinuousScanner = null;
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                        stream.getTracks().forEach(track => track.stop());
                    }).catch(e => {});
                }
            }).catch(err => {
                posContinuousScanner = null;
            });
        } catch (e) {
            posContinuousScanner = null;
        }
    }
}

async function handlePosScan(skuOrName) {
    let foundProduct = null;
    let foundVariant = null;

    for (const p of currentInventory) {
        if (!p.isActive || !p.variants) continue;
        for (const v of p.variants) {
            if (v.sku === skuOrName) {
                foundProduct = p;
                foundVariant = v;
                break;
            }
        }
        if (foundProduct) break;
    }

    if (!foundProduct && navigator.onLine) {
        try {
            const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
            const res = await fetchFn(`${BACKEND_URL}/api/products/autocomplete?q=${encodeURIComponent(skuOrName)}`);
            const result = await res.json();
            if (result.success && result.data.length > 0) {
                foundProduct = result.data[0];
                foundVariant = foundProduct.variants.find(v => v.sku === skuOrName) || foundProduct.variants[0];
            }
        } catch(e) { console.error("API Search Fallback Failed", e); }
    }

    if (foundProduct && foundVariant) {
        if (typeof playBeep === 'function') playBeep();
        addToPosCart(foundProduct, foundVariant);
        if (typeof showToast === 'function') showToast(`Added: ${foundProduct.name}`);
    } else {
        if (typeof showToast === 'function') showToast(`Item not found in database: ${skuOrName}`);
    }
}
