/* js/inventoryOps.js */

async function fetchCategories() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/categories`);
        const result = await res.json();
        if (result.success) {
            window.currentCategories = result.data;
            const selects = ['new-category', 'inventory-cat-filter', 'bulk-assign-category'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'new-category' ? '<option value="">Select Category</option>' : '<option value="All">All Categories</option>';
                    if (id === 'bulk-assign-category') el.innerHTML = '<option value="">-- No Change --</option>';
                    result.data.forEach(c => el.innerHTML += `<option value="${c.name}">${c.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchBrands() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/brands`);
        const result = await res.json();
        if (result.success) {
            window.currentBrands = result.data;
            const selects = ['new-brand', 'inventory-brand-filter', 'bulk-assign-brand'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'new-brand' ? '<option value="">Select Brand</option>' : '<option value="All">All Brands</option>';
                    if (id === 'bulk-assign-brand') el.innerHTML = '<option value="">-- No Change --</option>';
                    result.data.forEach(b => el.innerHTML += `<option value="${b.name}">${b.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchDistributors() {
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        if (result.success) {
            window.currentDistributors = result.data;
            const selects = ['new-distributor', 'inventory-dist-filter', 'restock-distributor'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = id === 'inventory-dist-filter' ? '<option value="All">All Distributors</option>' : '<option value="">Select Distributor</option>';
                    result.data.forEach(d => el.innerHTML += `<option value="${d.name}">${d.name}</option>`);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function submitNewCategory(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-cat-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/categories`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-cat-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            if (typeof closeAddCategoryModal === 'function') closeAddCategoryModal(); 
            fetchCategories(); 
            if (typeof showToast === 'function') showToast('Category Added!'); 
        } else { 
            if (typeof showToast === 'function') showToast(result.message); 
        } 
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Error saving category.'); 
    } finally { 
        btn.innerText = 'Save Category'; 
        btn.disabled = false; 
    } 
}

async function submitNewBrand(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-brand-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/brands`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-brand-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            if (typeof closeAddBrandModal === 'function') closeAddBrandModal(); 
            fetchBrands(); 
            if (typeof showToast === 'function') showToast('Brand Added!'); 
        } else { 
            if (typeof showToast === 'function') showToast(result.message); 
        } 
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Error saving brand.'); 
    } finally { 
        btn.innerText = 'Save Brand'; 
        btn.disabled = false; 
    } 
}

async function submitNewDistributor(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('submit-dist-btn'); 
    btn.innerText = 'Saving...'; 
    btn.disabled = true; 
    
    try { 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: document.getElementById('new-dist-name').value.trim() }) 
        }); 
        
        const result = await res.json(); 
        
        if (result.success) { 
            if (typeof closeAddDistributorModal === 'function') closeAddDistributorModal(); 
            fetchDistributors(); 
            if (typeof showToast === 'function') showToast('Distributor Added!'); 
        } else { 
            if (typeof showToast === 'function') showToast(result.message); 
        } 
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Error saving distributor.'); 
    } finally { 
        btn.innerText = 'Save Distributor'; 
        btn.disabled = false; 
    } 
}

async function applyBulkAssign() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return;
    
    const newCat = document.getElementById('bulk-assign-category').value;
    const newBrand = document.getElementById('bulk-assign-brand').value;
    
    if (!newCat && !newBrand) {
        if (typeof showToast === 'function') showToast("No changes selected.");
        return;
    }
    
    if (typeof closeBulkAssignModal === 'function') closeBulkAssignModal();
    if (typeof showToast === 'function') showToast(`Moving ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product) {
                if (newCat) product.category = newCat;
                if (newBrand) product.brand = newBrand;
                
                const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
                await fetchFn(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        if (typeof showToast === 'function') showToast("Items moved successfully! 📦");
        selectedInventory.clear();
        if (typeof fetchInventory === 'function') fetchInventory(); 
    } catch (err) {
        if (typeof showToast === 'function') showToast("Error moving items.");
    }
}

async function applyBulkPriceEdit() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return;
    
    const type = document.getElementById('bulk-price-type').value;
    const valueStr = document.getElementById('bulk-price-value').value;
    const value = parseFloat(valueStr);
    
    if (!value || isNaN(value)) {
        if (typeof showToast === 'function') showToast("Enter a valid number");
        return;
    }
    
    if (typeof closeBulkPriceModal === 'function') closeBulkPriceModal();
    if (typeof showToast === 'function') showToast(`Updating prices for ${selectedInventory.size} products...`);
    
    try {
        const ids = Array.from(selectedInventory);
        
        await Promise.all(ids.map(async (id) => {
            const product = currentInventory.find(p => p._id === id);
            if(product && product.variants) {
                product.variants.forEach(v => {
                    if (type === 'increase_pct') v.price = v.price + (v.price * (value / 100));
                    if (type === 'decrease_pct') v.price = v.price - (v.price * (value / 100));
                    if (type === 'increase_fixed') v.price = v.price + value;
                    if (type === 'decrease_fixed') v.price = v.price - value;
                    if (v.price < 0) v.price = 0; 
                    v.price = Math.round(v.price * 100) / 100; 
                });
                
                const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
                await fetchFn(`${BACKEND_URL}/api/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
            }
        }));
        
        if (typeof showToast === 'function') showToast("Prices Bulk Updated Successfully! 💰");
        selectedInventory.clear();
        if (typeof fetchInventory === 'function') fetchInventory(); 
    } catch (err) {
        if (typeof showToast === 'function') showToast("Error updating prices.");
    }
}

