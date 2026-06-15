import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'hexer-offline';
const DB_VERSION = 2; // Upgrading to 2 to add snapshot, outbox, and failed stores safely

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('shown')) {
        db.createObjectStore('shown', { keyPath: 'messageId' });
      }
      if (!db.objectStoreNames.contains('snapshot')) {
        db.createObjectStore('snapshot', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('failed')) {
        db.createObjectStore('failed', { keyPath: 'id' });
      }
    },
  });
}

// Promise-based helper functions:
export async function getFromStore(storeName: string, id: string): Promise<any> {
  const db = await getDB();
  return db.get(storeName, id);
}

export async function putToStore(storeName: string, item: any): Promise<void> {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function getAllFromStore(storeName: string): Promise<any[]> {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

/**
 * Prunes shown notifications older than 48 hours for general clean up
 */
export async function pruneShown(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('shown', 'readwrite');
  const store = tx.store;
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;

  let cursor = await store.openCursor();
  while (cursor) {
    const val = cursor.value;
    if (val && val.timestamp && val.timestamp < cutoff) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
