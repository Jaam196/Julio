import { Ticket } from '../types';

const DB_NAME = 'TicketManagerDB';
const DB_VERSION = 1;
const STORE_TICKETS = 'tickets';
const STORE_SETTINGS = 'settings';

let dbInstance: IDBDatabase | null = null;
let useFallback = false;

// Fallback in-memory cache
const memoryTickets: Record<string, Ticket> = {};
const memorySettings: Record<string, any> = {};

// Load fallback data from localStorage if available
try {
  const savedTickets = localStorage.getItem('fallback_tickets');
  if (savedTickets) {
    const parsed = JSON.parse(savedTickets);
    Object.assign(memoryTickets, parsed);
  }
  const savedSettings = localStorage.getItem('fallback_settings');
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings);
    Object.assign(memorySettings, parsed);
  }
} catch (e) {
  console.warn('LocalStorage is not available for fallback:', e);
}

function saveFallbackTickets() {
  try {
    localStorage.setItem('fallback_tickets', JSON.stringify(memoryTickets));
  } catch (e) {
    // Fail silently
  }
}

function saveFallbackSettings() {
  try {
    localStorage.setItem('fallback_settings', JSON.stringify(memorySettings));
  } catch (e) {
    // Fail silently
  }
}

export function initDB(): Promise<any> {
  return new Promise((resolve) => {
    if (useFallback) {
      resolve(null);
      return;
    }
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    try {
      if (typeof indexedDB === 'undefined') {
        console.warn('indexedDB is not defined. Falling back to memory/localStorage.');
        useFallback = true;
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_TICKETS)) {
            db.createObjectStore(STORE_TICKETS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS);
          }
        } catch (err) {
          console.error('Error during IndexedDB upgrade:', err);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB blocked or failed to open. Falling back to memory/localStorage:', event);
        useFallback = true;
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB threw error on open. Falling back to memory/localStorage:', e);
      useFallback = true;
      resolve(null);
    }
  });
}

export async function dbSaveTicket(ticket: Ticket): Promise<void> {
  if (useFallback) {
    memoryTickets[ticket.id] = ticket;
    saveFallbackTickets();
    return;
  }
  
  try {
    const db = await initDB();
    if (useFallback) {
      memoryTickets[ticket.id] = ticket;
      saveFallbackTickets();
      return;
    }
    const tx = db.transaction(STORE_TICKETS, 'readwrite');
    const store = tx.objectStore(STORE_TICKETS);
    return new Promise((resolve, reject) => {
      const req = store.put(ticket);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('dbSaveTicket failed, falling back:', e);
    memoryTickets[ticket.id] = ticket;
    saveFallbackTickets();
  }
}

export async function dbSaveTicketsBulk(tickets: Ticket[]): Promise<void> {
  if (useFallback) {
    tickets.forEach(ticket => {
      memoryTickets[ticket.id] = ticket;
    });
    saveFallbackTickets();
    return;
  }

  try {
    const db = await initDB();
    if (useFallback) {
      tickets.forEach(ticket => {
        memoryTickets[ticket.id] = ticket;
      });
      saveFallbackTickets();
      return;
    }
    const tx = db.transaction(STORE_TICKETS, 'readwrite');
    const store = tx.objectStore(STORE_TICKETS);

    return new Promise((resolve, reject) => {
      tickets.forEach((ticket) => {
        store.put(ticket);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('dbSaveTicketsBulk failed, falling back:', e);
    tickets.forEach(ticket => {
      memoryTickets[ticket.id] = ticket;
    });
    saveFallbackTickets();
  }
}

export async function dbGetTickets(): Promise<Ticket[]> {
  if (useFallback) {
    return Object.values(memoryTickets);
  }

  try {
    const db = await initDB();
    if (useFallback) {
      return Object.values(memoryTickets);
    }
    const tx = db.transaction(STORE_TICKETS, 'readonly');
    const store = tx.objectStore(STORE_TICKETS);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('dbGetTickets failed, falling back:', e);
    return Object.values(memoryTickets);
  }
}

export async function dbDeleteTicket(id: string): Promise<void> {
  if (useFallback) {
    delete memoryTickets[id];
    saveFallbackTickets();
    return;
  }

  try {
    const db = await initDB();
    if (useFallback) {
      delete memoryTickets[id];
      saveFallbackTickets();
      return;
    }
    const tx = db.transaction(STORE_TICKETS, 'readwrite');
    const store = tx.objectStore(STORE_TICKETS);
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('dbDeleteTicket failed, falling back:', e);
    delete memoryTickets[id];
    saveFallbackTickets();
  }
}

export async function dbClearTickets(status?: 'waiting' | 'active' | 'delivered' | 'missing' | 'all'): Promise<void> {
  if (useFallback) {
    if (!status || status === 'all') {
      Object.keys(memoryTickets).forEach(key => delete memoryTickets[key]);
    } else {
      Object.keys(memoryTickets).forEach(key => {
        if (memoryTickets[key].status === status) {
          delete memoryTickets[key];
        }
      });
    }
    saveFallbackTickets();
    return;
  }

  try {
    const db = await initDB();
    if (useFallback) {
      if (!status || status === 'all') {
        Object.keys(memoryTickets).forEach(key => delete memoryTickets[key]);
      } else {
        Object.keys(memoryTickets).forEach(key => {
          if (memoryTickets[key].status === status) {
            delete memoryTickets[key];
          }
        });
      }
      saveFallbackTickets();
      return;
    }
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
  } catch (e) {
    console.error('dbClearTickets failed, falling back:', e);
    if (!status || status === 'all') {
      Object.keys(memoryTickets).forEach(key => delete memoryTickets[key]);
    } else {
      Object.keys(memoryTickets).forEach(key => {
        if (memoryTickets[key].status === status) {
          delete memoryTickets[key];
        }
      });
    }
    saveFallbackTickets();
  }
}

// Settings stores
export async function dbSaveSettings<T>(key: string, value: T): Promise<void> {
  if (useFallback) {
    memorySettings[key] = value;
    saveFallbackSettings();
    return;
  }

  try {
    const db = await initDB();
    if (useFallback) {
      memorySettings[key] = value;
      saveFallbackSettings();
      return;
    }
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    return new Promise((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('dbSaveSettings failed, falling back:', e);
    memorySettings[key] = value;
    saveFallbackSettings();
  }
}

export async function dbGetSettings<T>(key: string): Promise<T | null> {
  if (useFallback) {
    return (memorySettings[key] as T) || null;
  }

  try {
    const db = await initDB();
    if (useFallback) {
      return (memorySettings[key] as T) || null;
    }
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('dbGetSettings failed, falling back:', e);
    return (memorySettings[key] as T) || null;
  }
}

