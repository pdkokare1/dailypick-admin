/* js/pos.js */

// OPTIMIZED: Replaced O(N*M) nested loop with an O(1) Lazy Cache Map.
let skuLookupCache = null;
let lastInventorySize = -1;

function getSkuMap() {
    if (typeof currentInventory === 'undefined') return new Map();
    if (skuLookupCache && currentInventory.length === lastInventorySize) return skuLookupCache;

    skuLookupCache = new Map();
    for (const p of currentInventory) {
        if (p.variants) {
            for (const v of p.variants) {
                skuLookupCache.set(v.sku, { product: p, variant: v });
            }
        }
    }
    lastInventorySize = currentInventory.length;
    return skuLookupCache;
}

// OPTIMIZATION: Modal locking flag to prevent stacked confirmations on rapid hardware scans
let isAddProductConfirmOpen = false;

function handlePosScan(sku) {
    const map = getSkuMap();
    const found = map.get(sku);

    if (found) {
        if (typeof playBeep === 'function') playBeep();
        addToPosCart(found.product, found.variant);
    } else {
        if (typeof playBeep === 'function') playBeep();
        
        if (isAddProductConfirmOpen) return;
        isAddProductConfirmOpen = true;
        
        const addNow = confirm(`Barcode ${sku} is not in your inventory. Do you want to add it as a new product?`);
        
        isAddProductConfirmOpen = false;
        
        if (addNow && typeof openAddProductModal === 'function') {
            openAddProductModal(sku); 
        } else if (addNow) {
            showToast('Add product functionality not found.');
        }
    }
}

// ==========================================
// --- EXISTING POS LOGIC ---
// ==========================================

function getDisplayStock(variant) {
    if (typeof currentStoreId === 'undefined' || !currentStoreId) return variant.stock; 
    if (variant.locationInventory && Array.isArray(variant.locationInventory)) {
        const loc = variant.locationInventory.find(l => l.storeId === currentStoreId);
        if (loc) return loc.stock;
    }
    return 0; 
}

let heldCarts = JSON.parse(localStorage.getItem('dailypick_held_carts') || '[]'); 

let currentCalculatedTax = 0;
let currentCalculatedDiscount = 0;
let currentGrandTotal = 0;

let currentActiveShift = null;

let currentCustomerProfile = null;
let appliedLoyaltyPoints = 0;

let isProcessingCheckout = false;

document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('pos-customer-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', async (e) => {
            const phone = e.target.value.trim();
            if (phone.length === 10) {
                await fetchCustomerLoyalty(phone);
            } else {
                clearLoyaltyUI();
            }
        });
    }
});