async function bulkDeactivateInventory() {
    if (typeof selectedInventory === 'undefined' || selectedInventory.size === 0) return;
    
    const btn = document.getElementById('inv-bulk-btn');
    if(btn) {
        btn.innerText = 'Processing...'; 
        btn.disabled = true;
    }
    
    const ids = Array.from(selectedInventory);
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        await Promise.all(ids.map(id => fetchFn(`${BACKEND_URL}/api/products/${id}/toggle`, { method: 'PUT' })));
        if (typeof showToast === 'function') showToast(`Toggled ${ids.length} products!`);
        selectedInventory.clear();
        if (typeof fetchInventory === 'function') fetchInventory(); 
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Error during bulk action.'); 
    } finally { 
        if(btn) btn.disabled = false; 
        if (typeof updateInventoryBulkUI === 'function') updateInventoryBulkUI(); 
    }
}

function handleAuditScan(e) {
    if (e.key === 'Enter') {
        const sku = document.getElementById('audit-scan-input').value.trim();
        if(!sku) return;
        
        let foundProduct = null; let foundVariant = null;
        for (const p of currentInventory) {
            if(!p.variants) continue;
            for (const v of p.variants) {
                if (v.sku === sku) { foundProduct = p; foundVariant = v; break; }
            }
            if (foundProduct) break;
        }

        if (foundProduct && foundVariant) {
            if (typeof playBeep === 'function') playBeep();
            document.getElementById('audit-item-name').innerText = `${foundProduct.name} (${foundVariant.weightOrVolume})`;
            document.getElementById('audit-expected-stock').innerText = typeof getDisplayStock === 'function' ? getDisplayStock(foundVariant) : foundVariant.stock;
            document.getElementById('audit-actual-stock').value = '';
            document.getElementById('audit-pid').value = foundProduct._id;
            document.getElementById('audit-vid').value = foundVariant._id;
            document.getElementById('audit-result-area').classList.remove('hidden');
            document.getElementById('audit-actual-stock').focus();
        } else {
            if (typeof showToast === 'function') showToast(`SKU ${sku} not found in database.`);
            document.getElementById('audit-scan-input').value = '';
        }
    }
}

