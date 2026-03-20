/* js/pos.js */

let heldCarts = JSON.parse(localStorage.getItem('dailypick_held_carts') || '[]'); 

// NEW: Global variables to store calculated totals for checkout submission
let currentCalculatedTax = 0;
let currentCalculatedDiscount = 0;
let currentGrandTotal = 0;

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
            }).catch(err => {
                posContinuousScanner.clear();
                posContinuousScanner = null;
            });
        } catch (e) {
            posContinuousScanner.clear();
            posContinuousScanner = null;
        }
    }
}

function handlePosScan(skuOrName) {
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

    if (foundProduct && foundVariant) {
        playBeep();
        addToPosCart(foundProduct, foundVariant);
        showToast(`Added: ${foundProduct.name}`);
    } else {
        showToast(`Item not found in database: ${skuOrName}`);
    }
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
        grid.appendChild(card);
    });
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
            // --- NEW: PHASE 2 TAX FIELDS ---
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

function clearPosCart() {
    posCart = [];
    document.getElementById('pos-customer-phone').value = '';
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-items-container');
    const totalEl = document.getElementById('pos-cart-total');
    
    // NEW: Phase 2 DOM Elements
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
        currentCalculatedTax = 0; currentCalculatedDiscount = 0; currentGrandTotal = 0;
        return;
    }

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    posCart.forEach((item, index) => {
        const itemTotal = item.qty * item.price;
        subtotal += itemTotal;
        
        // NEW: Phase 2 Tax Calculation Engine
        let tRate = item.taxRate || 0;
        if (tRate > 0) {
            if (item.taxType === 'Exclusive') {
                totalTax += itemTotal * (tRate / 100);
            } else {
                totalTax += itemTotal - (itemTotal / (1 + (tRate / 100)));
            }
        }
        
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
        container.appendChild(div);
    });

    // NEW: Phase 2 Promotion Engine Calculation
    if (typeof currentPromotions !== 'undefined') {
        currentPromotions.forEach(promo => {
            if (promo.isActive) {
                if (promo.type === 'PERCENTAGE' && subtotal >= (promo.minCartValue || 0)) {
                    totalDiscount += subtotal * (promo.value / 100);
                } else if (promo.type === 'FLAT_AMOUNT' && subtotal >= (promo.minCartValue || 0)) {
                    totalDiscount += promo.value;
                }
            }
        });
    }

    // Determine Grand Total
    // (If taxes were exclusively added on top, we'd add them here. Assuming base subtotal for inclusive)
    let hasExclusive = posCart.some(i => i.taxType === 'Exclusive');
    let grandTotal = subtotal - totalDiscount + (hasExclusive ? totalTax : 0);
    
    // Save to globals for checkout
    currentCalculatedTax = totalTax;
    currentCalculatedDiscount = totalDiscount;
    currentGrandTotal = grandTotal;

    // Update UI elements
    if(subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
    if(discountEl) discountEl.innerText = `-₹${totalDiscount.toFixed(2)}`;
    if(taxEl) taxEl.innerText = `₹${totalTax.toFixed(2)}`;
    totalEl.innerText = `₹${grandTotal.toFixed(2)}`;
}

// NEW: POS Quick Add Custom Item Logic
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
        // --- NEW: PHASE 2 DEFAULT TAX FIELDS ---
        taxRate: 0,
        taxType: 'Inclusive',
        hsnCode: ''
    });
    playBeep();
    renderPosCart();
}

// NEW: POS Quick View Modal Logic
function openPosQuickView(productId) {
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    
    document.getElementById('qv-product-name').innerText = product.name;
    const list = document.getElementById('qv-variants-list');
    list.innerHTML = '';
    
    if(product.variants) {
        product.variants.forEach(v => {
            list.innerHTML += `
                <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; border: 1px solid #e2e8f0;">
                    <div>
                        <strong style="font-size: 13px;">${v.weightOrVolume}</strong>
                        <p style="font-size: 11px; color: var(--text-muted);">Stock: ${v.stock}</p>
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
    
    heldCarts.splice(index, 1);
    localStorage.setItem('dailypick_held_carts', JSON.stringify(heldCarts));
    
    renderPosCart();
    closeHeldCartsModal();
    showToast('Cart resumed! ▶️');
}

async function processPosCheckout(paymentMethod) {
    if (posCart.length === 0) return showToast('Cart is empty.');
    
    const phone = document.getElementById('pos-customer-phone').value.trim();
    
    // NEW: Phase 2 - Include the advanced totals in the payload
    const payload = {
        customerPhone: phone,
        items: posCart,
        totalAmount: currentGrandTotal,
        taxAmount: currentCalculatedTax,           // Added
        discountAmount: currentCalculatedDiscount, // Added
        paymentMethod: paymentMethod,
        timestamp: new Date().toISOString() 
    };

    showToast('Processing payment...');
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/orders/pos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast('Transaction Complete! 🧾');
            activeOrder = result.orderData;
            printReceipt();
            clearPosCart();
            fetchInventory(); 
        } else {
            showToast(result.message || 'Checkout failed.');
        }
    } catch (e) {
        showToast('Network offline. Saving transaction locally...');
        let offlineQueue = JSON.parse(localStorage.getItem('dailypick_offline_pos') || '[]');
        offlineQueue.push(payload);
        localStorage.setItem('dailypick_offline_pos', JSON.stringify(offlineQueue));
        
        activeOrder = {
            _id: 'OFFL' + Date.now().toString().slice(-4),
            createdAt: new Date(),
            customerName: 'In-Store Customer (Offline)',
            customerPhone: phone,
            deliveryAddress: 'In-Store Purchase',
            deliveryType: 'Instant',
            items: posCart,
            totalAmount: currentGrandTotal,
            taxAmount: currentCalculatedTax,           
            discountAmount: currentCalculatedDiscount,
            paymentMethod: paymentMethod
        };
        printReceipt();
        clearPosCart();
        renderOverview(); 
    }
}

async function syncOfflinePOS() {
    let offlineQueue = JSON.parse(localStorage.getItem('dailypick_offline_pos') || '[]');
    if (offlineQueue.length === 0) return;

    if (!navigator.onLine) return;

    try {
        const itemToSync = offlineQueue[0]; 
        const res = await fetch(`${BACKEND_URL}/api/orders/pos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemToSync)
        });
        
        const result = await res.json();
        if (result.success) {
            offlineQueue.shift(); 
            localStorage.setItem('dailypick_offline_pos', JSON.stringify(offlineQueue));
            showToast('Offline POS transaction synced! ✅');
            renderOverview(); 
        }
    } catch (e) {
        console.log('Sync attempted, still offline or server unreachable.');
    }
}
setInterval(syncOfflinePOS, 30000);
