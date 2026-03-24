/* js/state.js */

const BACKEND_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://dailypick-backend-production-05d6.up.railway.app';

let currentInventory = [];
let currentOrders = [];
let currentCategories = [];
let currentBrands = [];
let currentDistributors = [];
let currentCustomers = [];
let allHistoricalOrders = []; 
let allHistoricalExpenses = []; // Added for deep P&L analytics

let activeOrder = null;
let posCart = [];
let posContinuousScanner = null;
let posScanCooldown = false;

let html5QrcodeScanner = null;
let currentSkuInputTarget = null;
let restockSelectedVariant = null;

let inventoryPage = 1;
let inventorySearchTerm = '';
let inventoryCategoryFilter = 'All';
let inventoryBrandFilter = 'All';
let inventoryDistributorFilter = 'All';

let isLowStockFilterActive = false;
let isOutStockFilterActive = false;
let isDeadStockFilterActive = false;
let selectedInventory = new Set();

// --- FIXED: Added the missing global variable for the Live Stream ---
let adminEventSource = null;

const CLOUDINARY_CLOUD_NAME = 'dz2q2tq30'; 
const CLOUDINARY_UPLOAD_PRESET = 'dailypick_preset'; 

// --- IndexedDB Offline Queue Logic ---
const dbName = "DailyPickDB";
const storeName = "offlineOrders";
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            let database = e.target.result;
            if (!database.objectStoreNames.contains(storeName)) {
                database.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToIDB(order) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.add(order);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllFromIDB() {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromIDB(id) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getOfflineCount() {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

initDB().catch(console.error);
