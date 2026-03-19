/* js/pos.js */

let heldCarts = JSON.parse(localStorage.getItem('dailypick_held_carts') || '[]'); // NEW PHASE 4

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
        posContinuousScanner.stop().then(() => {
            posContinuousScanner.clear();
            posContinuousScanner = null;
        }).catch(err => console.log("Failed to stop POS scanner", err));
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
        const thumb = item.product.imageUrl || 'https://via.placeholder.com/40';
        const card = document.createElement('div');
        card.className = 'pos-quick-card';
        card.innerHTML = `
            <img src="${thumb}" alt="${item.product.name}">
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
            qty: 1
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
    container.innerHTML = '';
    
    if (posCart.length === 0) {
        container.innerHTML = '<p class="empty-state" style="margin-top: 40px;">Cart is empty.<br><span style="font-size: 12px;">Scan or tap an item to begin.</span></p>';
        totalEl.innerText = '₹0.00';
        return;
    }

    let total = 0;
    posCart.forEach((item, index) => {
        const itemTotal = item.qty * item.price;
        total += itemTotal;
        
        const div = document.createElement('div');
        div.className = 'pos-cart-item';
        div.innerHTML = `
            <div style="flex: 1;">
                <h4 style="font-size: 13px; margin-bottom: 4px;">${item.name}</h4>
                <p style="font-size: 11px; color: var(--text-muted);">${item.selectedVariant} • ₹${item.price}</p>
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

    totalEl.innerText = `₹${total.toFixed(2)}`;
}

// NEW PHASE 4: Hold Cart Logic
function holdCurrentCart() {
    if (posCart.length === 0) return showToast('Cart is already empty.');
    
    const phone = document.getElementById('pos-customer-phone').value.trim();
    const cartData = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: phone || 'Guest',
        items: [...posCart],
        total: posCart.reduce((sum, i) => sum + (i.price * i.qty), 0)
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
    const total = posCart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    
    const payload = {
        customerPhone: phone,
        items: posCart,
        totalAmount: total,
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
            totalAmount: total,
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
