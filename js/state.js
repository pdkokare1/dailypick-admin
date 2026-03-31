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

const CLOUDINARY_CLOUD_NAME = 'dz2q2tq30'; 
const CLOUDINARY_UPLOAD_PRESET = 'dailypick_preset'; 

// --- NEW: Multi-Store State Variables ---
let currentStoreId = localStorage.getItem('dailypick_storeId') || null;
let currentRegisterId = localStorage.getItem('dailypick_registerId') || null;
let availableStores = [];
let availableRegisters = [];

// --- OPTIMIZATION: IndexedDB Offline Queue Logic (Singleton Connection) ---
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

const dbPromise = initDB().catch(console.error);

// NEW: Abstracted Transaction Wrapper
async function executeIDBTransaction(mode, action) {
    if (!db) db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = action(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToIDB(order) {
    return executeIDBTransaction("readwrite", store => store.add(order));
}

async function getAllFromIDB() {
    return executeIDBTransaction("readonly", store => store.getAll());
}

async function deleteFromIDB(id) {
    return executeIDBTransaction("readwrite", store => store.delete(id));
}

async function getOfflineCount() {
    return executeIDBTransaction("readonly", store => store.count());
}
