const DB_NAME = 'swumed-offline-db';
const DB_VERSION = 1;

const STORES = {
  CACHE: 'cache',
  PENDING: 'pending',
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE);
      }

      if (!db.objectStoreNames.contains(STORES.PENDING)) {
        db.createObjectStore(STORES.PENDING, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveOfflineData(key, value) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);

    const request = store.put(
      {
        value,
        savedAt: Date.now(),
      },
      key
    );

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineData(key) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readonly');
    const store = transaction.objectStore(STORES.CACHE);

    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.value ?? null);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineData(key) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CACHE, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE);

    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function addPendingOperation(operation) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING);

    const request = store.add({
      ...operation,
      createdAt: Date.now(),
    });

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getPendingOperations() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING, 'readonly');
    const store = transaction.objectStore(STORES.PENDING);

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function removePendingOperation(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING);

    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}