async function fetchCustomerLoyalty(phone) {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/customers/profile/${phone}`);
        const result = await res.json();
        if (result.success && result.data) {
            currentCustomerProfile = result.data;
            renderLoyaltyBadge();
        } else {
            currentCustomerProfile = null;
            clearLoyaltyUI();
        }
    } catch (e) {
        console.error("Loyalty fetch error", e);
    }
}

function renderLoyaltyBadge() {
    clearLoyaltyUI(false); 
    const phoneInput = document.getElementById('pos-customer-phone');
    if (!phoneInput || !currentCustomerProfile || !currentCustomerProfile.loyaltyPoints) return;
    
    const points = currentCustomerProfile.loyaltyPoints;
    if (points > 0) {
        const badge = document.createElement('div');
        badge.id = 'loyalty-badge-container';
        badge.style.marginTop = '8px';
        badge.style.display = 'flex';
        badge.style.justifyContent = 'space-between';
        badge.style.alignItems = 'center';
        badge.style.background = '#f0fdf4';
        badge.style.padding = '8px 12px';
        badge.style.borderRadius = '8px';
        badge.style.border = '1px solid #bbf7d0';
        
        const pointsText = document.createElement('span');
        pointsText.style.fontSize = '12px';
        pointsText.style.color = '#16a34a';
        pointsText.style.fontWeight = '600';
        pointsText.textContent = `⭐ ${points} Points Available`;

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'primary-btn-small';
        actionBtn.style.background = appliedLoyaltyPoints > 0 ? '#ef4444' : '#22c55e';
        actionBtn.style.fontSize = '10px';
        actionBtn.style.padding = '4px 8px';
        actionBtn.textContent = appliedLoyaltyPoints > 0 ? 'Cancel' : 'Redeem';
        actionBtn.onclick = toggleLoyaltyRedemption;

        badge.appendChild(pointsText);
        badge.appendChild(actionBtn);
        phoneInput.parentNode.appendChild(badge);
    }
}

function clearLoyaltyUI(resetPoints = true) {
    const existing = document.getElementById('loyalty-badge-container');
    if (existing) existing.remove();
    if (resetPoints && appliedLoyaltyPoints > 0) {
        appliedLoyaltyPoints = 0;
        renderPosCart();
    }
}

function toggleLoyaltyRedemption() {
    if (appliedLoyaltyPoints > 0) {
        appliedLoyaltyPoints = 0;
    } else {
        if (currentCustomerProfile && currentCustomerProfile.loyaltyPoints > 0) {
            appliedLoyaltyPoints = currentCustomerProfile.loyaltyPoints;
        }
    }
    renderLoyaltyBadge();
    renderPosCart();
}

function renderPosQuickTap() {
    const grid = document.getElementById('pos-quick-tap-grid');
    grid.innerHTML = '';
    
    let quickItems = [];
    if (typeof currentInventory !== 'undefined') {
        for (let i = 0; i < currentInventory.length; i++) {
            const p = currentInventory[i];
            if (p.isActive && p.variants && p.variants.length > 0) {
                quickItems.push({ product: p, variant: p.variants[0] });
                if (quickItems.length >= 15) break; 
            }
        }
    }

    if (quickItems.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1/-1';
        empty.textContent = 'Add inventory items first.';
        grid.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    quickItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'pos-quick-card';
        card.onclick = () => { playBeep(); addToPosCart(item.product, item.variant); };
        
        if (item.product.imageUrl) {
            const img = document.createElement('img');
            img.src = item.product.imageUrl;
            img.alt = item.product.name;
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.marginBottom = '6px';
            card.appendChild(img);
        } else {
            const box = document.createElement('div');
            box.style.width = '40px';
            box.style.height = '40px';
            box.style.borderRadius = '8px';
            box.style.background = '#E2E8F0';
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.justifyContent = 'center';
            box.style.fontSize = '20px';
            box.style.margin = '0 auto 6px auto';
            box.textContent = '📦';
            card.appendChild(box);
        }
        
        const title = document.createElement('p');
        title.textContent = item.product.name.substring(0, 15);
        card.appendChild(title);

        const priceSpan = document.createElement('span');
        priceSpan.textContent = `Rs ${item.variant.price}`;
        card.appendChild(priceSpan);

        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}

function addToPosCart(product, variant) {
    const existingItemIndex = posCart.findIndex(i => i.productId === product._id && i.variantId === variant._id);
    
    if (existingItemIndex > -1) {
        posCart[existingItemIndex].qty += 1;
    } else {
        posCart.push({
            productId: product._id,
            variantId: variant._id,
            name: product.name,
            selectedVariant: variant.weightOrVolume,
            price: variant.price,
            qty: 1,
            taxRate: product.taxRate || 0,
            taxType: product.taxType || 'Inclusive',
            hsnCode: product.hsnCode || ''
        });
    }
    renderPosCart();
}

function updatePosCartItemQty(index, delta) {
    posCart[index].qty += delta;
    if (posCart[index].qty <= 0) {
        posCart.splice(index, 1);
    }
    renderPosCart();
}

function broadcastCFDUpdate(subtotal) {
    if (typeof realtimeSocket !== 'undefined' && realtimeSocket && realtimeSocket.readyState === 1) {
        const cfdPayload = {
            cart: posCart.map(i => ({ name: i.name, qty: i.qty, price: i.price, selectedVariant: i.selectedVariant })),
            subtotal: subtotal || 0,
            discount: currentCalculatedDiscount || 0,
            tax: currentCalculatedTax || 0,
            total: currentGrandTotal || 0
        };
        
        realtimeSocket.send(JSON.stringify({
            type: 'CFD_STATE_UPDATE',
            storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null,
            payload: cfdPayload
        }));
    }
}

function clearPosCart() {
    posCart = [];
    document.getElementById('pos-customer-phone').value = '';
    currentCustomerProfile = null;
    appliedLoyaltyPoints = 0;
    clearLoyaltyUI();
    renderPosCart();
    broadcastCFDUpdate(0); 
}

function calculateCartTotals() {
    const totals = window.CartCalculator.calculate(
        posCart, 
        typeof currentInventory !== 'undefined' ? currentInventory : [], 
        typeof currentPromotions !== 'undefined' ? currentPromotions : [], 
        typeof currentCustomerProfile !== 'undefined' ? currentCustomerProfile : null,
        typeof appliedLoyaltyPoints !== 'undefined' ? appliedLoyaltyPoints : 0
    );

    appliedLoyaltyPoints = totals.finalLoyaltyPoints;
    currentCalculatedTax = totals.totalTax;
    currentCalculatedDiscount = totals.totalDiscount;
    currentGrandTotal = totals.grandTotal;

    return totals;
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-items-container');
    const totalEl = document.getElementById('pos-cart-total');
    const subtotalEl = document.getElementById('pos-cart-subtotal');
    const discountEl = document.getElementById('pos-cart-discount');
    const taxEl = document.getElementById('pos-cart-tax');

    container.innerHTML = '';
    
    if (posCart.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-state';
        emptyMsg.style.marginTop = '40px';
        emptyMsg.innerHTML = 'Cart is empty.<br><span style="font-size: 12px;">Scan or tap an item to begin.</span>';
        container.appendChild(emptyMsg);

        totalEl.innerText = 'Rs 0.00';
        if(subtotalEl) subtotalEl.innerText = 'Rs 0.00';
        if(discountEl) discountEl.innerText = '-Rs 0.00';
        if(taxEl) taxEl.innerText = 'Rs 0.00';
        
        let loyaltyLine = document.getElementById('pos-loyalty-line');
        if(loyaltyLine) loyaltyLine.style.display = 'none';

        currentCalculatedTax = 0; currentCalculatedDiscount = 0; currentGrandTotal = 0;
        broadcastCFDUpdate(0);
        return;
    }

    const totals = calculateCartTotals();
    const fragment = document.createDocumentFragment();

    posCart.forEach((item, index) => {
        const itemTotal = item.qty * item.price;
        let tRate = item.taxRate || 0;
        
        const div = document.createElement('div');
        div.className = 'pos-cart-item';

        const infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';

        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.alignItems = 'center';
        headerRow.style.gap = '6px';

        const title = document.createElement('h4');
        title.style.fontSize = '13px';
        title.textContent = item.name;
        headerRow.appendChild(title);

        if (item.productId && !item.productId.startsWith('CUSTOM')) {
            const infoBtn = document.createElement('button');
            infoBtn.style.background = 'none';
            infoBtn.style.border = 'none';
            infoBtn.style.cursor = 'pointer';
            infoBtn.textContent = 'ℹ️';
            infoBtn.onclick = () => openPosQuickView(item.productId);
            headerRow.appendChild(infoBtn);
        }

        const subtitle = document.createElement('p');
        subtitle.style.fontSize = '11px';
        subtitle.style.color = 'var(--text-muted)';
        subtitle.innerHTML = `${item.selectedVariant} • Rs ${item.price} ${tRate > 0 ? `<span style="color:#10b981; font-size:9px;">(GST ${tRate}%)</span>` : ''}`;

        infoDiv.appendChild(headerRow);
        infoDiv.appendChild(subtitle);
        
        const controls = document.createElement('div');
        controls.className = 'pos-qty-controls';
        
        const minusBtn = document.createElement('button');
        minusBtn.className = 'pos-qty-btn';
        minusBtn.textContent = '-';
        minusBtn.onclick = () => updatePosCartItemQty(index, -1);
        
        const qtySpan = document.createElement('span');
        qtySpan.style.fontSize = '13px';
        qtySpan.style.fontWeight = 'bold';
        qtySpan.style.minWidth = '20px';
        qtySpan.style.textAlign = 'center';
        qtySpan.textContent = item.qty;
        
        const plusBtn = document.createElement('button');
        plusBtn.className = 'pos-qty-btn';
        plusBtn.textContent = '+';
        plusBtn.onclick = () => updatePosCartItemQty(index, 1);
        
        controls.appendChild(minusBtn);
        controls.appendChild(qtySpan);
        controls.appendChild(plusBtn);
        
        const totalDiv = document.createElement('div');
        totalDiv.style.fontWeight = '800';
        totalDiv.style.fontSize = '14px';
        totalDiv.style.minWidth = '60px';
        totalDiv.style.textAlign = 'right';
        totalDiv.textContent = `Rs ${itemTotal.toFixed(2)}`;

        div.appendChild(infoDiv);
        div.appendChild(controls);
        div.appendChild(totalDiv);
        fragment.appendChild(div);
    });

    container.appendChild(fragment);

    if(subtotalEl) subtotalEl.innerText = `Rs ${totals.subtotal.toFixed(2)}`;
    
    if(discountEl) {
        discountEl.innerHTML = `-Rs ${totals.totalDiscount.toFixed(2)} ${totals.tierDiscountAmount > 0 ? `<br><span style="font-size:10px; color:#8b5cf6; font-weight:800;">(Incl. ${totals.tierName})</span>` : ''}`;
    }
    
    if(taxEl) taxEl.innerText = `Rs ${totals.totalTax.toFixed(2)}`;

    let loyaltyLine = document.getElementById('pos-loyalty-line');
    if (!loyaltyLine && taxEl) {
        const taxElContainer = taxEl.parentNode;
        loyaltyLine = document.createElement('div');
        loyaltyLine.id = 'pos-loyalty-line';
        loyaltyLine.style.display = 'none';
        loyaltyLine.style.justifyContent = 'space-between';
        loyaltyLine.style.fontSize = '13px';
        loyaltyLine.style.color = '#8b5cf6';
        loyaltyLine.style.marginBottom = '4px';
        
        const lbl = document.createElement('span');
        lbl.textContent = 'Loyalty Redeemed:';
        const val = document.createElement('span');
        val.id = 'pos-cart-loyalty';
        val.textContent = '-Rs 0.00';
        
        loyaltyLine.appendChild(lbl);
        loyaltyLine.appendChild(val);
        taxElContainer.parentNode.insertBefore(loyaltyLine, taxElContainer.nextSibling); 
    }

    if (loyaltyLine) {
        if (appliedLoyaltyPoints > 0) {
            loyaltyLine.style.display = 'flex';
            document.getElementById('pos-cart-loyalty').innerText = `-Rs ${appliedLoyaltyPoints.toFixed(2)}`;
        } else {
            loyaltyLine.style.display = 'none';
        }
    }

    totalEl.innerText = `Rs ${totals.grandTotal.toFixed(2)}`;
    
    broadcastCFDUpdate(totals.subtotal);
}

function addCustomPosItem() {
    const name = prompt("Enter Custom Item Name:");
    if (!name) return;
    const priceRaw = prompt("Enter Price (Rs):");
    if (!priceRaw) return;
    const price = parseFloat(priceRaw);
    if (isNaN(price)) return showToast("Invalid Price");

    posCart.push({
        productId: 'CUSTOM_' + Date.now(),
        variantId: 'CUSTOM_VAR',
        name: name,
        selectedVariant: 'Misc',
        price: price,
        qty: 1,
        taxRate: 0,
        taxType: 'Inclusive',
        hsnCode: ''
    });
    playBeep();
    renderPosCart();
}

function openPosQuickView(productId) {
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    
    document.getElementById('qv-product-name').innerText = product.name;
    const list = document.getElementById('qv-variants-list');
    list.innerHTML = '';
    
    if(product.variants) {
        product.variants.forEach(v => {
            const dStock = getDisplayStock(v); 
            
            const row = document.createElement('div');
            row.style.background = '#F8FAFC';
            row.style.padding = '12px';
            row.style.borderRadius = '8px';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.border = '1px solid #e2e8f0';

            const txtDiv = document.createElement('div');
            const strng = document.createElement('strong');
            strng.style.fontSize = '13px';
            strng.textContent = v.weightOrVolume;
            const pStock = document.createElement('p');
            pStock.style.fontSize = '11px';
            pStock.style.color = 'var(--text-muted)';
            pStock.textContent = `Stock: ${dStock}`;
            txtDiv.appendChild(strng);
            txtDiv.appendChild(pStock);

            const btn = document.createElement('button');
            btn.className = 'primary-btn-small';
            btn.textContent = `Add Rs ${v.price}`;
            btn.onclick = () => {
                addToPosCart({_id: product._id, name: product.name, taxRate: product.taxRate || 0, taxType: product.taxType || 'Inclusive', hsnCode: product.hsnCode || ''}, {_id: v._id, weightOrVolume: v.weightOrVolume, price: v.price});
                closePosQuickView();
            };

            row.appendChild(txtDiv);
            row.appendChild(btn);
            list.appendChild(row);
        });
    }
    document.getElementById('pos-quick-view-modal').classList.add('active');
}
function closePosQuickView() { document.getElementById('pos-quick-view-modal').classList.remove('active'); }

function holdCurrentCart() {
    if (posCart.length === 0) return showToast('Cart is already empty.');
    
    const phone = document.getElementById('pos-customer-phone').value.trim();
    const cartData = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: phone || 'Guest',
        items: [...posCart],
        total: currentGrandTotal || posCart.reduce((sum, i) => sum + (i.price * i.qty), 0)
    };
    
    heldCarts.push(cartData);
    localStorage.setItem('dailypick_held_carts', JSON.stringify(heldCarts));
    clearPosCart();
    showToast('Cart placed on hold! ⏸');
}

function openHeldCartsModal() {
    const container = document.getElementById('held-carts-list');
    container.innerHTML = '';
    
    if (heldCarts.length === 0) {
        const emp = document.createElement('p');
        emp.className = 'empty-state';
        emp.textContent = 'No held carts.';
        container.appendChild(emp);
    } else {
        heldCarts.forEach((cart, index) => {
            const itemNames = cart.items.map(i => `${i.qty}x ${i.name}`).join(', ');
            
            const row = document.createElement('div');
            row.style.background = '#F8FAFC';
            row.style.padding = '12px';
            row.style.borderRadius = '8px';
            row.style.border = '1px solid #E2E8F0';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';

            const txtDiv = document.createElement('div');
            txtDiv.style.flex = '1';
            txtDiv.style.paddingRight = '12px';

            const h4 = document.createElement('h4');
            h4.style.fontSize = '14px';
            h4.style.marginBottom = '4px';
            h4.textContent = `${cart.phone} - Rs ${cart.total.toFixed(2)}`;

            const p = document.createElement('p');
            p.style.fontSize = '11px';
            p.style.color = 'var(--text-muted)';
            p.textContent = `${cart.time} • ${itemNames.substring(0, 40)}...`;

            txtDiv.appendChild(h4);
            txtDiv.appendChild(p);

            const btn = document.createElement('button');
            btn.className = 'primary-btn-small';
            btn.style.background = '#3b82f6';
            btn.textContent = 'Resume';
            btn.onclick = () => resumeHeldCart(index);

            row.appendChild(txtDiv);
            row.appendChild(btn);
            container.appendChild(row);
        });
    }
    document.getElementById('held-carts-modal').classList.add('active');
}

function closeHeldCartsModal() {
    document.getElementById('held-carts-modal').classList.remove('active');
}

function resumeHeldCart(index) {
    if (posCart.length > 0) {
        const confirmReplace = confirm("Your current cart is not empty. Overwrite it?");
        if (!confirmReplace) return;
    }
    
    const cart = heldCarts[index];
    posCart = [...cart.items];
    document.getElementById('pos-customer-phone').value = cart.phone === 'Guest' ? '' : cart.phone;
    
    if (cart.phone !== 'Guest' && cart.phone.length === 10) {
        fetchCustomerLoyalty(cart.phone);
    }
    
    heldCarts.splice(index, 1);
    localStorage.setItem('dailypick_held_carts', JSON.stringify(heldCarts));
    
    renderPosCart();
    closeHeldCartsModal();
    showToast('Cart resumed! ▶️');
}

async function processPosCheckout(paymentMethod, splitDetails = null) {
    if (isProcessingCheckout) return showToast('Transaction in progress, please wait...');
    if (posCart.length === 0) return showToast('Cart is empty.');
    
    if (!currentActiveShift) {
        return showToast('Register is Closed. Please open a shift first!');
    }
    
    isProcessingCheckout = true; 
    const phone = document.getElementById('pos-customer-phone').value.trim();

    if (paymentMethod === 'Pay Later' && phone) {
        try {
            const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
            const res = await fetchFn(`${BACKEND_URL}/api/customers/profile/${phone}`);
            const result = await res.json();
            if (result.success && result.data) {
                const profile = result.data;
                if (!profile.isCreditEnabled) {
                    isProcessingCheckout = false;
                    return showToast("Khata is disabled for this customer.");
                }
                const potentialNewDebt = profile.creditUsed + currentGrandTotal;
                if (potentialNewDebt > profile.creditLimit) {
                    isProcessingCheckout = false;
                    return showToast(`Limit Exceeded! Current: Rs ${profile.creditUsed}, Max: Rs ${profile.creditLimit}`);
                }
            }
        } catch (e) {
            console.warn("Could not verify Khata limit, proceeding anyway.");
        }
    }
    
    const payload = {
        customerPhone: phone,
        items: posCart,
        totalAmount: currentGrandTotal,
        taxAmount: currentCalculatedTax,            
        discountAmount: currentCalculatedDiscount, 
        paymentMethod: paymentMethod,
        splitDetails: splitDetails, 
        pointsRedeemed: appliedLoyaltyPoints,
        timestamp: new Date().toISOString(),
        storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null,
        registerId: typeof currentRegisterId !== 'undefined' ? currentRegisterId : null
    };

    showToast('Processing payment...');
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/orders/pos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast('Transaction Complete! ✅');
            activeOrder = result.orderData;
            
            if (typeof printThermalReceipt === 'function') printThermalReceipt(activeOrder);
            
            clearPosCart();
            fetchInventory(); 
        } else {
            showToast(result.message || 'Checkout failed.');
        }
    } catch (e) {
        showToast('Network offline. Saving transaction to IndexedDB...');
        
        if (typeof saveToIDB === 'function') {
            await saveToIDB(payload);
        }
        
        const offlineOrderIdentifier = 'OFFL-' + Date.now().toString().slice(-4);
        
        activeOrder = {
            _id: offlineOrderIdentifier,
            orderNumber: offlineOrderIdentifier, 
            createdAt: new Date(),
            customerName: 'In-Store Customer (Offline)',
            customerPhone: phone,
            deliveryAddress: 'In-Store Purchase',
            deliveryType: 'Instant',
            items: posCart,
            totalAmount: currentGrandTotal,
            taxAmount: currentCalculatedTax,            
            discountAmount: currentCalculatedDiscount,
            paymentMethod: paymentMethod,
            splitDetails: splitDetails,
            pointsRedeemed: appliedLoyaltyPoints 
        };
        
        if (typeof printThermalReceipt === 'function') printThermalReceipt(activeOrder);
        
        clearPosCart();
        if (typeof renderOverview === 'function') renderOverview(); 
    } finally {
        isProcessingCheckout = false; 
    }
}

function openSplitPaymentModal() {
    if (posCart.length === 0) return showToast('Cart is empty.');
    document.getElementById('split-total-display').innerText = `Rs ${currentGrandTotal.toFixed(2)}`;
    document.getElementById('split-cash-input').value = '';
    document.getElementById('split-upi-input').value = '';
    document.getElementById('split-balance-display').innerText = `Rs ${currentGrandTotal.toFixed(2)} Remaining`;
    document.getElementById('split-balance-display').style.color = '#f59e0b';
    document.getElementById('split-payment-modal').classList.add('active');
}

function closeSplitPaymentModal() {
    document.getElementById('split-payment-modal').classList.remove('active');
}

function calculateSplit() {
    const cashStr = document.getElementById('split-cash-input').value;
    const upiStr = document.getElementById('split-upi-input').value;
    let cash = parseFloat(cashStr) || 0;
    let upi = parseFloat(upiStr) || 0;

    // ENTERPRISE FIX: Use strict integer math (Paise) to eliminate floating-point calculation drift on the frontend UI
    let totalEnteredPaise = Math.round(cash * 100) + Math.round(upi * 100);
    let grandTotalPaise = Math.round(currentGrandTotal * 100);
    let balancePaise = grandTotalPaise - totalEnteredPaise;
    let balance = balancePaise / 100;
    
    const balanceEl = document.getElementById('split-balance-display');
    if (balance === 0) {
        balanceEl.innerText = 'Rs 0.00 (Perfect)';
        balanceEl.style.color = '#10b981';
    } else if (balance > 0) {
        balanceEl.innerText = `Rs ${balance.toFixed(2)} Remaining`;
        balanceEl.style.color = '#f59e0b';
    } else {
        balanceEl.innerText = `-Rs ${Math.abs(balance).toFixed(2)} (Overpaid)`;
        balanceEl.style.color = '#ef4444';
    }
}

function addQuickCash(amount) {
    const cashInput = document.getElementById('split-cash-input');
    let current = parseFloat(cashInput.value) || 0;
    cashInput.value = current + amount;
    calculateSplit();
}

function setExactCash() {
    const upi = parseFloat(document.getElementById('split-upi-input').value) || 0;
    
    // Convert to integers to prevent fractional math errors
    const upiPaise = Math.round(upi * 100);
    const grandTotalPaise = Math.round(currentGrandTotal * 100);
    const remainingPaise = grandTotalPaise - upiPaise;
    
    if (remainingPaise > 0) {
        document.getElementById('split-cash-input').value = (remainingPaise / 100).toFixed(2);
        calculateSplit();
    }
}

function processSplitPayment() {
    let cash = parseFloat(document.getElementById('split-cash-input').value) || 0;
    let upi = parseFloat(document.getElementById('split-upi-input').value) || 0;
    
    const totalEnteredPaise = Math.round(cash * 100) + Math.round(upi * 100);
    const grandTotalPaise = Math.round(currentGrandTotal * 100);
    
    if (totalEnteredPaise !== grandTotalPaise) {
        return showToast("Split amounts must equal the exact grand total!");
    }
    
    closeSplitPaymentModal();
    processPosCheckout('Split', { cash: cash, upi: upi });
}
