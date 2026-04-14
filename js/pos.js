/* js/pos.js */

function handlePosScan(sku) {
    let foundProduct = null;
    let foundVariant = null;

    for (const p of currentInventory) {
        if (p.variants) {
            for (const v of p.variants) {
                if (v.sku === sku) {
                    foundProduct = p;
                    foundVariant = v;
                    break;
                }
            }
        }
        if (foundProduct) break;
    }

    if (foundProduct && foundVariant) {
        if (typeof playBeep === 'function') playBeep();
        addToPosCart(foundProduct, foundVariant);
    } else {
        if (typeof playBeep === 'function') playBeep();
        const addNow = confirm(`Barcode ${sku} is not in your inventory. Do you want to add it as a new product?`);
        if (addNow) {
            if (typeof openAddProductModal === 'function') {
                openAddProductModal(sku); 
            } else {
                showToast('Add product functionality not found.');
            }
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
        const res = await fetch(`${BACKEND_URL}/api/customers/profile/${phone}`);
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
        
        badge.innerHTML = `
            <span style="font-size: 12px; color: #16a34a; font-weight: 600;">⭐ ${points} Points Available</span>
            <button type="button" class="primary-btn-small" style="background: ${appliedLoyaltyPoints > 0 ? '#ef4444' : '#22c55e'}; font-size: 10px; padding: 4px 8px;" onclick="toggleLoyaltyRedemption()">
                ${appliedLoyaltyPoints > 0 ? 'Cancel' : 'Redeem'}
            </button>
        `;
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
    currentInventory.forEach(p => {
        if (p.isActive && p.variants && p.variants.length > 0 && quickItems.length < 15) {
            quickItems.push({ product: p, variant: p.variants[0] }); 
        }
    });

    if (quickItems.length === 0) {
        grid.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">Add inventory items first.</p>';
        return;
    }

    // OPTIMIZED: Fragment batching for quick tap grid rendering
    const fragment = document.createDocumentFragment();

    quickItems.forEach(item => {
        const thumbHtml = item.product.imageUrl 
            ? `<img src="${item.product.imageUrl}" alt="${item.product.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;">`
            : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 6px auto;">📦</div>`;
        
        const card = document.createElement('div');
        card.className = 'pos-quick-card';
        card.innerHTML = `
            ${thumbHtml}
            <p>${item.product.name.substring(0, 15)}</p>
            <span>₹${item.variant.price}</span>
        `;
        card.onclick = () => { playBeep(); addToPosCart(item.product, item.variant); };
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

// OPTIMIZED: Pure math function decoupled and delegated to CartCalculator Engine
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
        container.innerHTML = '<p class="empty-state" style="margin-top: 40px;">Cart is empty.<br><span style="font-size: 12px;">Scan or tap an item to begin.</span></p>';
        totalEl.innerText = '₹0.00';
        if(subtotalEl) subtotalEl.innerText = '₹0.00';
        if(discountEl) discountEl.innerText = '-₹0.00';
        if(taxEl) taxEl.innerText = '₹0.00';
        
        let loyaltyLine = document.getElementById('pos-loyalty-line');
        if(loyaltyLine) loyaltyLine.style.display = 'none';

        currentCalculatedTax = 0; currentCalculatedDiscount = 0; currentGrandTotal = 0;
        broadcastCFDUpdate(0);
        return;
    }

    const totals = calculateCartTotals();

    // OPTIMIZED: Fragment batching for cart items to ensure POS remains completely lag-free during fast scanning
    const fragment = document.createDocumentFragment();

    posCart.forEach((item, index) => {
        const itemTotal = item.qty * item.price;
        let tRate = item.taxRate || 0;
        
        const div = document.createElement('div');
        div.className = 'pos-cart-item';
        div.innerHTML = `
            <div style="flex: 1;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <h4 style="font-size: 13px;">${item.name}</h4>
                    ${item.productId && !item.productId.startsWith('CUSTOM') ? `<button style="background:none; border:none; cursor:pointer;" onclick="openPosQuickView('${item.productId}')">ℹ️</button>` : ''}
                </div>
                <p style="font-size: 11px; color: var(--text-muted);">${item.selectedVariant} • ₹${item.price} ${tRate > 0 ? `<span style="color:#10b981; font-size:9px;">(GST ${tRate}%)</span>` : ''}</p>
            </div>
            <div class="pos-qty-controls">
                <button class="pos-qty-btn" onclick="updatePosCartItemQty(${index}, -1)">-</button>
                <span style="font-size: 13px; font-weight: bold; min-width: 20px; text-align: center;">${item.qty}</span>
                <button class="pos-qty-btn" onclick="updatePosCartItemQty(${index}, 1)">+</button>
            </div>
            <div style="font-weight: 800; font-size: 14px; min-width: 60px; text-align: right;">₹${itemTotal.toFixed(2)}</div>
        `;
        fragment.appendChild(div);
    });

    container.appendChild(fragment);

    // Render calculated values
    if(subtotalEl) subtotalEl.innerText = `₹${totals.subtotal.toFixed(2)}`;
    
    if(discountEl) {
        discountEl.innerHTML = `-₹${totals.totalDiscount.toFixed(2)} ${totals.tierDiscountAmount > 0 ? `<br><span style="font-size:10px; color:#8b5cf6; font-weight:800;">(Incl. ${totals.tierName})</span>` : ''}`;
    }
    
    if(taxEl) taxEl.innerText = `₹${totals.totalTax.toFixed(2)}`;

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
        loyaltyLine.innerHTML = `<span>Loyalty Redeemed:</span> <span id="pos-cart-loyalty">-₹0.00</span>`;
        taxElContainer.parentNode.insertBefore(loyaltyLine, taxElContainer.nextSibling); 
    }

    if (loyaltyLine) {
        if (appliedLoyaltyPoints > 0) {
            loyaltyLine.style.display = 'flex';
            document.getElementById('pos-cart-loyalty').innerText = `-₹${appliedLoyaltyPoints.toFixed(2)}`;
        } else {
            loyaltyLine.style.display = 'none';
        }
    }

    totalEl.innerText = `₹${totals.grandTotal.toFixed(2)}`;
    
    broadcastCFDUpdate(totals.subtotal);
}

function addCustomPosItem() {
    const name = prompt("Enter Custom Item Name:");
    if (!name) return;
    const priceRaw = prompt("Enter Price (₹):");
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
            list.innerHTML += `
                <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; border: 1px solid #e2e8f0;">
                    <div>
                        <strong style="font-size: 13px;">${v.weightOrVolume}</strong>
                        <p style="font-size: 11px; color: var(--text-muted);">Stock: ${dStock}</p>
                    </div>
                    <button class="primary-btn-small" onclick="addToPosCart({_id: '${product._id}', name: '${product.name}', taxRate: ${product.taxRate || 0}, taxType: '${product.taxType || 'Inclusive'}', hsnCode: '${product.hsnCode || ''}'}, {_id: '${v._id}', weightOrVolume: '${v.weightOrVolume}', price: ${v.price}}); closePosQuickView();">Add ₹${v.price}</button>
                </div>
            `;
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
        container.innerHTML = '<p class="empty-state">No held carts.</p>';
    } else {
        heldCarts.forEach((cart, index) => {
            const itemNames = cart.items.map(i => `${i.qty}x ${i.name}`).join(', ');
            container.innerHTML += `
                <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; padding-right: 12px;">
                        <h4 style="font-size:14px; margin-bottom:4px;">${cart.phone} - ₹${cart.total.toFixed(2)}</h4>
                        <p style="font-size:11px; color:var(--text-muted);">${cart.time} • ${itemNames.substring(0, 40)}...</p>
                    </div>
                    <button class="primary-btn-small" style="background: #3b82f6;" onclick="resumeHeldCart(${index})">Resume</button>
                </div>
            `;
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
            const res = await fetch(`${BACKEND_URL}/api/customers/profile/${phone}`);
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
                    return showToast(`Limit Exceeded! Current: ₹${profile.creditUsed}, Max: ₹${profile.creditLimit}`);
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
    document.getElementById('split-total-display').innerText = `₹${currentGrandTotal.toFixed(2)}`;
    document.getElementById('split-cash-input').value = '';
    document.getElementById('split-upi-input').value = '';
    document.getElementById('split-balance-display').innerText = `₹${currentGrandTotal.toFixed(2)} Remaining`;
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

    let totalEntered = cash + upi;
    let balance = currentGrandTotal - totalEntered;
    
    const balanceEl = document.getElementById('split-balance-display');
    if (Math.abs(balance) < 0.01) {
        balanceEl.innerText = '₹0.00 (Perfect)';
        balanceEl.style.color = '#10b981';
    } else if (balance > 0) {
        balanceEl.innerText = `₹${balance.toFixed(2)} Remaining`;
        balanceEl.style.color = '#f59e0b';
    } else {
        balanceEl.innerText = `-₹${Math.abs(balance).toFixed(2)} (Overpaid)`;
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
    const remaining = currentGrandTotal - upi;
    if (remaining > 0) {
        document.getElementById('split-cash-input').value = remaining.toFixed(2);
        calculateSplit();
    }
}

function processSplitPayment() {
    let cash = parseFloat(document.getElementById('split-cash-input').value) || 0;
    let upi = parseFloat(document.getElementById('split-upi-input').value) || 0;
    
    if (Math.abs((cash + upi) - currentGrandTotal) > 0.01) {
        return showToast("Split amounts must equal the exact grand total!");
    }
    
    closeSplitPaymentModal();
    processPosCheckout('Split', { cash: cash, upi: upi });
}
