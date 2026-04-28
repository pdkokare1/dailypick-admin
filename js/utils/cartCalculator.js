/* js/utils/cartCalculator.js */

export const CartCalculator = {
    calculate: function(posCart, currentInventory, currentPromotions, currentCustomerProfile, appliedLoyaltyPoints) {
        // OPTIMIZATION: Enterprise Integer Math (Paise/Cents) to prevent floating-point calculation drift
        // Perfect parity with the Rs standardization in the backend Ledger workflows.
        let subtotalPaise = 0;
        let totalTaxPaise = 0;
        let totalDiscountPaise = 0;

        posCart.forEach((item) => {
            // Convert base price to integer immediately
            const pricePaise = Math.round(item.price * 100);
            const itemTotalPaise = item.qty * pricePaise;
            subtotalPaise += itemTotalPaise;
            
            let tRate = item.taxRate || 0;
            if (tRate > 0) {
                if (item.taxType === 'Exclusive') {
                    totalTaxPaise += Math.round(itemTotalPaise * (tRate / 100));
                } else {
                    totalTaxPaise += itemTotalPaise - Math.round(itemTotalPaise / (1 + (tRate / 100)));
                }
            }
        });

        if (currentPromotions && currentPromotions.length > 0) {
            const now = new Date();
            const currentHourMin = now.getHours() * 100 + now.getMinutes(); 

            // OPTIMIZATION: Build a hash map of the inventory once for O(1) lookups during promotion calculations
            const inventoryMap = new Map();
            currentInventory.forEach(p => inventoryMap.set(p._id, p));

            currentPromotions.forEach(promo => {
                if (promo.isActive) {
                    if (promo.startDate && new Date(promo.startDate) > now) return;
                    if (promo.endDate && new Date(promo.endDate) < now) return;
                    if (promo.startTime && promo.endTime) {
                        const start = parseInt(promo.startTime.replace(':', ''));
                        const end = parseInt(promo.endTime.replace(':', ''));
                        if (currentHourMin < start || currentHourMin > end) return;
                    }

                    let applicableSubtotalPaise = 0;
                    let applicableItems = [];

                    posCart.forEach(item => {
                        let isApplicable = true;
                        if (promo.applicableCategory && promo.applicableCategory !== 'All') {
                            // Fetch from the O(1) Map instead of O(N) Array.find
                            const invItem = inventoryMap.get(item.productId);
                            if (!invItem || invItem.category !== promo.applicableCategory) {
                                isApplicable = false;
                            }
                        }
                        if (isApplicable) {
                            const pricePaise = Math.round(item.price * 100);
                            applicableSubtotalPaise += (pricePaise * item.qty);
                            applicableItems.push({ ...item, pricePaise });
                        }
                    });

                    const minCartValuePaise = Math.round((promo.minCartValue || 0) * 100);

                    if (applicableSubtotalPaise > 0 && applicableSubtotalPaise >= minCartValuePaise) {
                        if (promo.type === 'PERCENTAGE' || promo.type === 'percentage') {
                            totalDiscountPaise += Math.round(applicableSubtotalPaise * (promo.value / 100));
                        } else if (promo.type === 'FLAT_AMOUNT' || promo.type === 'fixed') {
                            totalDiscountPaise += Math.round(promo.value * 100); 
                        } else if (promo.type === 'BOGO') {
                            const bQty = promo.buyQty || 1;
                            const gQty = promo.getQty || 1;
                            
                            applicableItems.forEach(item => {
                                const totalSets = Math.floor(item.qty / (bQty + gQty));
                                if (totalSets > 0) {
                                    totalDiscountPaise += totalSets * gQty * item.pricePaise;
                                }
                            });
                        }
                    }
                }
            });
        }

        let tierDiscountAmountPaise = 0;
        let tierName = "";
        if (currentCustomerProfile && currentCustomerProfile.loyaltyPoints >= 500) {
            tierName = "Gold Tier (5% Off)";
            tierDiscountAmountPaise = Math.round(subtotalPaise * 0.05);
            totalDiscountPaise += tierDiscountAmountPaise;
        } else if (currentCustomerProfile && currentCustomerProfile.loyaltyPoints >= 200) {
            tierName = "Silver Tier (2% Off)";
            tierDiscountAmountPaise = Math.round(subtotalPaise * 0.02);
            totalDiscountPaise += tierDiscountAmountPaise;
        }

        let hasExclusive = posCart.some(i => i.taxType === 'Exclusive');
        let preLoyaltyTotalPaise = subtotalPaise - totalDiscountPaise + (hasExclusive ? totalTaxPaise : 0);
        
        let finalLoyaltyPointsPaise = Math.round((appliedLoyaltyPoints || 0) * 100);
        if (finalLoyaltyPointsPaise > preLoyaltyTotalPaise) {
            finalLoyaltyPointsPaise = preLoyaltyTotalPaise;
        }

        let grandTotalPaise = preLoyaltyTotalPaise - finalLoyaltyPointsPaise;
        
        // ENTERPRISE FIX: Ensure strictly fixed Numbers are emitted to completely neutralize fractional anomalies in V8 JS Engine
        const subtotal = Number((subtotalPaise / 100).toFixed(2));
        const totalTax = Number((totalTaxPaise / 100).toFixed(2));
        const totalDiscount = Number((totalDiscountPaise / 100).toFixed(2));
        const grandTotal = Number((grandTotalPaise / 100).toFixed(2));
        const tierDiscountAmount = Number((tierDiscountAmountPaise / 100).toFixed(2));
        const finalLoyaltyPoints = Number((finalLoyaltyPointsPaise / 100).toFixed(2));

        return { subtotal, totalTax, totalDiscount, grandTotal, tierDiscountAmount, tierName, finalLoyaltyPoints };
    }
};

// BRIDGE: Exposing to window to ensure pos.js does not break during transition
window.CartCalculator = CartCalculator;
