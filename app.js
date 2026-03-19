// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    fetchCategories(); 
    fetchBrands();
    fetchDistributors();
    fetchOrders();
    renderOverview(); 
});
