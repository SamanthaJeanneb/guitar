// Minimal IndexedDB helpers for storing audio ArrayBuffers by key
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('guitar-store', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileToIDB(key: string, file: File): Promise<void> {
  const ab = await file.arrayBuffer();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(ab, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getFileBlobFromIDB(key: string, mime = 'audio/mpeg'): Promise<Blob> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const get = tx.objectStore('files').get(key);
    get.onsuccess = () => {
      const result = get.result as ArrayBuffer | undefined;
      db.close();
      if (!result) return reject(new Error('NotFound'));
      resolve(new Blob([result], { type: mime }));
    };
    get.onerror = () => { db.close(); reject(get.error); };
  });
}

export async function deleteFileFromIDB(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });

}

// Chart text helpers: store/retrieve chart text (string) under keys like `${songId}-chart`
export async function saveChartToIDB(key: string, chartText: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(chartText, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getChartFromIDB(key: string): Promise<string> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const get = tx.objectStore('files').get(key);
    get.onsuccess = () => {
      const result = get.result as string | ArrayBuffer | undefined;
      db.close();
      if (!result) return reject(new Error('NotFound'));
      if (typeof result === 'string') return resolve(result);
      // If a previous binary was stored under same key, convert to string
      try {
        const decoder = new TextDecoder();
        resolve(decoder.decode(result as ArrayBuffer));
      } catch {
        reject(new Error('InvalidChartData'));
      }
    };
    get.onerror = () => { db.close(); reject(get.error); };
  });
}

