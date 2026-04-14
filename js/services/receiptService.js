/* js/services/receiptService.js */

window.printReceipt = function() {
    if (typeof activeOrder === 'undefined' || !activeOrder) return;
    const pContainer = document.getElementById('print-receipt-container');
    
    let sName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DAILYPICK.";
    let sAddress = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeAddress) ? globalStoreSettings.storeAddress : "";
    let sGstin = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.gstin) ? `<p style="margin:0; font-size:10px;">GSTIN: ${globalStoreSettings.gstin}</p>` : "";
    let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;

    const itemsHtml = activeOrder.items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${i.qty}x ${i.name.substring(0, 15)}</span>
            <span>${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');

    let extraTotalsHtml = '';
    if (activeOrder.taxAmount !== undefined || activeOrder.discountAmount !== undefined || activeOrder.pointsRedeemed !== undefined) {
        const tax = activeOrder.taxAmount || 0;
        const discount = activeOrder.discountAmount || 0;
        const pts = activeOrder.pointsRedeemed || 0;
        
        const subtotal = activeOrder.totalAmount - tax + discount + pts; 
        
        extraTotalsHtml += `<div style="font-size:12px; font-weight:normal;">Subtotal: ₹${subtotal.toFixed(2)}</div>`;
        if (discount > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal; color:#10b981;">Discount: -₹${discount.toFixed(2)}</div>`;
        if (pts > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal; color:#8b5cf6;">Loyalty Redeemed: -₹${pts.toFixed(2)}</div>`;
        if (tax > 0) extraTotalsHtml += `<div style="font-size:12px; font-weight:normal;">Tax (GST): ₹${tax.toFixed(2)}</div>`;
        extraTotalsHtml += `<hr style="border: 0; border-top: 1px dashed black; margin: 4px 0;">`;
    }

    const earnedPoints = Math.floor(activeOrder.totalAmount / loyaltyConv);
    const pointsHtml = `<div style="text-align: center; font-size: 13px; font-weight: bold; color: #16a34a; margin-top: 12px; padding-top: 8px; border-top: 1px dashed black;">⭐ You earned ${earnedPoints} Points on this order!</div>`;

    const orderDisplayId = activeOrder.orderNumber || activeOrder._id.toString().slice(-4).toUpperCase();

    pContainer.innerHTML = `
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin:0; font-size:18px;">${sName}</h2>
            ${sAddress ? `<p style="margin:0; font-size:12px;">${sAddress}</p>` : ''}
            ${sGstin}
            <p style="margin:0;">Order #${orderDisplayId}</p>
            <p style="margin:0;">Date: ${new Date(activeOrder.createdAt).toLocaleString()}</p>
        </div>
        <div style="border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <p style="margin:0;"><strong>Customer:</strong> ${activeOrder.customerName || 'Guest'}</p>
            <p style="margin:0;"><strong>Phone:</strong> ${activeOrder.customerPhone || 'N/A'}</p>
            <p style="margin:0;"><strong>Route:</strong> ${activeOrder.deliveryAddress || 'N/A'}</p>
            <p style="margin:0;"><strong>Type:</strong> ${activeOrder.deliveryType}</p>
        </div>
        <div style="border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            <strong>ITEMS:</strong><br>
            ${itemsHtml}
        </div>
        <div style="text-align: right; font-weight: bold; font-size: 14px;">
            ${extraTotalsHtml}
            TOTAL: ₹${activeOrder.totalAmount.toFixed(2)}<br>
            PAYMENT: ${activeOrder.paymentMethod}
        </div>
        ${pointsHtml}
    `;
    
    window.print();
};

window.sendWhatsAppReceipt = function() {
    if (typeof activeOrder === 'undefined' || !activeOrder) return;
    const phone = activeOrder.customerPhone;
    
    if (!phone || phone.length < 10) {
        if (typeof showToast === 'function') return showToast("No valid phone number for this order.");
        return;
    }

    let sName = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.storeName) ? globalStoreSettings.storeName : "DailyPick";
    let sFooter = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.receiptFooterMessage) ? globalStoreSettings.receiptFooterMessage : "Thank you for shopping with us!";
    let loyaltyConv = (typeof globalStoreSettings !== 'undefined' && globalStoreSettings.loyaltyPointValue) ? globalStoreSettings.loyaltyPointValue : 100;

    const earnedPoints = Math.floor(activeOrder.totalAmount / loyaltyConv);
    const ptsText = (activeOrder.pointsRedeemed && activeOrder.pointsRedeemed > 0) ? `%0A*Pts Redeemed: -₹${activeOrder.pointsRedeemed.toFixed(2)}*` : '';
    
    const itemsText = activeOrder.items.map(i => `${i.qty}x ${i.name} - ₹${(i.price * i.qty).toFixed(2)}`).join('%0A');
    const orderDisplayId = activeOrder.orderNumber || activeOrder._id.toString().slice(-4).toUpperCase();
    
    const text = `*${sName} Receipt*%0AOrder ID: #${orderDisplayId}%0A%0A*Items:*%0A${itemsText}%0A%0A*Total: ₹${activeOrder.totalAmount.toFixed(2)}*${ptsText}%0APayment: ${activeOrder.paymentMethod}%0A%0A⭐ You earned ${earnedPoints} Points!%0A%0A${sFooter}`;

    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
};