async function submitAuditCorrection() {
    const actual = parseInt(document.getElementById('audit-actual-stock').value);
    if(isNaN(actual)) {
        if (typeof showToast === 'function') showToast("Enter actual physical count");
        return;
    }
    
    const pid = document.getElementById('audit-pid').value;
    const vid = document.getElementById('audit-vid').value;
    const product = currentInventory.find(p => p._id === pid);
    const variant = product.variants.find(v => v._id === vid);
    
    const currentStock = typeof getDisplayStock === 'function' ? getDisplayStock(variant) : variant.stock;

    if (currentStock === actual) {
        if (typeof showToast === 'function') showToast("Count matches! No correction needed.");
    } else {
        const diff = actual - currentStock;
        try {
            let endpoint = diff > 0 ? 'restock' : 'rtv'; 
            let payload = {};
            
            if (diff > 0) {
                payload = {
                    variantId: vid,
                    invoiceNumber: 'AUDIT-CORRECTION',
                    addedQuantity: diff,
                    purchasingPrice: 0,
                    newSellingPrice: variant.price,
                    paymentStatus: 'Paid',
                    storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
                };
            } else {
                payload = {
                    variantId: vid,
                    distributorName: 'AUDIT-CORRECTION',
                    returnedQuantity: Math.abs(diff),
                    refundAmount: 0,
                    reason: 'Audit Discrepancy (Missing)',
                    storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
                };
            }

            const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
            const res = await fetchFn(`${BACKEND_URL}/api/products/${pid}/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                if (typeof showToast === 'function') showToast(`Inventory updated. Adjusted by ${diff}.`);
                if (typeof fetchInventory === 'function') fetchInventory();
            } else {
                if (typeof showToast === 'function') showToast("Failed to update inventory.");
            }
        } catch(e) {
            if (typeof showToast === 'function') showToast("Network error.");
        }
    }
    
    document.getElementById('audit-result-area').classList.add('hidden');
    document.getElementById('audit-scan-input').value = '';
    document.getElementById('audit-scan-input').focus();
}

async function autoFillProduct() {
    const nameInput = document.getElementById('new-name').value.trim();
    if (!nameInput) {
        if (typeof showToast === 'function') showToast("Please enter a Product Name first!");
        return;
    }

    const btn = document.getElementById('btn-autofill');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="icon-sm"></i> Thinking...';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    btn.disabled = true;

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/autofill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productName: nameInput })
        });

        const result = await res.json();
        
        if (result.success && result.data) {
            const { category, brand, searchTags } = result.data;

            if (category) {
                const catSelect = document.getElementById('new-category');
                for (let i = 0; i < catSelect.options.length; i++) {
                    if (catSelect.options[i].value === category) {
                        catSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            if (brand) {
                const brandSelect = document.getElementById('new-brand');
                let brandFound = false;
                for (let i = 0; i < brandSelect.options.length; i++) {
                    if (brandSelect.options[i].value.toLowerCase() === brand.toLowerCase()) {
                        brandSelect.selectedIndex = i;
                        brandFound = true;
                        break;
                    }
                }
                if (!brandFound) {
                    const newOption = new Option(brand, brand);
                    brandSelect.add(newOption);
                    brandSelect.value = brand;
                }
            }

            if (searchTags) {
                document.getElementById('new-tags').value = searchTags;
            }

            if (typeof showToast === 'function') showToast("✨ Auto-Filled via Gemini AI!");
        } else {
            if (typeof showToast === 'function') showToast(result.message || "Failed to auto-fill.");
        }
    } catch (err) {
        console.error("Auto-Fill Error:", err);
        if (typeof showToast === 'function') showToast("Network error during AI auto-fill.");
    } finally {
        btn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btn.disabled = false;
    }
}

function compressImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

async function submitNewProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-product-btn');
    btn.innerText = 'Saving...'; 
    btn.disabled = true;

    try {
        const editId = document.getElementById('edit-product-id').value;
        const masterIdEl = document.getElementById('master-product-id');
        const masterId = masterIdEl ? masterIdEl.value : '';

        const fileInput = document.getElementById('new-image');
        let finalImageUrl = undefined; 
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const BACKEND_URL = typeof CONFIG !== 'undefined' ? CONFIG.BACKEND_URL : window.BACKEND_URL;

        if (fileInput && fileInput.files.length > 0) {
            const compressedFile = await compressImage(fileInput.files[0]);
            const formData = new FormData();
            formData.append('file', compressedFile);
            
            const uploadRes = await fetchFn(`${BACKEND_URL}/api/products/upload`, { 
                method: 'POST', 
                body: formData 
            });
            const uploadData = await uploadRes.json();
            
            if(!uploadData.success) throw new Error("Image upload failed");
            finalImageUrl = uploadData.imageUrl; 
        } else if (!editId) { 
            finalImageUrl = ''; 
        }

        const variantRows = document.querySelectorAll('.variant-row');
        const variants = [];
        
        variantRows.forEach(row => {
            let expiryInput = row.querySelector('.var-expiry').value;
            let varIdEl = row.querySelector('.var-id');
            let variantObj = { 
                variantId: varIdEl ? varIdEl.value : '',
                weightOrVolume: row.querySelector('.var-weight').value, 
                price: Number(row.querySelector('.var-price').value), 
                stock: Number(row.querySelector('.var-stock').value),
                lowStockThreshold: Number(row.querySelector('.var-threshold').value),
                sku: row.querySelector('.var-sku').value.trim()
            };
            if (expiryInput) {
                variantObj.expiryDate = expiryInput;
            }
            variants.push(variantObj);
        });

        if (masterId) {
            const onboardPromises = variants.map(v => {
                return fetchFn(`${BACKEND_URL}/api/enterprise/onboard`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        masterProductId: masterId,
                        variantId: v.variantId,
                        sellingPrice: v.price,
                        stock: v.stock,
                        lowStockThreshold: v.lowStockThreshold
                    })
                });
            });

            await Promise.all(onboardPromises);

        } else {
            const p = { 
                name: document.getElementById('new-name').value, 
                category: document.getElementById('new-category').value, 
                brand: document.getElementById('new-brand').value,
                distributorName: document.getElementById('new-distributor').value,
                searchTags: document.getElementById('new-tags').value.trim(), 
                variants: variants 
            };
            
            if (finalImageUrl !== undefined) p.imageUrl = finalImageUrl;

            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `${BACKEND_URL}/api/products/${editId}` : `${BACKEND_URL}/api/products`;

            await fetchFn(url, { 
                method: method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(p) 
            });
        }
        
        if (typeof closeAddProductModal === 'function') closeAddProductModal(); 
        if (typeof inventoryPage !== 'undefined') window.inventoryPage = 1; 
        if (typeof fetchInventory === 'function') fetchInventory(); 
        
        const successMsg = editId ? 'Product Updated!' : (masterId ? 'Catalog Items Synced!' : 'Product Added!');
        if (typeof showToast === 'function') showToast(successMsg);
        
    } catch (err) { 
        console.error("Save Product Error:", err); 
        if (typeof showToast === 'function') showToast('Error saving product.'); 
    } finally { 
        btn.innerText = 'Save Product'; 
        btn.disabled = false; 
    }
}

async function searchRestockItem(overrideSearchTerm = null) {
    const term = overrideSearchTerm || document.getElementById('restock-search').value.trim();
    const resultsContainer = document.getElementById('restock-search-results');
    
    if (term.length < 2) { 
        resultsContainer.innerHTML = ''; 
        return; 
    }
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products?all=true&search=${encodeURIComponent(term)}&limit=10`);
        const result = await res.json();
        
        resultsContainer.innerHTML = '';
        
        if(result.data.length === 0) { 
            resultsContainer.innerHTML = '<p style="padding:10px; font-size:12px; color:var(--text-muted);">No items found.</p>'; 
            return; 
        }
        
        result.data.forEach(p => {
            p.variants.forEach(v => {
                const isMatch = (v.sku === term) || p.name.toLowerCase().includes(term.toLowerCase());
                if (isMatch) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'restock-result-item';
                    itemDiv.innerHTML = `
                        <h4>${p.name}</h4>
                        <p>${v.weightOrVolume} • Current Stock: ${typeof getDisplayStock === 'function' ? getDisplayStock(v) : v.stock} • SKU: ${v.sku || 'N/A'}</p>
                    `;
                    itemDiv.onclick = () => {
                        if(typeof selectItemForRestock === 'function') selectItemForRestock(p, v);
                    };
                    resultsContainer.appendChild(itemDiv);
                }
            });
        });
    } catch (e) { 
        console.error("Search error", e); 
    }
}

