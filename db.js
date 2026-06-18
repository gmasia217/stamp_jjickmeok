const DB_NAME = 'TicketTrackerDB';
const DB_VERSION = 1;
let dbInstance;

const DB = {
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('shows')) {
          db.createObjectStore('shows', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('records')) {
          const recordStore = db.createObjectStore('records', { keyPath: 'id' });
          recordStore.createIndex('showId', 'showId', { unique: false });
          recordStore.createIndex('date', 'date', { unique: false });
        }
      };
      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
