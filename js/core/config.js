/* js/core/config.js */

export const CONFIG = {
    BACKEND_URL: window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://dailypick-backend-production-05d6.up.railway.app',
    CLOUDINARY_CLOUD_NAME: 'dz2q2tq30',
    CLOUDINARY_UPLOAD_PRESET: 'dailypick_preset',
    DB_NAME: "DailyPickDB",
    STORE_NAME: "offlineOrders"
};

// BRIDGE: Exposing to window to ensure app.js and pos.js do not break during transition
window.BACKEND_URL = CONFIG.BACKEND_URL;
window.CLOUDINARY_CLOUD_NAME = CONFIG.CLOUDINARY_CLOUD_NAME;
window.CLOUDINARY_UPLOAD_PRESET = CONFIG.CLOUDINARY_UPLOAD_PRESET;
