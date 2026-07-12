import { Ticket } from '../types';

const DB_NAME = 'TicketManagerDB';
const DB_VERSION = 1;
const STORE_TICKETS = 'tickets';
const STORE_SETTINGS = 'settings';

let dbInstance: IDBDatabase | null = null;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TICKETS)) {
        db.createObjectStore(STORE_TICKETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// Helper to get transaction
async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

export async function dbSaveTicket(ticket: Ticket): Promise<void> {
  const store = await getStore(STORE_TICKETS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(ticket);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbSaveTicketsBulk(tickets: Ticket[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TICKETS, 'readwrite');
  const store = tx.objectStore(STORE_TICKETS);

  return new Promise((resolve, reject) => {
    tickets.forEach((ticket) => {
      store.put(ticket);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetTickets(): Promise<Ticket[]> {
  const store = await getStore(STORE_TICKETS, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDeleteTicket(id: string): Promise<void> {
  const store = await getStore(STORE_TICKETS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClearTickets(status?: 'waiting' | 'active' | 'delivered' | 'missing' | 'all'): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TICKETS, 'readwrite');
  const store = tx.objectStore(STORE_TICKETS);

  if (!status || status === 'all') {
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Selective clear
  return new Promise((resolve, reject) => {
    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const ticket = cursor.value as Ticket;
        if (ticket.status === status) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// Settings stores
export async function dbSaveSettings<T>(key: string, value: T): Promise<void> {
  const store = await getStore(STORE_SETTINGS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetSettings<T>(key: string): Promise<T | null> {
  const store = await getStore(STORE_SETTINGS, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T || null);
    req.onerror = () => reject(req.error);
  });
}
