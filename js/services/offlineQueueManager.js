/* js/services/offlineQueueManager.js */
import { CONFIG } from '../core/config.js';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            let database = e.target.result;
            if (!database.objectStoreNames.contains(CONFIG.STORE_NAME)) {
                database.createObjectStore(CONFIG.STORE_NAME, { keyPath: "id", autoIncrement: true });
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

export async function executeIDBTransaction(mode, action) {
    if (!db) db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE_NAME, mode);
        const store = tx.objectStore(CONFIG.STORE_NAME);
        const request = action(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveToIDB(order) {
    return executeIDBTransaction("readwrite", store => store.add(order));
}

export async function getAllFromIDB() {
    return executeIDBTransaction("readonly", store => store.getAll());
}

export async function deleteFromIDB(id) {
    return executeIDBTransaction("readwrite", store => store.delete(id));
}

export async function getOfflineCount() {
    return executeIDBTransaction("readonly", store => store.count());
}

// BRIDGE: Exposing to window to ensure POS checkout logic does not break during transition
window.initDB = initDB;
window.executeIDBTransaction = executeIDBTransaction;
window.saveToIDB = saveToIDB;
window.getAllFromIDB = getAllFromIDB;
window.deleteFromIDB = deleteFromIDB;
window.getOfflineCount = getOfflineCount;
