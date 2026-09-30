function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mono-drafts', 2);
    request.onupgradeneeded = () => {
      for (const name of ['drafts', 'snapshots']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(storeName, mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let result;
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || request.error);
    };
  });
}
export const readDraft = key => transaction('drafts', 'readonly', store => store.get(key));
export const writeDraft = (key, value) => transaction('drafts', 'readwrite', store => store.put(value, key));
export const clearDraft = key => transaction('drafts', 'readwrite', store => store.delete(key));
export const readSnapshot = account => transaction('snapshots', 'readonly', store => store.get(account));
export const writeSnapshot = (account, value) => transaction('snapshots', 'readwrite', store => store.put(value, account));
