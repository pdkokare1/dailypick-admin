/* js/state.js */

const BACKEND_URL = 'https://dailypick-backend-production-05d6.up.railway.app';
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; 
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; 

// State Variables
let currentOrders = []; 
let allHistoricalOrders = []; 
let currentInventory = []; 
let currentCategories = []; 
let currentBrands = []; 
let currentDistributors = []; 

let activeOrder = null; 
let adminEventSource = null; 
let currentOrderTab = 'All'; 
let currentOrderLayout = 'list'; 
let selectedOrders = new Set();
let selectedInventory = new Set(); 

let inventoryPage = 1;
let inventorySearchTerm = '';
let inventoryCategoryFilter = 'All';
let inventoryBrandFilter = 'All';      
let inventoryDistributorFilter = 'All'; 

let isLowStockFilterActive = false; 
let isOutStockFilterActive = false; 
let isDeadStockFilterActive = false; 

let revenueChartInstance = null; 

// Scanner & Restock State
let html5QrcodeScanner = null;
let currentSkuInputTarget = null; 
let restockSelectedVariant = null; 

// POS State
let posContinuousScanner = null;
let posScanCooldown = false;
let posCart = [];

// Credit tracking
let currentCustomerPhone = null;

// Daily Expenses
let dailyExpenses = JSON.parse(localStorage.getItem('dailypick_expenses') || '[]');

// DOM Elements
const dailyRevenueEl = document.getElementById('daily-revenue'); 
const pendingCountEl = document.getElementById('pending-count'); 
const ordersFeed = document.getElementById('orders-list-view'); 
const ordersKanban = document.getElementById('orders-kanban-view');
const orderModalOverlay = document.getElementById('order-modal-overlay');
const inventoryFeed = document.getElementById('inventory-feed'); 

// Expanded View Routing 
const views = { 
    overview: document.getElementById('overview-view'), 
    pos: document.getElementById('pos-view'), 
    orders: document.getElementById('orders-view'), 
    inventory: document.getElementById('inventory-view'),
    analytics: document.getElementById('analytics-view'),
    customers: document.getElementById('customers-view') 
}; 

const navBtns = { 
    overview: document.getElementById('nav-overview'), 
    pos: document.getElementById('nav-pos'), 
    orders: document.getElementById('nav-orders'), 
    inventory: document.getElementById('nav-inventory'),
    analytics: document.getElementById('nav-analytics'),
    customers: document.getElementById('nav-customers') 
};
