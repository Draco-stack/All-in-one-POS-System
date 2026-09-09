/**
 * IndexedDB Offline-First Storage & Synchronization Manager
 * 
 * Provides zero-blocking local persistence for orders, customers, and menu items.
 * All stores are strictly namespaced and isolated by tenant (organizationId and branchId).
 * Offline storage is treated as an untrusted client-side cache.
 */

const DB_NAME = 'RestaurantPOS_OfflineDB';
const DB_VERSION = 2;

export interface OfflineOrder {
  localId: string;
  orderNumber: string;
  organizationId: string;
  branchId?: string;
  timestamp: number;
  data: any;
  status: 'queued' | 'syncing' | 'synced' | 'failed' | 'quarantined';
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCustomer {
  tenantPhoneKey: string;
  organizationId: string;
  phone: string;
  name: string;
  address?: string;
  totalSpent?: number;
  totalVisits?: number;
  isBlocked?: boolean;
  blockReason?: string;
  [key: string]: any;
}

export interface CachedMenuItem {
  tenantItemKey: string;
  organizationId: string;
  branchId?: string;
  id: string;
  title: string;
  price: number;
  category?: string;
  description?: string;
  active?: boolean;
  [key: string]: any;
}

function sanitizeErrorDetails(details: any): string {
  if (!details) return '';
  if (typeof details === 'string') {
    return details
      .replace(/("password"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
      .replace(/("pin"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
      .replace(/("token"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
      .replace(/(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_=]*/gi, '$1[REDACTED]');
  }
  const cleanObj = { ...details };
  delete cleanObj.password;
  delete cleanObj.pin;
  delete cleanObj.token;
  delete cleanObj.authorization;
  delete cleanObj.headers;
  return JSON.stringify(cleanObj);
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
          orderStore.createIndex('organizationId', 'organizationId', { unique: false });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx) {
            const orderStore = tx.objectStore('pending_orders');
            if (!orderStore.indexNames.contains('organizationId')) {
              orderStore.createIndex('organizationId', 'organizationId', { unique: false });
            }
          }
        }

        // Cache for customers for sub-millisecond local lookup (Keyed by tenantPhoneKey)
        if (!db.objectStoreNames.contains('customers_cache')) {
          const custStore = db.createObjectStore('customers_cache', { keyPath: 'tenantPhoneKey' });
          custStore.createIndex('organizationId', 'organizationId', { unique: false });
          custStore.createIndex('phone', 'phone', { unique: false });
        } else {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx && db.objectStoreNames.contains('customers_cache')) {
            const oldStore = tx.objectStore('customers_cache');
            if (oldStore.keyPath === 'phone') {
              db.deleteObjectStore('customers_cache');
              const custStore = db.createObjectStore('customers_cache', { keyPath: 'tenantPhoneKey' });
              custStore.createIndex('organizationId', 'organizationId', { unique: false });
              custStore.createIndex('phone', 'phone', { unique: false });
            }
          }
        }

        // Cache for menu items for offline rendering (Keyed by tenantItemKey)
        if (!db.objectStoreNames.contains('menu_cache')) {
          const menuStore = db.createObjectStore('menu_cache', { keyPath: 'tenantItemKey' });
          menuStore.createIndex('organizationId', 'organizationId', { unique: false });
        } else {
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx && db.objectStoreNames.contains('menu_cache')) {
            const oldStore = tx.objectStore('menu_cache');
            if (oldStore.keyPath === 'id') {
              db.deleteObjectStore('menu_cache');
              const menuStore = db.createObjectStore('menu_cache', { keyPath: 'tenantItemKey' });
              menuStore.createIndex('organizationId', 'organizationId', { unique: false });
            }
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Queue an order locally in IndexedDB with tenant scoping metadata
   */
  async queueOrder(orderData: any, organizationId?: string, branchId?: string): Promise<OfflineOrder> {
    const db = await this.initDB();
    const effectiveOrgId = organizationId || orderData.organizationId || 'org_default';
    const effectiveBranchId = branchId || orderData.branchId || undefined;
    const nowIso = new Date().toISOString();

    // Ensure orderData payload does NOT contain raw secret tokens/passwords
    const cleanPayload = { ...orderData };
    delete cleanPayload.password;
    delete cleanPayload.pin;
    delete cleanPayload.jwtToken;

    const offlineOrder: OfflineOrder = {
      localId: `offline-${effectiveOrgId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderNumber: cleanPayload.orderNumber || cleanPayload.clientOrderNum || `OFF-${Date.now().toString().slice(-4)}`,
      organizationId: effectiveOrgId,
      branchId: effectiveBranchId,
      timestamp: Date.now(),
      data: cleanPayload,
      status: 'queued',
      retryCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
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
   * Fetch queued orders strictly scoped by tenant (organizationId and branchId)
   */
  async getQueuedOrders(organizationId?: string, branchId?: string): Promise<OfflineOrder[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readonly');
      const store = tx.objectStore('pending_orders');
      
      let req: IDBRequest;
      if (organizationId && store.indexNames.contains('organizationId')) {
        const index = store.index('organizationId');
        req = index.getAll(organizationId);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => {
        let orders = (req.result as OfflineOrder[]) || [];
        if (organizationId) {
          orders = orders.filter((o) => o.organizationId === organizationId);
        }
        if (branchId) {
          orders = orders.filter((o) => !o.branchId || o.branchId === branchId);
        }
        resolve(orders.filter((o) => o.status === 'queued' || o.status === 'failed'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Remove a queued order from pending queue after server confirmation
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
   * Update queued order status (e.g. to 'quarantined' on permanent validation failure)
   */
  async updateQueuedOrderStatus(
    localId: string,
    status: OfflineOrder['status'],
    details?: any
  ): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readwrite');
      const store = tx.objectStore('pending_orders');
      const req = store.get(localId);

      req.onsuccess = () => {
        const item = req.result as OfflineOrder | undefined;
        if (item) {
          item.status = status;
          item.updatedAt = new Date().toISOString();
          if (details) {
            item.lastError = sanitizeErrorDetails(details);
          }
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Cache customer for instant offline phone lookup (Tenant-Scoped)
   */
  async cacheCustomer(organizationId: string, customer: { phone: string; name: string; [key: string]: any }): Promise<void> {
    if (!customer || !customer.phone || !organizationId) return;
    const cleanPhone = customer.phone.replace(/[\s.-]+/g, '');
    const tenantPhoneKey = `${organizationId}:${cleanPhone}`;

    const db = await this.initDB();
    const tx = db.transaction('customers_cache', 'readwrite');
    const store = tx.objectStore('customers_cache');
    store.put({
      ...customer,
      tenantPhoneKey,
      organizationId,
      phone: cleanPhone,
    });
  }

  /**
   * Tenant-Isolated local customer lookup by phone number
   */
  async getCachedCustomer(organizationId: string, phone: string): Promise<any | null> {
    if (!organizationId || !phone) return null;
    const cleanPhone = phone.replace(/[\s.-]+/g, '');
    const tenantPhoneKey = `${organizationId}:${cleanPhone}`;

    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('customers_cache', 'readonly');
      const store = tx.objectStore('customers_cache');
      const req = store.get(tenantPhoneKey);
      req.onsuccess = () => {
        const res = req.result;
        if (res && res.organizationId === organizationId) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Tenant & Branch Isolated Menu Caching
   */
  async cacheMenu(organizationId: string, branchId: string | undefined, menuItems: any[]): Promise<void> {
    if (!organizationId || !Array.isArray(menuItems)) return;
    const effectiveBranch = branchId || 'all';

    const db = await this.initDB();
    const tx = db.transaction('menu_cache', 'readwrite');
    const store = tx.objectStore('menu_cache');

    for (const item of menuItems) {
      if (!item.id) continue;
      const tenantItemKey = `${organizationId}:${effectiveBranch}:${item.id}`;
      store.put({
        ...item,
        tenantItemKey,
        organizationId,
        branchId: effectiveBranch,
      });
    }
  }

  /**
   * Fetch cached menu items for tenant
   */
  async getCachedMenu(organizationId: string, branchId?: string): Promise<any[]> {
    if (!organizationId) return [];
    const effectiveBranch = branchId || 'all';

    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('menu_cache', 'readonly');
      const store = tx.objectStore('menu_cache');
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as CachedMenuItem[]) || [];
        const filtered = all.filter(
          (m) => m.organizationId === organizationId && (m.branchId === effectiveBranch || m.branchId === 'all' || !branchId)
        );
        resolve(filtered);
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Safely clear non-pending cached data (customers, menu) on organization switch / logout
   * without deleting unsynchronized pending orders.
   */
  async clearTenantNonPendingCache(organizationId: string): Promise<void> {
    if (!organizationId) return;
    try {
      const db = await this.initDB();
      // Clear tenant customers_cache
      const tx1 = db.transaction('customers_cache', 'readwrite');
      const custStore = tx1.objectStore('customers_cache');
      const req1 = custStore.getAll();
      req1.onsuccess = () => {
        const items = req1.result as CachedCustomer[];
        for (const item of items) {
          if (item.organizationId === organizationId) {
            custStore.delete(item.tenantPhoneKey);
          }
        }
      };

      // Clear tenant menu_cache
      const tx2 = db.transaction('menu_cache', 'readwrite');
      const menuStore = tx2.objectStore('menu_cache');
      const req2 = menuStore.getAll();
      req2.onsuccess = () => {
        const items = req2.result as CachedMenuItem[];
        for (const item of items) {
          if (item.organizationId === organizationId) {
            menuStore.delete(item.tenantItemKey);
          }
        }
      };
    } catch (e) {
      console.warn('Error clearing non-pending cache:', e);
    }
  }
}

export const posDB = new POSIndexedDB();