async function submitRestock(e) {
    e.preventDefault();
    if (typeof restockSelectedVariant === 'undefined' || !restockSelectedVariant) {
        if (typeof showToast === 'function') showToast("Please select an item to restock.");
        return;
    }
    
    const btn = document.getElementById('submit-restock-btn'); 
    btn.innerText = 'Processing...'; 
    btn.disabled = true;
    
    const paymentStatusEl = document.getElementById('restock-payment-status');
    const paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'Paid';

    const payload = {
        invoiceNumber: document.getElementById('restock-invoice').value.trim(),
        variantId: document.getElementById('restock-variant-id').value,
        addedQuantity: document.getElementById('restock-qty').value,
        purchasingPrice: document.getElementById('restock-cost').value,
        newSellingPrice: document.getElementById('restock-sell').value,
        paymentStatus: paymentStatus,
        storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
    };
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const productId = document.getElementById('restock-product-id').value;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${productId}/restock`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        const result = await res.json();
        
        if (result.success) { 
            if (typeof showToast === 'function') showToast('Shipment Received & Logged! 📦'); 
            if (typeof closeRestockModal === 'function') closeRestockModal(); 
            if (typeof fetchInventory === 'function') fetchInventory(); 
            if (paymentStatus === 'Credit') fetchDistributors(); 
        } else { 
            if (typeof showToast === 'function') showToast('Failed to process restock.'); 
        }
    } catch (err) { 
        if (typeof showToast === 'function') showToast('Network error.'); 
    } finally { 
        btn.innerText = 'Process Restock'; 
        btn.disabled = false; 
    }
}

async function openAccountsPayable() {
    const container = document.getElementById('ap-ledger-list');
    if (!container) return;
    
    document.getElementById('accounts-payable-modal').classList.add('active');
    container.innerHTML = '<p class="empty-state">Loading distributor balances...</p>';
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors`);
        const result = await res.json();
        
        if (result.success) {
            window.currentDistributors = result.data; 
            const debtors = window.currentDistributors.filter(d => d.totalPendingAmount > 0);
            
            container.innerHTML = '';
            if (debtors.length === 0) {
                container.innerHTML = '<p class="empty-state" style="color:#10b981;">All supplier bills are paid! 🎉</p>';
                return;
            }
            
            debtors.forEach(d => {
                container.innerHTML += `
                    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="color:#991b1b; margin-bottom:4px;">${d.name}</h4>
                            <p style="font-size:12px; color:#b91c1c; font-weight:600;">Total Paid Lifetime: Rs ${d.totalPaidAmount.toFixed(2)}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size:18px; font-weight:800; color:#dc2626; margin-bottom:8px;">Rs ${d.totalPendingAmount.toFixed(2)}</div>
                            <button class="primary-btn-small" style="background:#dc2626;" onclick="if(typeof promptDistributorPayment === 'function') promptDistributorPayment('${d._id}', '${d.name.replace(/'/g, "\\'")}', ${d.totalPendingAmount})">Log Payment</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch(e) {
        container.innerHTML = '<p class="empty-state">Error loading balances.</p>';
    }
}

function promptDistributorPayment(id, name, maxAmount) {
    const amountStr = prompt(`Logging payment to ${name}.\nOutstanding Balance: Rs ${maxAmount}\n\nEnter amount paid (Rs):`, maxAmount);
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        if (typeof showToast === 'function') showToast("Invalid amount.");
        return;
    }
    
    const mode = prompt("Payment Mode (e.g. Bank Transfer, Cash, UPI):", "Bank Transfer");
    const note = prompt("Reference Note / Check Number (Optional):", "");
    
    submitDistributorPayment(id, amount, mode, note);
}

async function submitDistributorPayment(id, amount, mode, note) {
    if (typeof showToast === 'function') showToast('Processing payment record...');
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/distributors/${id}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, paymentMode: mode, referenceNote: note })
        });
        
        const result = await res.json();
        if (result.success) {
            if (typeof showToast === 'function') showToast('Supplier payment logged successfully! ✅');
            openAccountsPayable(); 
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Error processing payment.');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Network error logging payment.');
    }
}

function quickRestock(productId, variantId, event) {
    event.stopPropagation();
    const product = currentInventory.find(p => p._id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v._id === variantId);
    if (!variant) return;

    if (typeof openRestockModal === 'function') openRestockModal();
    if (typeof selectItemForRestock === 'function') selectItemForRestock(product, variant);
}

async function submitRTV(e) {
    e.preventDefault();
    if (typeof rtvSelectedVariant === 'undefined' || !rtvSelectedVariant) return;
    
    const btn = document.getElementById('submit-rtv-btn');
    btn.innerText = 'Processing...';
    btn.disabled = true;
    
    const payload = {
        variantId: rtvSelectedVariant.variantId,
        distributorName: document.getElementById('rtv-distributor').value,
        returnedQuantity: parseInt(document.getElementById('rtv-qty').value),
        refundAmount: parseFloat(document.getElementById('rtv-refund').value) || 0,
        reason: document.getElementById('rtv-reason').value,
        storeId: typeof currentStoreId !== 'undefined' ? currentStoreId : null
    };
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${rtvSelectedVariant.productId}/rtv`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.success) {
            if (typeof showToast === 'function') showToast('Return Processed Successfully! 🔙');
            if (typeof generateReturnChalanPDF === 'function') {
                generateReturnChalanPDF(
                    payload.distributorName, 
                    document.getElementById('rtv-item-name').innerText, 
                    payload.returnedQuantity, 
                    payload.refundAmount, 
                    payload.reason
                );
            }
            if (typeof closeRTVModal === 'function') closeRTVModal();
            if (typeof fetchInventory === 'function') fetchInventory();
        } else {
            if (typeof showToast === 'function') showToast(result.message || 'Failed to process return.');
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast('Network error.');
    } finally {
        btn.innerText = 'Process Return';
        btn.disabled = false;
    }
}

async function saveInlineEdit(productId, variantId, field, element, event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    element.blur();
    
    const newVal = element.value;
    const product = currentInventory.find(p => p._id === productId);
    const variant = product.variants.find(v => v._id === variantId);
    
    if (Number(newVal) === variant[field]) return; 
    
    variant[field] = Number(newVal);
    if (typeof showToast === 'function') showToast('Saving update...');
    
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        const result = await res.json();
        if (result.success) {
            if (typeof showToast === 'function') showToast('Item updated successfully!');
            if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard();
        } else {
            if (typeof showToast === 'function') showToast('Failed to update.');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error saving inline edit.');
    }
}

async function openAIForecastModal() {
    const modal = document.getElementById('ai-forecast-modal');
    const container = document.getElementById('ai-forecast-container');
    
    if (modal) modal.classList.add('active');
    
    if (container) {
        container.innerHTML = `
            <div class="skeleton" style="height: 60px; background: #E2E8F0; border-radius: 8px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 60px; background: #E2E8F0; border-radius: 8px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 60px; background: #E2E8F0; border-radius: 8px; margin-bottom: 12px;"></div>
        `;
    }

    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/ai/forecast`);
        const result = await res.json();
        
        if (result.success && result.data) {
            container.innerHTML = '';
            result.data.forEach(item => {
                let urgencyColor = '#10b981'; 
                let bg = '#f0fdf4';
                let border = '#bbf7d0';
                
                if (item.urgency === 'High') {
                    urgencyColor = '#ef4444';
                    bg = '#fef2f2';
                    border = '#fecaca';
                } else if (item.urgency === 'Medium') {
                    urgencyColor = '#f59e0b';
                    bg = '#fffbeb';
                    border = '#fef3c7';
                }

                container.innerHTML += `
                    <div style="background: ${bg}; padding: 16px; border-radius: 12px; border: 1px solid ${border}; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <h4 style="margin: 0; color: #0f172a; font-size: 15px;">${item.itemName}</h4>
                            <span style="background: ${urgencyColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase;">${item.urgency}</span>
                        </div>
                        <p style="font-size: 14px; font-weight: 700; color: ${urgencyColor}; margin-bottom: 4px;">${item.action}</p>
                        <p style="font-size: 12px; color: #475569; line-height: 1.4;">${item.reason}</p>
                    </div>
                `;
            });
        } else {
            container.innerHTML = `<p class="empty-state">Failed to generate AI Forecast: ${result.message}</p>`;
        }
    } catch (error) {
        if (container) container.innerHTML = `<p class="empty-state">Network error communicating with Gemini API.</p>`;
    }
}

function closeAIForecastModal() {
    const modal = document.getElementById('ai-forecast-modal');
    if (modal) modal.classList.remove('active');
}

// --- NEW: PHASE 2 ONE-CLICK CATALOG ONBOARDING ---
async function searchMasterCatalog(query) {
    if (!query || query.length < 3) return;
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        const res = await fetchFn(`${BACKEND_URL}/api/enterprise/catalog?search=${encodeURIComponent(query)}`);
        const result = await res.json();
        
        // Displays results in modal where manager clicks "Sync to Store"
        if (result.success && result.data.length > 0) {
            let msg = `Found ${result.data.length} Master Items:\n`;
            result.data.slice(0, 5).forEach(m => msg += `- ${m.name} [SKU: ${m.variants[0]?.sku || 'N/A'}]\n`);
            alert(msg + "\n(In production, clicking an item injects the Master ID into the submit form)");
        } else {
            if (typeof showToast === 'function') showToast("Item not found in Global Catalog");
        }
    } catch(e) { 
        console.error("Master Search Error", e); 
    }
}

// --- NEW: PHASE 2 DISTRIBUTOR WHOLESALE PROCUREMENT ---
async function fetchDistributorWholesale(distributorId) {
    if (typeof showToast === 'function') showToast("Fetching live supplier catalog...");
    try {
        const fetchFn = typeof adminFetchWithAuth === 'function' ? adminFetchWithAuth : fetch;
        // Allows local shop owners to browse dynamic wholesale prices from local suppliers
        const res = await fetchFn(`${BACKEND_URL}/api/distributors/${distributorId}/catalog`);
        const result = await res.json();
        
        if (result.success && result.data) {
            alert(`Distributor Catalog Loaded. Bulk ordering is available for ${result.data.wholesaleCatalog.length} items.`);
        }
    } catch(e) { 
        console.warn("Wholesale fetch unavailable on this route currently.", e); 
    }
}
