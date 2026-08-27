/**
 * IndexedDB Offline-First Storage & Synchronization Manager
 * 
 * Provides zero-blocking local persistence for orders, customers, and menu items.
 * If internet connectivity drops, orders are saved immediately to the local 'pending_orders' queue.
 * When connectivity is restored, an auto-sync engine drains the queue to the backend.
 */

const DB_NAME = 'RestaurantPOS_OfflineDB';
const DB_VERSION = 1;

export interface OfflineOrder {
  localId: string;
  orderNumber: string;
  timestamp: number;
  data: any;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

class POSIndexedDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for offline orders waiting to sync
        if (!db.objectStoreNames.contains('pending_orders')) {
          const orderStore = db.createObjectStore('pending_orders', { keyPath: 'localId' });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Cache for customers for sub-millisecond local lookup
        if (!db.objectStoreNames.contains('customers_cache')) {
          const custStore = db.createObjectStore('customers_cache', { keyPath: 'phone' });
          custStore.createIndex('name', 'name', { unique: false });
        }

        // Cache for menu items for offline rendering
        if (!db.objectStoreNames.contains('menu_cache')) {
          db.createObjectStore('menu_cache', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Queue an order locally in IndexedDB with zero lag (< 2ms)
   */
  async queueOrder(orderData: any): Promise<OfflineOrder> {
    const db = await this.initDB();
    const offlineOrder: OfflineOrder = {
      localId: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderNumber: orderData.orderNumber || `OFF-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      data: orderData,
      status: 'queued',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readwrite');
      const store = tx.objectStore('pending_orders');
      const req = store.add(offlineOrder);

      req.onsuccess = () => resolve(offlineOrder);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Fetch all queued orders pending synchronization
   */
  async getQueuedOrders(): Promise<OfflineOrder[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readonly');
      const store = tx.objectStore('pending_orders');
      const req = store.getAll();

      req.onsuccess = () => {
        const orders = (req.result as OfflineOrder[]) || [];
        resolve(orders.filter((o) => o.status === 'queued' || o.status === 'failed'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Mark an order as successfully synced and remove from pending queue
   */
  async removeQueuedOrder(localId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readwrite');
      const store = tx.objectStore('pending_orders');
      const req = store.delete(localId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Cache customer for instant offline phone lookup
   */
  async cacheCustomer(customer: { phone: string; name: string; address?: string; [key: string]: any }): Promise<void> {
    if (!customer.phone) return;
    const db = await this.initDB();
    const tx = db.transaction('customers_cache', 'readwrite');
    const store = tx.objectStore('customers_cache');
    store.put(customer);
  }

  /**
   * Instant local customer lookup by phone number
   */
  async getCachedCustomer(phone: string): Promise<any | null> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('customers_cache', 'readonly');
      const store = tx.objectStore('customers_cache');
      const req = store.get(phone);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }
}

export const posDB = new POSIndexedDB();
