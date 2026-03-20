// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    fetchCategories(); 
    fetchBrands();
    fetchDistributors();
    fetchPromotions(); // NEW: Added for Phase 2 to load discount rules on startup
    fetchOrders();
    renderOverview(); 
});
