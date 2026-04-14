/* js/utils/cartCalculator.js */

export const CartCalculator = {
    calculate: function(posCart, currentInventory, currentPromotions, currentCustomerProfile, appliedLoyaltyPoints) {
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        posCart.forEach((item) => {
            const itemTotal = item.qty * item.price;
            subtotal += itemTotal;
            
            let tRate = item.taxRate || 0;
            if (tRate > 0) {
                if (item.taxType === 'Exclusive') {
                    totalTax += itemTotal * (tRate / 100);
                } else {
                    totalTax += itemTotal - (itemTotal / (1 + (tRate / 100)));
                }
            }
        });

        if (currentPromotions && currentPromotions.length > 0) {
            const now = new Date();
            const currentHourMin = now.getHours() * 100 + now.getMinutes(); 

            currentPromotions.forEach(promo => {
                if (promo.isActive) {
                    if (promo.startDate && new Date(promo.startDate) > now) return;
                    if (promo.endDate && new Date(promo.endDate) < now) return;
                    if (promo.startTime && promo.endTime) {
                        const start = parseInt(promo.startTime.replace(':', ''));
                        const end = parseInt(promo.endTime.replace(':', ''));
                        if (currentHourMin < start || currentHourMin > end) return;
                    }

                    let applicableSubtotal = 0;
                    let applicableItems = [];

                    posCart.forEach(item => {
                        let isApplicable = true;
                        if (promo.applicableCategory && promo.applicableCategory !== 'All') {
                            const invItem = currentInventory.find(p => p._id === item.productId);
                            if (!invItem || invItem.category !== promo.applicableCategory) {
                                isApplicable = false;
                            }
                        }
                        if (isApplicable) {
                            applicableSubtotal += (item.price * item.qty);
                            applicableItems.push(item);
                        }
                    });

                    if (applicableSubtotal > 0 && applicableSubtotal >= (promo.minCartValue || 0)) {
                        if (promo.type === 'PERCENTAGE' || promo.type === 'percentage') {
                            totalDiscount += applicableSubtotal * (promo.value / 100);
                        } else if (promo.type === 'FLAT_AMOUNT' || promo.type === 'fixed') {
                            totalDiscount += promo.value; 
                        } else if (promo.type === 'BOGO') {
                            const bQty = promo.buyQty || 1;
                            const gQty = promo.getQty || 1;
                            
                            applicableItems.forEach(item => {
                                const totalSets = Math.floor(item.qty / (bQty + gQty));
                                if (totalSets > 0) {
                                    totalDiscount += totalSets * gQty * item.price;
                                }
                            });
                        }
                    }
                }
            });
        }

        let tierDiscountAmount = 0;
        let tierName = "";
        if (currentCustomerProfile && currentCustomerProfile.loyaltyPoints >= 500) {
            tierName = "Gold Tier (5% Off)";
            tierDiscountAmount = subtotal * 0.05;
            totalDiscount += tierDiscountAmount;
        } else if (currentCustomerProfile && currentCustomerProfile.loyaltyPoints >= 200) {
            tierName = "Silver Tier (2% Off)";
            tierDiscountAmount = subtotal * 0.02;
            totalDiscount += tierDiscountAmount;
        }

        let hasExclusive = posCart.some(i => i.taxType === 'Exclusive');
        let preLoyaltyTotal = subtotal - totalDiscount + (hasExclusive ? totalTax : 0);
        
        let finalLoyaltyPoints = appliedLoyaltyPoints || 0;
        if (finalLoyaltyPoints > preLoyaltyTotal) {
            finalLoyaltyPoints = preLoyaltyTotal;
        }

        let grandTotal = preLoyaltyTotal - finalLoyaltyPoints;
        
        return { subtotal, totalTax, totalDiscount, grandTotal, tierDiscountAmount, tierName, finalLoyaltyPoints };
    }
};

// BRIDGE: Exposing to window to ensure pos.js does not break during transition
window.CartCalculator = CartCalculator;
