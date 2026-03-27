/* js/hardware.js */

let thermalPort = null;
let posContinuousScanner = null;
let posScanCooldown = false;

window.connectThermalPrinter = async function() {
    try {
        thermalPort = await navigator.serial.requestPort();
        await thermalPort.open({ baudRate: 9600 }); 
        if (typeof showToast === 'function') showToast("Thermal Printer Connected! 🖨️");
    } catch (e) {
        console.error("Printer connection failed", e);
        if (typeof showToast === 'function') showToast("Could not connect to printer.");
    }
};

async function printThermalReceipt(order) {
    if (!thermalPort) return; 
    try {
        let storeName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
        let storeAddress = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "Retail & Supermarket";
        let storeFooter = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.receiptFooterMessage) ? globalStoreSettings.receiptFooterMessage : "Thank you for shopping!";
        let gstin = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings && globalStoreSettings.gstin) ? `GSTIN: ${globalStoreSettings.gstin}\n` : "";

        const writer = thermalPort.writable.getWriter();
        const encoder = new TextEncoder();
        
        const ESC = '\x1B';
        const GS = '\x1D';
        const INIT = ESC + '@';
        const ALIGN_CENTER = ESC + 'a' + '\x01';
        const ALIGN_LEFT = ESC + 'a' + '\x00';
        const BOLD_ON = ESC + 'E' + '\x01';
        const BOLD_OFF = ESC + 'E' + '\x00';
        const CUT = GS + 'V' + '\x41' + '\x03';

        let receipt = INIT + ALIGN_CENTER + BOLD_ON + `${storeName}\n` + BOLD_OFF;
        receipt += `${storeAddress}\n`;
        if(gstin) receipt += gstin;
        receipt += "--------------------------------\n";
        receipt += ALIGN_LEFT;
        
        receipt += `Order: ${order.orderNumber || order._id.substring(0,8)}\n`;
        receipt += `Date: ${new Date().toLocaleString()}\n`;
        if (order.customerPhone) {
            receipt += `Customer: ${order.customerPhone}\n`;
        }
        receipt += "--------------------------------\n";
        
        let rawSubtotal = 0;
        order.items.forEach(item => {
            receipt += `${item.name.substring(0, 25)}\n`;
            receipt += `  ${item.qty} x ${item.price.toFixed(2)} = Rs. ${(item.qty * item.price).toFixed(2)}\n`;
            rawSubtotal += (item.qty * item.price);
        });
        
        receipt += "--------------------------------\n";
        receipt += `Subtotal: Rs. ${rawSubtotal.toFixed(2)}\n`;
        
        if (order.discountAmount > 0) {
            receipt += `Promo Discount: -Rs. ${order.discountAmount.toFixed(2)}\n`;
        }
        if (order.pointsRedeemed > 0) {
            receipt += `Loyalty Used: -Rs. ${order.pointsRedeemed.toFixed(2)}\n`;
        }
        if (order.taxAmount > 0) {
            receipt += `Included Tax: Rs. ${order.taxAmount.toFixed(2)}\n`;
        }
        
        receipt += "--------------------------------\n";
        receipt += BOLD_ON + `TOTAL DUE: Rs. ${order.totalAmount.toFixed(2)}\n` + BOLD_OFF;
        receipt += `Paid via: ${order.paymentMethod}\n`;
        receipt += "--------------------------------\n";
        receipt += ALIGN_CENTER + `${storeFooter}\n\n\n\n\n` + CUT;

        await writer.write(encoder.encode(receipt));
        writer.releaseLock();
    } catch (e) {
        console.error("Printing failed", e);
    }
}

async function printHardwareReceipt() {
    if (!activeOrder) return showToast("No active order to print.");
    
    if (!('serial' in navigator)) {
        return showToast("Hardware printing requires Chrome or Edge on Desktop.");
    }
    
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 }); 
        
        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        
        const init = encoder.encode('\x1B\x40'); 
        const alignLeft = encoder.encode('\x1B\x61\x00');
        const cutPaper = encoder.encode('\x1D\x56\x00');
        
        let sName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
        let sFooter = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.receiptFooterMessage) ? globalStoreSettings.receiptFooterMessage : "Thank you for shopping!";
        let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;
        
        const orderDisplayId = activeOrder.orderNumber || activeOrder._id.toString().slice(-4).toUpperCase();

        let text = `          ${sName.toUpperCase()}          \n`;
        text += `Order #${orderDisplayId}\n`;
        text += `Date: ${new Date(activeOrder.createdAt).toLocaleString()}\n`;
        text += "--------------------------------\n";
        
        activeOrder.items.forEach(i => {
            text += `${i.qty}x ${i.name.substring(0, 20)}\n`;
            text += `   Rs. ${(i.price * i.qty).toFixed(2)}\n`;
        });
        
        text += "--------------------------------\n";
        
        if (activeOrder.taxAmount !== undefined || activeOrder.discountAmount !== undefined || activeOrder.pointsRedeemed !== undefined) {
            const tax = activeOrder.taxAmount || 0;
            const discount = activeOrder.discountAmount || 0;
            const pts = activeOrder.pointsRedeemed || 0;
            const subtotal = activeOrder.totalAmount - tax + discount + pts;
            
            text += `Subtotal: Rs. ${subtotal.toFixed(2)}\n`;
            if (discount > 0) text += `Discount: -Rs. ${discount.toFixed(2)}\n`;
            if (pts > 0) text += `Pts Redeemed: -Rs. ${pts.toFixed(2)}\n`;
            if (tax > 0) text += `Tax (GST): Rs. ${tax.toFixed(2)}\n`;
        }
        
        text += `GRAND TOTAL: Rs. ${activeOrder.totalAmount.toFixed(2)}\n`;
        text += `Payment: ${activeOrder.paymentMethod}\n`;
        text += "--------------------------------\n";
        
        const earnedPoints = Math.floor(activeOrder.totalAmount / loyaltyConv);
        text += `*** You earned ${earnedPoints} Points! ***\n`;
        text += `     ${sFooter}    \n\n\n\n`;
        
        await writer.write(init);
        await writer.write(alignLeft);
        await writer.write(encoder.encode(text));
        await writer.write(cutPaper);
        
        writer.releaseLock();
        await port.close();
        
        showToast("Hardware Print Complete! 🖨️");
        
    } catch (err) {
        console.error("Hardware Print Error:", err);
        showToast("Hardware Print Cancelled or Failed.");
    }
}

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
        playBeep();
        addToPosCart(foundProduct, foundVariant);
        showToast(`Added: ${foundProduct.name}`);
    } else {
        showToast(`Item not found in database: ${skuOrName}`);
    }
}
