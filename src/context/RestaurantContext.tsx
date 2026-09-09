import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { posDB } from '../utils/indexedDB';
import { roundToCurrency } from '../utils/financial';
import {
  MenuItem,
  Category,
  Customer,
  Order,
  ParkedOrder,
  RegisterShift,
  PosCartState,
  PosCartItem,
  OrderType,
  PaymentMethod,
  SplitPaymentEntry,
  UserAccount,
  UserRole,
  InventoryStockItem,
  SalesAdjustmentRecord,
  RiderStats,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_STOCK,
  HistoricalShiftRecord,
} from '../data/mockData';

interface RestaurantContextType {
  outlets: string[];
  addOutlet: (name: string) => void;
  deleteOutlet: (name: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
  loginUser: (emailOrUser: string, passwordOrPin: string) => { success: boolean; error?: string; user?: UserAccount };
  logoutUser: () => void;
  loginTheme: 'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue';
  setLoginTheme: (theme: 'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue') => void;
  users: UserAccount[];
  addNewUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => void;
  updateUserPin: (userId: string, newPin: string) => void;
  toggleUserActive: (userId: string) => void;
  deleteUser: (userId: string) => Promise<boolean>;
  updateUser: (userId: string, updates: Partial<UserAccount>) => Promise<boolean>;
  
  // Menu & Categories
  menuItems: MenuItem[];
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => Promise<boolean>;
  toggleItemAvailability: (id: string) => void;
  addCategory: (name: string) => void;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (newCategories: Category[]) => void;

  // POS Workstation State
  posCart: PosCartState;
  addToPosCart: (item: MenuItem, flavor?: string, extraMods?: { name: string; price: number }[]) => void;
  removeFromPosCart: (cartItemId: string) => void;
  updateCartItemQty: (cartItemId: string, qty: number) => void;
  updateCartItemFlavor: (cartItemId: string, flavor: string) => void;
  toggleCartItemModifier: (cartItemId: string, modName: string, price: number) => void;
  updateCartItemNote: (cartItemId: string, note: string) => void;
  toggleCartItemCollapse: (cartItemId: string) => void;
  clearPosCart: () => void;
  setPosOrderType: (type: OrderType) => void;
  setPosTableNumber: (table: string) => void;
  setPosServer: (serverId: string, serverName: string) => void;
  setPosDeliveryDriver: (driver: string) => void;
  setPosDiscountPercent: (discount: number) => void;
  setPosTipAmount: (tip: number) => void;
  setPosPaymentMethod: (method: PaymentMethod) => void;
  setPosNotes: (notes: string) => void;
  setPosCustomerField: (field: keyof NonNullable<PosCartState['customer']>, value: any) => void;
  setFullCustomer: (customer: Customer | null) => void;

  // Customer Management & Realtime Lookup
  customers: Customer[];
  drainOfflineQueue: () => Promise<void>;
  lookupCustomer: (phone: string) => Promise<{ found: boolean; customer?: Customer; pastOrders?: Order[] }>;
  upsertCustomer: (customerData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    deliveryNotes?: string;
    notes?: string;
  }) => Promise<Customer>;
  blockCustomer: (phone: string, reason: string, blockedBy?: string) => Promise<{ success: boolean; error?: string; customer?: Customer }>;
  unblockCustomer: (phone: string) => Promise<{ success: boolean; error?: string; customer?: Customer }>;
  isCustomerBlocked: (phone: string) => { blocked: boolean; reason?: string; customer?: Customer };

  // Orders & Transactions
  orders: Order[];
  parkedOrders: ParkedOrder[];
  parkCurrentOrder: (title?: string) => void;
  recallParkedOrder: (parkedId: string) => void;
  deleteParkedOrder: (parkedId: string) => void;
  punchOrder: (tenderedAmount?: number, outletName?: string, splitPayments?: SplitPaymentEntry[]) => Promise<Order>;
  updateOrderStatus: (
    orderId: string, 
    status: Order['status'], 
    meta?: { 
      paymentStatus?: string; 
      paymentMethod?: string; 
      riderId?: string;
      amountTendered?: number;
      changeGiven?: number;
      splitPayments?: SplitPaymentEntry[];
    }
  ) => void;
  refundOrder: (orderId: string, reason: string) => void;
  cancelOrder: (orderId: string, reason: string, managerPin?: string) => Promise<any>;
  editOrder: (orderId: string, updates: any) => Promise<any>;
  assignDeliveryDriver: (orderId: string, driver: string) => void;

  cashDrops: any[];
  dropRiderCash: (riderName: string, amount: number, notes?: string) => void;

  addOrder: (order: Order) => void;
  activeReceiptOrder: Order | null;
  setActiveReceiptOrder: (order: Order | null) => void;
  activeDeliverySlipOrder: Order | null;
  setActiveDeliverySlipOrder: (order: Order | null) => void;
  printQueueOrder: Order | null;
  setPrintQueueOrder: (order: Order | null) => void;

  // Register Shift
  currentShift: RegisterShift | null;
  openShift: (openingFloat: number, notes?: string) => void;
  closeShift: (actualCash: number, notes?: string) => void;
  updatePettyCash: (newAmount: number) => void;

  // Sales Adjustments & Audits
  salesAdjustments: SalesAdjustmentRecord[];
  addSalesAdjustment: (adj: Omit<SalesAdjustmentRecord, 'id' | 'timestamp'>) => void;
  historicalShifts: HistoricalShiftRecord[];

  // Inventory Stock
  stockItems: InventoryStockItem[];
  updateStockQuantity: (id: string, newStock: number) => void;

  // Tables
  tables: { id: string; number: string; capacity: number; status: string; active: boolean }[];
  addTable: (number: string, capacity: number) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  updateTableStatus: (id: string, status: string) => Promise<void>;

  // Calculations
  cartSubtotal: number;
  cartTax: number;
  cartDeliveryFee: number;
  cartDiscount: number;
  cartTotal: number;
  drivers: string[];
  deliveryDrivers: string[];
  addDriver: (name: string) => void;
  addDeliveryDriver: (driver: string) => void;
  getRiderStats: (riderIdentifier: string) => RiderStats;
  riderResets: { [riderIdOrName: string]: string };
  resetRiderStats: (riderName: string) => void;
  resetAllRidersStats: () => void;

  // Toast
  toast: string | null;
  showToast: (msg: string) => void;
  syncFromServer: () => Promise<void>;
  isRestricted: (capability: string) => boolean;
}

const DEFAULT_EMPTY_CART: PosCartState = {
  items: [],
  customer: {
    name: '',
    phone: '',
    address: '',
    notes: '',
  },
  orderType: "takeaway",
  paymentMethod: "cash",
  tableNumber: 'Table 1',
  deliveryDriver: '',
  discountPercent: 0,
  tipAmount: 0,
  notes: '',
};

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

// Offline-first Storage Helpers
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
};

export const deduplicateOrders = (ordersList: Order[]): Order[] => {
  if (!Array.isArray(ordersList)) return [];
  const seenIds = new Set<string>();
  const seenNumbers = new Set<string>();
  const result: Order[] = [];
  for (const ord of ordersList) {
    if (!ord || !ord.id) continue;
    if (seenIds.has(ord.id)) continue;
    if (ord.orderNumber && seenNumbers.has(ord.orderNumber)) continue;
    seenIds.add(ord.id);
    if (ord.orderNumber) seenNumbers.add(ord.orderNumber);
    result.push(ord);
  }
  return result;
};

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('pos_theme') as 'light' | 'dark') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }, [theme]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3500);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('pos_theme', next);
      return next;
    });
  };

  // Staff & User State
  const [outlets, setOutlets] = useState<string[]>(() =>
    loadFromStorage('pos_outlets_cache', ['Sargodha', 'Jinnah Colony', 'Eden Garden', 'Gujrat', 'Gojra', 'Gulberg Branch', 'DHA Phase 5', 'F-7 Islamabad'])
  );

  const addOutlet = async (name: string) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    setOutlets(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    try {
      await fetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (err) {
      console.warn('Failed to persist outlet to database:', err);
    }
  };
  
  const deleteOutlet = async (name: string) => {
    setOutlets(prev => prev.filter(o => o !== name));
    try {
      await fetch(`/api/outlets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Failed to delete outlet from database:', err);
    }
  };

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const defaultList: UserAccount[] = [
      {
        id: 'usr-1',
        name: 'Administrator (Robert Vance)',
        username: 'admin',
        email: 'admin@masterpos.com',
        pin: '1111',
        password: '1111',
        role: 'owner',
        outlet: 'All Outlets',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-2',
        name: 'Store Manager (Farhan Tariq)',
        username: 'storemanager',
        email: 'storemanager@masterpos.com',
        pin: '2222',
        password: '2222',
        role: 'manager',
        outlet: 'Main Branch',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-3',
        name: 'Cashier One (Ali Hassan)',
        username: 'cashier',
        email: 'cashier@masterpos.com',
        pin: '3333',
        password: '3333',
        role: 'cashier',
        outlet: 'Main Branch',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-4',
        name: 'Cashier Two (Sana Malik)',
        username: 'cashier2',
        email: 'cashier2@masterpos.com',
        pin: '4444',
        password: '4444',
        role: 'cashier',
        outlet: 'F-11 Branch',
        active: true,
        createdAt: '2025-01-01',
      },
    ];
    const cached = loadFromStorage<UserAccount[]>('pos_users_cache', defaultList);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.map((u) => {
        const uUsername = (u.username || '').toLowerCase();
        const uRole = (u.role || '').toLowerCase();
        const fallbackPin = (uRole === 'owner' || uRole === 'admin') ? '1111' : uRole === 'manager' ? '2222' : (uUsername === 'cashier2' ? '4444' : '3333');
        const activePin = (u.pin && u.pin !== '1234') ? u.pin : fallbackPin;
        if (uUsername === 'owner' || uUsername === 'admin' || uRole === 'owner' || uRole === 'admin') {
          return { 
            ...u, 
            username: u.username || 'admin', 
            email: u.email && u.email.includes('@') ? u.email : 'admin@masterpos.com', 
            pin: activePin, 
            password: activePin 
          };
        }
        if (uUsername === 'manager' || uUsername === 'storemanager' || uRole === 'manager') {
          return { 
            ...u, 
            username: u.username || 'storemanager', 
            email: u.email && u.email.includes('@') ? u.email : 'storemanager@masterpos.com', 
            pin: activePin, 
            password: activePin 
          };
        }
        if (uUsername === 'cashier' || uRole === 'cashier') {
          return { 
            ...u, 
            username: u.username || 'cashier', 
            email: u.email && u.email.includes('@') ? u.email : 'cashier@masterpos.com', 
            pin: activePin, 
            password: activePin 
          };
        }
        return {
          ...u,
          pin: activePin,
          password: activePin,
        };
      });
    }
    return defaultList;
  });
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    const saved = loadFromStorage<UserAccount | null>('pos_current_user', null);
    if (saved && saved.id) return saved;
    return users && users.length > 0 ? users[0] : {
      id: 'usr-1',
      name: 'Administrator (Robert Vance)',
      username: 'admin',
      email: 'admin@masterpos.com',
      pin: '1111',
      password: '1111',
      role: 'owner',
      outlet: 'All Outlets',
      active: true,
      createdAt: '2025-01-01',
    };
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return loadFromStorage<boolean>('pos_is_logged_in', false);
  });
  const [loginTheme, setLoginThemeState] = useState<'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue'>(() => {
    return loadFromStorage('pos_login_theme', 'dark');
  });

  const setLoginTheme = (t: 'dark' | 'wood' | 'pink' | 'midnight' | 'light' | 'blue') => {
    setLoginThemeState(t);
    saveToStorage('pos_login_theme', t);
  };

  const logoutUser = useCallback(() => {
    setIsLoggedIn(false);
    saveToStorage('pos_is_logged_in', false);
    saveToStorage('pos_jwt_token', null);
    showToast('🔒 Logged out. Return to login screen.');
  }, [showToast]);

  const loginUser = useCallback(
    (emailOrUser: string, passwordOrPin: string) => {
      const rawInput = (emailOrUser || '').trim();
      const cleanInput = rawInput.toLowerCase();
      const cleanPass = (passwordOrPin || '').trim();

      if (!cleanInput) {
        return { success: false, error: 'Please enter your email or username.' };
      }

      if (!cleanPass) {
        return { success: false, error: 'Please enter your password or PIN.' };
      }

      // Normalization: Extract prefix before @ if email provided, and compact string without spaces/dots/dashes/underscores
      let inputPrefix = cleanInput;
      if (cleanInput.includes('@')) {
        inputPrefix = cleanInput.split('@')[0];
      }
      const compactInput = cleanInput.replace(/[\s._-]+/g, '');
      const compactPrefix = inputPrefix.replace(/[\s._-]+/g, '');

      // 1. Direct user search across username, email, name, role, and sanitized variations
      let matched = users.find((u) => {
        if (u.active === false) return false;
        const uUsername = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const uName = (u.name || '').toLowerCase();
        const uId = (u.id || '').toLowerCase();
        const uRole = (u.role || '').toLowerCase();

        const uEmailPrefix = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
        const uCompactUsername = uUsername.replace(/[\s._-]+/g, '');
        const uCompactEmail = uEmail.replace(/[\s._-]+/g, '');
        const uCompactEmailPrefix = uEmailPrefix.replace(/[\s._-]+/g, '');
        const uCompactName = uName.replace(/[\s._-]+/g, '');

        // Exact match
        if (uUsername === cleanInput || uEmail === cleanInput || uId === cleanInput) return true;
        // Prefix match e.g. "admin@masterpos.com" -> prefix "admin" matches uUsername "admin"
        if (uUsername === inputPrefix || uEmailPrefix === inputPrefix || uEmailPrefix === cleanInput) return true;
        // Compact matching e.g. "store manager" or "storemanager@masterpos.com"
        if (uCompactUsername === compactInput || uCompactUsername === compactPrefix) return true;
        if (uCompactEmail === compactInput || uCompactEmailPrefix === compactPrefix || uCompactEmailPrefix === compactInput) return true;
        if (uCompactName === compactInput || uCompactName === compactPrefix) return true;

        return false;
      });

      // 2. Role & Alias matching fallbacks for seamless login flexibility:
      // Accepts: admin, owner, admin@masterpos.com, owner@masterpos.com, etc.
      const adminAliases = ['admin', 'owner', 'administrator', 'superadmin', 'root', 'boss'];
      const isTryingAdmin = 
        adminAliases.includes(compactInput) || 
        adminAliases.includes(compactPrefix) ||
        cleanInput.includes('admin@') ||
        cleanInput.includes('owner@');

      if (!matched && isTryingAdmin) {
        matched = users.find((u) => u.role === 'owner' || u.role === 'admin' || (u.username || '').toLowerCase() === 'admin' || (u.username || '').toLowerCase() === 'owner') || users[0];
      }

      // Accepts: store manager, storemanager, manager, storemanager@masterpos.com, store.manager@masterpos.com, manager@masterpos.com, etc.
      const managerAliases = ['storemanager', 'manager', 'branchmanager', 'generalmanager', 'supervisor', 'shiftmanager'];
      const isTryingManager =
        managerAliases.includes(compactInput) ||
        managerAliases.includes(compactPrefix) ||
        cleanInput.includes('storemanager@') ||
        cleanInput.includes('manager@') ||
        cleanInput.includes('store.manager@') ||
        cleanInput.includes('store_manager@');

      if (!matched && isTryingManager) {
        matched = users.find((u) => u.role === 'manager' || (u.username || '').toLowerCase() === 'storemanager' || (u.username || '').toLowerCase() === 'manager');
      }

      // Accepts: cashier, cashier1, cashier2, cashier@masterpos.com, cashier1@masterpos.com, cashier2@masterpos.com, etc.
      const cashierAliases = ['cashier', 'cashier1', 'cashier2', 'pos', 'counter', 'operator', 'clerk'];
      const isTryingCashier =
        cashierAliases.includes(compactInput) ||
        cashierAliases.includes(compactPrefix) ||
        cleanInput.includes('cashier@') ||
        cleanInput.includes('cashier1@') ||
        cleanInput.includes('cashier2@');

      if (!matched && isTryingCashier) {
        if (compactInput.includes('2') || compactPrefix.includes('2')) {
          matched = users.find((u) => (u.username || '').toLowerCase() === 'cashier2') || users.find((u) => u.role === 'cashier');
        } else {
          matched = users.find((u) => (u.username || '').toLowerCase() === 'cashier') || users.find((u) => u.role === 'cashier');
        }
      }

      // Accepts: rider, carlos, samir, marcus, delivery@masterpos.com, etc.
      const riderAliases = ['rider', 'driver', 'delivery', 'courier'];
      const isTryingRider =
        riderAliases.includes(compactInput) ||
        riderAliases.includes(compactPrefix) ||
        cleanInput.includes('rider@') ||
        cleanInput.includes('delivery@');

      if (!matched && isTryingRider) {
        matched = users.find((u) => u.role === 'rider' || (u.username || '').toLowerCase().includes('rider'));
      }

      // Fallback name search if no username/alias matched
      if (!matched) {
        matched = users.find((u) => (u.name || '').toLowerCase().includes(cleanInput) || (u.name || '').toLowerCase().includes(inputPrefix));
      }

      if (!matched) {
        return { 
          success: false, 
          error: `User "${rawInput}" not found. Try 'admin', 'admin@masterpos.com', 'storemanager', or 'cashier'.` 
        };
      }

      // Credential verification: strictly check current active PIN or password
      // The previous password is deleted and cannot be used
      const isPinMatch = Boolean(matched.pin && matched.pin === cleanPass);
      const isPassMatch = Boolean(matched.password && matched.password === cleanPass);

      if (isPinMatch || isPassMatch) {
        // Ensure authenticated user object has the valid accepted PIN
        const effectivePin = (matched.pin && matched.pin === cleanPass) ? matched.pin : cleanPass;
        const authenticatedUser = { ...matched, pin: effectivePin, password: effectivePin };

        setCurrentUser(authenticatedUser);
        setIsLoggedIn(true);
        saveToStorage('pos_is_logged_in', true);
        saveToStorage('pos_current_user', authenticatedUser);

        // Pre-fetch and cache JWT token in background
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: matched.username,
            email: matched.email,
            pin: effectivePin,
            password: effectivePin 
          })
        })
        .then(async (loginRes) => {
          if (loginRes.ok) {
            const data = await loginRes.json();
            if (data && data.token) {
              saveToStorage('pos_jwt_token', data.token);
            }
          }
        })
        .catch((err) => {
          console.warn('Background token pre-fetch failed:', err);
        });

        return { success: true, user: authenticatedUser };
      }

      return { success: false, error: 'Incorrect Password or PIN. Please try again.' };
    },
    [users]
  );

  // Menu & Category State
  const [categories, setCategories] = useState<Category[]>(() =>
    loadFromStorage('pos_categories_cache', INITIAL_CATEGORIES)
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    loadFromStorage('pos_menu_items_cache', INITIAL_MENU_ITEMS)
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sales Adjustments & Historical Audits
  const [salesAdjustments, setSalesAdjustments] = useState<SalesAdjustmentRecord[]>(() => {
    const cached = loadFromStorage<SalesAdjustmentRecord[]>('pos_sales_adjustments_cache', []);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.filter((a) => !a.id?.startsWith('adj-'));
    }
    return [];
  });
  const [historicalShifts, setHistoricalShifts] = useState<HistoricalShiftRecord[]>(() => {
    const cached = loadFromStorage<HistoricalShiftRecord[]>('pos_shifts_cache', []);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.filter((s) => !s.id?.startsWith('sh-audit-'));
    }
    return [];
  });

  // POS State
  const [posCart, setPosCart] = useState<PosCartState>(DEFAULT_EMPTY_CART);
  const [orders, setOrders] = useState<Order[]>(() => {
    const cached = loadFromStorage<Order[]>('pos_orders_cache', []);
    if (Array.isArray(cached) && cached.length > 0) {
      const realOrders = cached.filter((o) =>
        !o.id?.startsWith('del-ord-') &&
        !o.id?.startsWith('mock-') &&
        o.orderNumber !== 'WY164V527CL47H' &&
        o.orderNumber !== 'WX195C578EJ53E'
      );
      return deduplicateOrders(realOrders);
    }
    return [];
  });
  const isPunchOrderInFlightRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() =>
    loadFromStorage('pos_parked_orders_cache', [])
  );
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = loadFromStorage<Customer[]>('pos_customers_cache', []);
    return Array.isArray(cached) ? cached : [];
  });
  const [stockItems, setStockItems] = useState<InventoryStockItem[]>(() =>
    loadFromStorage('pos_stock_cache', INITIAL_STOCK)
  );
  const [drivers, setDrivers] = useState<string[]>([]);

  const [tables, setTables] = useState<{ id: string; number: string; capacity: number; status: string; active: boolean }[]>(() =>
    loadFromStorage('pos_tables_cache', [])
  );
  const [cashDrops, setCashDrops] = useState<any[]>(() =>
    loadFromStorage('pos_cash_drops_cache', [])
  );
  const [riderResets, setRiderResets] = useState<{ [riderIdOrName: string]: string }>(() =>
    loadFromStorage('pos_rider_resets_cache', {})
  );

  // Synchronize state changes to localStorage
  useEffect(() => { saveToStorage('pos_users_cache', users); }, [users]);
  useEffect(() => { saveToStorage('pos_current_user', currentUser); }, [currentUser]);
  useEffect(() => { saveToStorage('pos_outlets_cache', outlets); }, [outlets]);
  useEffect(() => { saveToStorage('pos_categories_cache', categories); }, [categories]);
  useEffect(() => { saveToStorage('pos_menu_items_cache', menuItems); }, [menuItems]);
  useEffect(() => { saveToStorage('pos_sales_adjustments_cache', salesAdjustments); }, [salesAdjustments]);
  useEffect(() => { saveToStorage('pos_shifts_cache', historicalShifts); }, [historicalShifts]);
  useEffect(() => { saveToStorage('pos_orders_cache', orders); }, [orders]);
  useEffect(() => { saveToStorage('pos_parked_orders_cache', parkedOrders); }, [parkedOrders]);
  useEffect(() => { saveToStorage('pos_customers_cache', customers); }, [customers]);
  useEffect(() => { saveToStorage('pos_stock_cache', stockItems); }, [stockItems]);
  useEffect(() => { saveToStorage('pos_tables_cache', tables); }, [tables]);
  useEffect(() => { saveToStorage('pos_cash_drops_cache', cashDrops); }, [cashDrops]);
  useEffect(() => { saveToStorage('pos_rider_resets_cache', riderResets); }, [riderResets]);

  // Robust check to ensure user password/PIN updates completely invalidate existing sessions and force re-authentication
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !currentUser.id) return;

    let isMounted = true;

    const checkSessionValidity = async () => {
      try {
        const token = loadFromStorage<string | null>('pos_jwt_token', null);
        const storedUser = loadFromStorage<UserAccount | null>('pos_current_user', null);
        
        const res = await fetch('/api/auth/validate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            pin: storedUser?.pin || currentUser.pin,
            token: token
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.valid === false) {
            console.warn('Session validation failed:', data.reason);
            // Invalidate session and force re-authentication
            setIsLoggedIn(false);
            saveToStorage('pos_is_logged_in', false);
            saveToStorage('pos_jwt_token', null);
            saveToStorage('pos_current_user', null);
            showToast(`⚠️ Session Invalidated: ${data.reason || 'Password/PIN updated. Please login again.'}`);
          }
        }
      } catch (err) {
        console.warn('Session validity background check failed:', err);
      }
    };

    // Run immediately on load/mount
    checkSessionValidity();

    // Run periodically every 12 seconds to force near-immediate logout on other terminals if password is updated
    const intervalId = setInterval(checkSessionValidity, 12000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isLoggedIn, currentUser, showToast]);

  // Dynamically compute list of active delivery drivers from users with role 'rider'
  const deliveryDrivers = useMemo(() => {
    const riderUsers = users
      .filter((u) => u.role === 'rider' && u.active !== false)
      .map((u) => u.name);
    return Array.from(new Set([...riderUsers, ...drivers]));
  }, [users, drivers]);

  // Calculate live statistics for any rider on the fly strictly from raw order data
  const getRiderStats = useCallback(
    (riderIdentifier: string): RiderStats => {
      if (!riderIdentifier) {
        return {
          totalAssigned: 0,
          assignedItemsCount: 0,
          delivered: 0,
          deliveredItemsCount: 0,
          cancelled: 0,
          active: 0,
          inTransit: 0,
          totalRevenue: 0,
          cancelledRevenue: 0,
          netFleetRevenue: 0,
          codCashOnHand: 0,
        };
      }
      const cleanTarget = riderIdentifier.trim().toLowerCase();
      const riderResetTimeStr = riderResets[cleanTarget] || riderResets['all'];
      const resetTime = riderResetTimeStr ? new Date(riderResetTimeStr).getTime() : 0;

      const matchedUser = users.find(
        (u) =>
          u.id.toLowerCase() === cleanTarget ||
          u.name.toLowerCase() === cleanTarget ||
          (u.username && u.username.toLowerCase() === cleanTarget) ||
          u.name.toLowerCase().includes(cleanTarget) ||
          cleanTarget.includes(u.name.toLowerCase())
      );

      const targetName = (matchedUser ? matchedUser.name : riderIdentifier).trim().toLowerCase();
      const targetId = (matchedUser ? matchedUser.id : riderIdentifier).trim().toLowerCase();
      const targetUsername = (matchedUser?.username || '').trim().toLowerCase();

      const assigned = orders.filter((o) => {
        const orderTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
        if (orderTime < resetTime) return false;

        const orderDriver = (o.deliveryDriver || o.riderName || '').trim().toLowerCase();
        const orderRiderId = (o as any).assignedRiderId
          ? String((o as any).assignedRiderId).trim().toLowerCase()
          : '';
        if (!orderDriver && !orderRiderId) return false;

        return (
          orderDriver === targetName ||
          orderDriver === targetId ||
          (targetUsername && orderDriver === targetUsername) ||
          (orderRiderId && (orderRiderId === targetId || orderRiderId === cleanTarget)) ||
          (targetName && orderDriver.includes(targetName)) ||
          (orderDriver && targetName.includes(orderDriver))
        );
      });

      const assignedItemsCount = assigned.reduce((sum, o) => {
        return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }, 0);

      const deliveredOrders = assigned.filter(
        (o) => o.status === 'completed' || o.status === 'delivered'
      );
      const cancelledOrders = assigned.filter(
        (o) => o.status === 'cancelled' || o.status === 'refunded'
      );
      const activeOrders = assigned.filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled' &&
          o.status !== 'refunded'
      );

      const deliveredItemsCount = deliveredOrders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }, 0);

      const totalRevenue = deliveredOrders.reduce(
        (sum, o) => sum + (o.total ?? o.subtotal ?? 0),
        0
      );

      const cancelledRevenue = cancelledOrders.reduce(
        (sum, o) => sum + (o.total ?? o.subtotal ?? 0),
        0
      );

      const netFleetRevenue = Math.max(0, totalRevenue - cancelledRevenue);

      // Delivered COD cash collected (orders delivered with cash / COD)
      const deliveredCODCash = deliveredOrders
        .filter((o) => {
          const pm = (o.paymentMethod || '').toLowerCase();
          return (
            pm === 'cash' ||
            pm === 'cod' ||
            pm === 'cash_on_delivery' ||
            !pm ||
            (!pm.includes('card') && !pm.includes('online') && !pm.includes('pos'))
          );
        })
        .reduce((sum, o) => sum + (o.total ?? o.subtotal ?? 0), 0);

      // Total cash dropped by rider in cash drops audit ledger
      const totalDropped = (cashDrops || [])
        .filter((d) => {
          const dropTime = d.timestamp ? new Date(d.timestamp).getTime() : 0;
          if (dropTime < resetTime) return false;

          const dRider = (d.riderName || '').trim().toLowerCase();
          return (
            dRider === targetName ||
            dRider === targetId ||
            (targetUsername && dRider === targetUsername) ||
            (targetName && dRider.includes(dRider)) ||
            (dRider && targetName.includes(dRider))
          );
        })
        .reduce((sum, d) => sum + (d.amount || 0), 0);

      // COD Cash Reconciliation: Any order that cancels is naturally excluded/subtracted from delivered cash balance
      const codCashOnHand = Math.max(0, deliveredCODCash - totalDropped);

      const cancelledItemsCount = cancelledOrders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }, 0);

      const activeItemsCount = activeOrders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }, 0);

      return {
        totalAssigned: assignedItemsCount,
        assignedItemsCount,
        delivered: deliveredItemsCount,
        deliveredItemsCount,
        cancelled: cancelledItemsCount,
        active: activeItemsCount,
        inTransit: activeItemsCount,
        totalRevenue,
        cancelledRevenue,
        netFleetRevenue,
        codCashOnHand,
      };
    },
    [orders, users, cashDrops, riderResets]
  );

  const resetRiderStats = useCallback((riderName: string) => {
    const clean = riderName.trim().toLowerCase();
    const nowStr = new Date().toISOString();
    setRiderResets((prev) => ({
      ...prev,
      [clean]: nowStr,
    }));
    showToast(`✓ Fleet statistics for Rider "${riderName}" have been reset.`);
  }, [showToast]);

  const resetAllRidersStats = useCallback(() => {
    const nowStr = new Date().toISOString();
    setRiderResets((prev) => ({
      ...prev,
      all: nowStr,
    }));
    showToast('✓ Statistics for all riders in the fleet have been reset.');
  }, [showToast]);

  const addSalesAdjustment = useCallback((adj: Omit<SalesAdjustmentRecord, 'id' | 'timestamp'>) => {
    const newAdj: SalesAdjustmentRecord = {
      ...adj,
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    setSalesAdjustments((prev) => [newAdj, ...prev]);
  }, []);

  // Current Register Shift

  const dropRiderCash = (riderName: string, amount: number, notes?: string) => {
    const newDrop = {
      id: `drop-${Date.now()}`,
      riderName,
      amount,
      notes: notes || 'End of shift reconciliation drop',
      timestamp: new Date().toISOString(),
      receivedBy: currentUser?.name || 'Robert Vance',
    };
    setCashDrops((prev) => [newDrop, ...prev]);
  };

  const addOrder = (order: Order) => {
    if (!currentShift) {
      const defaultFloat = 0;
      const notes = `Shift auto-started on order creation by ${currentUser?.name || 'Cashier'}`;
      openShift(defaultFloat, notes);
      showToast(`🚀 Auto-started Shift for cashier ${currentUser?.name || 'Cashier'}!`);
    }
    setOrders((prev) => {
      const filtered = prev.filter(
        (o) => o.id !== order.id && (!order.orderNumber || o.orderNumber !== order.orderNumber)
      );
      return [order, ...filtered];
    });
  };

  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [activeDeliverySlipOrder, setActiveDeliverySlipOrder] = useState<Order | null>(null);
  const [printQueueOrder, setPrintQueueOrder] = useState<Order | null>(null);

  const [currentShift, setCurrentShift] = useState<RegisterShift | null>(() => {
    const cached = loadFromStorage<RegisterShift | null>('pos_current_shift', null);
    if (cached && cached.status === 'open') return cached;
    return null;
  });

  // Dynamically recalculate shift totals directly from orders as the single source of truth
  useEffect(() => {
    setCurrentShift((prev) => {
      if (!prev || prev.status !== 'open') return prev;
      
      const shiftStartTime = prev.openedAt ? new Date(prev.openedAt).getTime() : 0;
      const shiftEndTime = prev.closedAt ? new Date(prev.closedAt).getTime() : null;
      
      // Filter for active/paid orders generated during this shift session
      let shiftOrders = orders.filter(
        (o) =>
          o.status !== 'cancelled' &&
          o.status !== 'refunded' &&
          o.paymentStatus === 'paid' &&
          (!shiftStartTime || (o.createdAt ? new Date(o.createdAt).getTime() : Date.now()) >= (shiftStartTime - 120000)) &&
          (!shiftEndTime || (o.createdAt ? new Date(o.createdAt).getTime() : Date.now()) <= (shiftEndTime + 120000))
      );

      const cash = shiftOrders
        .filter((o) => {
          const pm = (o.paymentMethod || 'cash').toLowerCase();
          return pm === 'cash' || pm === 'cod' || pm === 'cash_on_delivery' || (!pm.includes('card') && !pm.includes('online') && !pm.includes('pos'));
        })
        .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
        
      const card = shiftOrders
        .filter((o) => {
          const pm = (o.paymentMethod || '').toLowerCase();
          return pm.includes('card') || pm.includes('online') || pm.includes('pos') || pm.includes('bank') || pm.includes('digital');
        })
        .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);

      const tax = shiftOrders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);
      const discounts = shiftOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
      const tips = shiftOrders.reduce((sum, o) => sum + (Number(o.tip) || 0), 0);

      // We maintain the original starting float value
      const floatVal = prev.startingFloat || prev.openingFloat || 0;

      return {
        ...prev,
        cashSales: cash,
        cardSales: card,
        totalGrossSales: cash + card,
        totalTax: tax,
        totalDiscounts: discounts,
        totalTips: tips,
        cashInDrawerExpected: floatVal + cash,
        transactionsCount: shiftOrders.length,
      };
    });
  }, [orders]);

  // Sync current shift state changes to localStorage
  useEffect(() => {
    saveToStorage('pos_current_shift', currentShift);
  }, [currentShift]);

  // Realtime Database & Storage Sync
  const syncFromServer = useCallback(async () => {
    // 0. Fetch Outlets / Branches
    try {
      const res = await fetch('/api/outlets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setOutlets(data);
        }
      }
    } catch (e) {}

    // 0.5. Fetch Tables
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTables(data);
        }
      }
    } catch (e: any) {
      if (!e?.message?.includes('expected pattern')) {
        console.warn('Tables fetch fallback to cache:', e);
      }
    }

    // 1. Fetch Users
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedUsers: UserAccount[] = data.map((u: any) => {
            const role = (u.role || 'cashier').toLowerCase() as UserRole;
            const fallbackPin = (role === 'owner' || role === 'admin') ? '1111' : role === 'manager' ? '2222' : (u.username === 'cashier2' ? '4444' : '3333');
            const resolvedPin = (u.pin && u.pin !== '1234') ? u.pin : fallbackPin;
            return {
              id: u.id,
              name: u.name,
              username: u.username || u.name.toLowerCase().replace(/\s+/g, ''),
              email: u.email || `${u.username || 'user'}@masterpos.com`,
              pin: resolvedPin,
              password: resolvedPin,
              role: role,
              outlet: u.outlet || 'Main Branch',
              phone: u.phone || '',
              active: u.active !== false,
              restrictions: u.restrictions || '[]',
              createdAt: u.createdAt ? String(u.createdAt).split('T')[0] : '2025-01-01',
            };
          });
          setUsers(mappedUsers);
        }
      }
    } catch (err: any) {
      if (!err?.message?.includes('expected pattern')) {
        console.warn('User fetch fallback to local cache:', err);
      }
    }

    // 1.5. Fetch Dynamic Categories from Database
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mappedCats: Category[] = [
            { id: 'all', name: 'All', itemCount: 0 },
            ...data.map((c: any) => ({
              id: c.slug || c.id,
              name: c.title || c.name,
              icon: c.icon || undefined,
              itemCount: c._count?.menuItems || 0,
            })),
          ];
          setCategories(mappedCats);
          saveToStorage('pos_categories_cache', mappedCats);
        }
      }
    } catch (err: any) {
      if (!err?.message?.includes('expected pattern')) {
        console.warn('Categories fetch fallback to local cache:', err);
      }
    }

    // 2. Fetch Dynamic Menu Items from Database
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mappedItems: MenuItem[] = data.map((i: any) => ({
            id: i.id,
            name: i.title || i.name,
            description: i.description || '',
            price: Number(i.price),
            category: i.category?.slug || i.category?.title || i.categoryId || i.category || 'pizzas',
            image: i.imageUrl || i.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
            available: i.active !== false,
            flavors: i.flavors ? (typeof i.flavors === 'string' ? JSON.parse(i.flavors) : i.flavors) : [],
            options: i.options ? (typeof i.options === 'string' ? JSON.parse(i.options) : i.options) : [],
            isPopular: i.isPopular || false,
            preparationTimeMinutes: i.preparationTime || 10,
          }));
          setMenuItems(mappedItems);
          saveToStorage('pos_menu_items_cache', mappedItems);
        }
      }
    } catch (err: any) {
      if (!err?.message?.includes('expected pattern')) {
        console.warn('Menu fetch fallback to local cache:', err);
      }
    }

    // 3. Fetch Customers
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCustomers((prev) => {
            const merged = [...data];
            prev.forEach((localCust) => {
              const localClean = (localCust.phone || '').replace(/\D/g, '');
              if (localClean && !merged.some((m) => (m.phone || '').replace(/\D/g, '') === localClean)) {
                merged.push(localCust);
              }
            });
            return merged;
          });
        }
      }
    } catch (e) {}

    // 4. Fetch Orders & Real-time Shift Reconciliation
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(deduplicateOrders(data));
        }
      }
    } catch (e) {}

    // 5. Fetch Sales Adjustments & Manager Audit Records
    try {
      const res = await fetch('/api/sales-adjustments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSalesAdjustments(data);
        }
      }
    } catch (e) {}

    // 6. Fetch Shifts
    try {
      const res = await fetch('/api/shifts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mappedShifts: HistoricalShiftRecord[] = data.map((s: any) => ({
            id: s.id,
            shiftNumber: s.shift?.shiftNumber || s.shiftId || s.id,
            cashierName: s.cashierName || 'Cashier',
            role: 'cashier',
            outlet: 'Main Branch',
            openedAt: s.startTime ? new Date(s.startTime).toISOString() : new Date().toISOString(),
            closedAt: s.endTime ? new Date(s.endTime).toISOString() : new Date().toISOString(),
            startingPettyCash: Number(s.startingPettyCash) || 0,
            totalGrossSales: Number(s.totalSales) || 0,
            cashSales: Number(s.cashSales) || 0,
            cardSales: Number(s.cardSales) || 0,
            expectedCash: Number(s.expectedCash) || 0,
            actualCash: Number(s.actualCash) || 0,
            shortageOverage: Number(s.shortageOverage) || 0,
            transactionsCount: 0,
            status: 'closed',
            notes: s.notes || '',
          }));
          setHistoricalShifts(mappedShifts);
        }
      }
    } catch (e) {}

    // 7. Fetch Current Active Shift to unify across multiple accounts/terminals
    try {
      const res = await fetch('/api/shifts/current');
      if (res.ok) {
        const data = await res.json();
        if (data.shift) {
          const s = data.shift;
          setCurrentShift(prev => {
            // Unify open shift across all accounts if there's a live one on the server
            if (!prev || prev.status !== 'open' || prev.shiftNumber !== s.shiftNumber) {
              const activeShift: RegisterShift = {
                id: s.id || `shift-${s.shiftNumber}`,
                shiftNumber: s.shiftNumber,
                cashierName: s.cashierName || 'Cashier',
                openedBy: s.openedById || 'usr-1',
                openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : new Date().toISOString(),
                openingFloat: Number(s.startingFloat) || 0,
                startingFloat: Number(s.startingFloat) || 0,
                cashSales: 0,
                cardSales: 0,
                otherSales: 0,
                totalGrossSales: 0,
                totalTax: 0,
                totalDiscounts: 0,
                totalTips: 0,
                cashInDrawerExpected: Number(s.startingFloat) || 0,
                transactionsCount: 0,
                status: 'open',
                notes: s.notes || '',
              };
              return activeShift;
            }
            return prev;
          });
        }
      }
    } catch (e) {}
  }, []);

  // Initial mount fetch & periodic 15s background realtime sync
  useEffect(() => {
    syncFromServer();
    
    // Real-time synchronization via WebSockets
    const socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to real-time synchronization server');
    });
    
    socket.on('orderCreated', (newOrder: Order) => {
      setOrders((prev) => {
        // Prevent duplicates by id and orderNumber
        if (prev.some((o) => o.id === newOrder.id || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber))) {
          return prev.map((o) =>
            o.id === newOrder.id || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber)
              ? newOrder
              : o
          );
        }
        return [newOrder, ...prev];
      });
    });

    socket.on('orderUpdated', (updatedOrder: Order) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === updatedOrder.id || (updatedOrder.orderNumber && o.orderNumber === updatedOrder.orderNumber)
            ? updatedOrder
            : o
        )
      );
    });

    // Real-time menu synchronization
    socket.on('menuItemCreated', (createdItem: any) => {
      const newItem: MenuItem = {
        id: createdItem.id,
        name: createdItem.title || createdItem.name,
        description: createdItem.description || '',
        price: Number(createdItem.price),
        category: createdItem.category?.slug || createdItem.category?.title || createdItem.categoryId || 'pizzas',
        image: createdItem.imageUrl || createdItem.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
        available: createdItem.active !== false,
        flavors: createdItem.flavors ? (typeof createdItem.flavors === 'string' ? JSON.parse(createdItem.flavors) : createdItem.flavors) : [],
        isPopular: createdItem.isPopular || false,
        preparationTimeMinutes: createdItem.preparationTime || 10,
      };
      setMenuItems((prev) => {
        const exists = prev.some((m) => m.id === newItem.id);
        const updated = exists ? prev.map((m) => (m.id === newItem.id ? newItem : m)) : [newItem, ...prev];
        saveToStorage('pos_menu_items_cache', updated);
        return updated;
      });
    });

    socket.on('menuItemUpdated', (updatedItem: any) => {
      setMenuItems((prev) => {
        const updated = prev.map((m) => {
          if (m.id === updatedItem.id) {
            return {
              ...m,
              name: updatedItem.title || updatedItem.name || m.name,
              description: updatedItem.description !== undefined ? updatedItem.description : m.description,
              price: updatedItem.price !== undefined ? Number(updatedItem.price) : m.price,
              category: updatedItem.category?.slug || updatedItem.category?.title || updatedItem.categoryId || m.category,
              image: updatedItem.imageUrl || updatedItem.image || m.image,
              available: updatedItem.active !== false,
              flavors: updatedItem.flavors ? (typeof updatedItem.flavors === 'string' ? JSON.parse(updatedItem.flavors) : updatedItem.flavors) : m.flavors,
              preparationTimeMinutes: updatedItem.preparationTime || m.preparationTimeMinutes,
            };
          }
          return m;
        });
        saveToStorage('pos_menu_items_cache', updated);
        return updated;
      });
    });

    socket.on('menuItemDeleted', ({ id }: { id: string }) => {
      setMenuItems((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveToStorage('pos_menu_items_cache', updated);
        return updated;
      });
    });

    socket.on('categoriesUpdated', () => {
      fetch('/api/categories')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const mappedCats: Category[] = [
              { id: 'all', name: 'All', itemCount: 0 },
              ...data.map((c: any) => ({
                id: c.slug || c.id,
                name: c.title || c.name,
                icon: c.icon || undefined,
                itemCount: c._count?.menuItems || 0,
              })),
            ];
            setCategories(mappedCats);
            saveToStorage('pos_categories_cache', mappedCats);
          }
        })
        .catch(console.warn);
    });

    socket.on('customer:blocked', ({ phone, customer }: any) => {
      if (customer) {
        setCustomers((prev) => {
          const matchPhone = (p1?: string, p2?: string) => {
            if (!p1 || !p2) return false;
            const d1 = String(p1).replace(/\D/g, '');
            const d2 = String(p2).replace(/\D/g, '');
            return d1 && d2 && (d1 === d2 || (d1.length >= 7 && d2.length >= 7 && (d1.endsWith(d2) || d2.endsWith(d1))));
          };
          const exists = prev.some((c) => c.id === customer.id || matchPhone(c.phone, phone));
          if (exists) {
            return prev.map((c) => (c.id === customer.id || matchPhone(c.phone, phone) ? { ...c, ...customer } : c));
          }
          return [customer, ...prev];
        });
      }
    });

    socket.on('customer:unblocked', ({ phone, customer }: any) => {
      if (customer) {
        setCustomers((prev) => {
          const matchPhone = (p1?: string, p2?: string) => {
            if (!p1 || !p2) return false;
            const d1 = String(p1).replace(/\D/g, '');
            const d2 = String(p2).replace(/\D/g, '');
            return d1 && d2 && (d1 === d2 || (d1.length >= 7 && d2.length >= 7 && (d1.endsWith(d2) || d2.endsWith(d1))));
          };
          return prev.map((c) => {
            if (c.id === customer.id || matchPhone(c.phone, phone)) {
              return {
                ...c,
                ...customer,
                isBlocked: false,
                blockReason: undefined,
                blockedAt: undefined,
                blockedBy: undefined,
              };
            }
            return c;
          });
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [syncFromServer]);

  // Auto-recovery offline sync worker: drains IndexedDB queue when online with tenant isolation & auth
  const drainOfflineQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const token = loadFromStorage<string | null>('pos_jwt_token', null) || localStorage.getItem('pos_jwt_token');
      const activeOrgId = currentUser?.organizationId || 'org_default';
      const activeBranchId = currentUser?.branchId;

      const pending = await posDB.getQueuedOrders(activeOrgId, activeBranchId);
      for (const item of pending) {
        if (item.status === 'queued' || item.status === 'failed') {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const safeData = { ...item.data };
          delete safeData.jwtToken;
          delete safeData.password;
          delete safeData.pin;

          const res = await fetch('/api/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify(safeData),
          });

          if (res.ok || res.status === 200 || res.status === 201) {
            await posDB.removeQueuedOrder(item.localId);
            if (typeof showToast === 'function') {
              showToast(`✓ Offline Order #${item.orderNumber} successfully synced to server!`);
            }
          } else if (res.status === 409) {
            console.warn(`[IndexedDB Sync] Order #${item.orderNumber} already exists on server (HTTP 409). Evicting duplicate.`);
            await posDB.removeQueuedOrder(item.localId);
          } else if (res.status === 400 || res.status === 422) {
            console.error(`[IndexedDB Sync] Validation error (${res.status}). Quarantining record.`);
            const rawErr = await res.text().catch(() => 'Validation Error');
            const sanitizedErr = rawErr
              .replace(/("password"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
              .replace(/("pin"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
              .replace(/("token"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"');

            await posDB.updateQueuedOrderStatus(item.localId, 'quarantined', {
              httpStatus: res.status,
              failedAt: new Date().toISOString(),
              serverError: sanitizedErr.slice(0, 500),
            });
            if (typeof showToast === 'function') {
              showToast(`⚠️ Sync Alert: Order #${item.orderNumber} placed in manager quarantine.`);
            }
          } else if (res.status === 401 || res.status === 403) {
            console.warn(`[IndexedDB Sync] Authentication expired/invalid (HTTP ${res.status}). Pausing sync drain.`);
            break;
          } else {
            console.warn(`[IndexedDB Sync] Server returned HTTP ${res.status}. Will retry.`);
            await posDB.updateQueuedOrderStatus(item.localId, 'failed', {
              httpStatus: res.status,
              lastAttempt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (syncErr) {
      console.warn('Auto-sync queue drain error:', syncErr);
    } finally {
      isSyncingRef.current = false;
    }
  }, [currentUser, showToast]);

  useEffect(() => {
    window.addEventListener('online', drainOfflineQueue);
    const syncInterval = setInterval(drainOfflineQueue, 20000);
    drainOfflineQueue();

    return () => {
      window.removeEventListener('online', drainOfflineQueue);
      clearInterval(syncInterval);
    };
  }, [drainOfflineQueue]);

  // Table handlers wired to real Prisma DB
  const addTable = async (number: string, capacity: number) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, capacity }),
      });
      if (res.ok) {
        const table = await res.json();
        setTables((prev) => [...prev, table]);
        showToast(`✓ Table "${number}" added successfully to database!`);
      } else {
        const data = await res.json();
        showToast(`⚠️ ${data.error || 'Failed to create table'}`);
      }
    } catch (err) {
      console.error('Failed to create table:', err);
      showToast('❌ Server error while creating table');
    }
  };

  const deleteTable = async (id: string) => {
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTables((prev) => prev.filter((t) => t.id !== id));
        showToast('✓ Table removed from database.');
      } else {
        showToast('⚠️ Failed to delete table');
      }
    } catch (err) {
      console.error('Failed to delete table:', err);
      showToast('❌ Server error while deleting table');
    }
  };

  const updateTableStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTables((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch (err) {
      console.error('Failed to update table status:', err);
    }
  };

  // Authentication Helper for API requests
  const getAuthToken = async (overridePin?: string) => {
    try {
      // Use cached token if available and valid
      const cachedToken = loadFromStorage<string | null>('pos_jwt_token', null);
      if (cachedToken && !overridePin) {
        try {
          const parts = cachedToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const exp = payload.exp * 1000;
            if (Date.now() < exp) {
              return cachedToken;
            }
          }
        } catch (tokenParseErr) {
          console.warn('Stale or malformed cached token:', tokenParseErr);
        }
      }

      const authPin = overridePin || currentUser?.pin;
      if (!authPin) return null;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authPin })
      });
      if (res.ok) {
        const data = await res.json();
        saveToStorage('pos_jwt_token', data.token);
        return data.token;
      }
    } catch (e) {
      console.warn('Failed to fetch auth token', e);
    }
    return null;
  };

  // Staff handlers wired to real Prisma DB
  const addNewUser = async (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111'
        },
        body: JSON.stringify({
          name: user.name,
          username: user.username,
          pin: user.pin,
          role: user.role.toUpperCase(),
          phone: user.phone,
          restrictions: user.restrictions || '[]',
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const created = body.data;
        const newUser: UserAccount = {
          id: created.id,
          name: created.name,
          username: created.username,
          email: user.email || `${(user.username || 'user').toLowerCase().replace(/[\s._-]+/g, '')}@masterpos.com`,
          pin: user.pin,
          role: created.role.toLowerCase() as UserRole,
          outlet: user.outlet || 'Main Branch',
          phone: created.phone || '',
          active: created.active,
          restrictions: created.restrictions || '[]',
          createdAt: new Date().toISOString().split('T')[0],
        };
        setUsers((prev) => [...prev, newUser]);
        showToast(`✓ Staff member "${user.name}" saved to database!`);
        return;
      } else {
        const errData = await res.json();
        showToast(`⚠️ ${errData.error || 'Failed to create user'}`);
      }
    } catch (err) {
      console.error('Error creating user on server:', err);
    }

    // Local fallback if offline
    const newUser: UserAccount = {
      ...user,
      email: user.email || `${(user.username || 'user').toLowerCase().replace(/[\s._-]+/g, '')}@masterpos.com`,
      id: `usr-${Date.now()}`,
      restrictions: user.restrictions || '[]',
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: currentUser.name,
    };
    setUsers((prev) => [...prev, newUser]);
    showToast(`Staff member "${user.name}" created!`);
  };

  const updateUser = async (userId: string, updates: Partial<UserAccount>): Promise<boolean> => {
    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.role !== undefined) payload.role = updates.role.toUpperCase();
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.pin !== undefined) payload.pin = updates.pin;
      if (updates.active !== undefined) payload.active = updates.active;
      if (updates.restrictions !== undefined) payload.restrictions = updates.restrictions;

      const token = await getAuthToken();
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111'
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json();
        const updated = body.data;
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === userId) {
              const newPinValue = updated.pin || updates.pin || u.pin;
              const updatedUser: UserAccount = {
                ...u,
                name: updated.name || u.name,
                role: (updated.role ? updated.role.toLowerCase() : u.role) as UserRole,
                phone: updated.phone || u.phone || '',
                pin: newPinValue,
                password: newPinValue, // Erases and completely overwrites old password
                active: updated.active !== undefined ? updated.active : u.active,
                restrictions: updated.restrictions || u.restrictions || '[]',
              };
              if (currentUser && currentUser.id === userId) {
                setCurrentUser(updatedUser);
                saveToStorage('pos_current_user', updatedUser);
              }
              return updatedUser;
            }
            return u;
          })
        );
        showToast(`✓ Staff member "${updated.name}" updated successfully!`);
        return true;
      } else {
        const errData = await res.json();
        showToast(`⚠️ ${errData.error || 'Failed to update user'}`);
        return false;
      }
    } catch (err) {
      console.error('Error updating user on server:', err);
      showToast('❌ Server error while updating staff info');
      return false;
    }
  };

  const updateUserPin = async (userId: string, newPin: string) => {
    const cleanPin = newPin.trim();
    setUsers((prev) => {
      const nextUsers = prev.map((u) => {
        if (u.id === userId) {
          const updatedUser = { ...u, pin: cleanPin, password: cleanPin };
          if (currentUser && currentUser.id === userId) {
            setCurrentUser(updatedUser);
            saveToStorage('pos_current_user', updatedUser);
          }
          return updatedUser;
        }
        return u;
      });
      saveToStorage('pos_users_cache', nextUsers);
      return nextUsers;
    });
    const ok = await updateUser(userId, { pin: cleanPin });
    if (ok) {
      showToast('✓ Password updated! Previous password was deleted.');
    }
  };

  const toggleUserActive = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const newStatus = user.active === false ? true : false;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, active: newStatus } : u))
    );
    await updateUser(userId, { active: newStatus });
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    const target = users.find((u) => u.id === userId);
    if (!target) return false;
    if (target.role === 'owner') {
      const activeOwners = users.filter((u) => u.role === 'owner' && u.active !== false).length;
      if (activeOwners <= 1) {
        showToast('⚠️ Cannot delete the primary owner account.');
        return false;
      }
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.strategy === 'SOFT_DELETE_FALLBACK') {
          setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active: false } : u));
        } else {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
        }
        showToast(`✓ ${data.message || `Staff member "${target.name}" deleted from database.`}`);
        return true;
      } else if (res.status === 409) {
        const errData = await res.json();
        showToast(`⚠️ ${errData.error || 'User is linked to shift history. Deactivating instead.'}`);
        await toggleUserActive(userId);
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`❌ ${errData.error || 'Failed to delete user'}`);
        return false;
      }
    } catch (err) {
      console.error('Failed to delete user on server:', err);
      showToast('❌ Server network error while deleting user');
      return false;
    }
  };

  // Menu handlers wired to real Prisma DB
  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        },
        body: JSON.stringify({
          title: item.name,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.image,
          image: item.image,
          categoryTitle: item.category,
          category: item.category,
          active: item.available !== false,
          available: item.available !== false,
          flavors: item.flavors || [],
          options: item.options || [],
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const created = body.data;
        const newItem: MenuItem = {
          id: created.id,
          name: created.title || item.name,
          description: created.description || '',
          price: Number(created.price),
          category: item.category,
          image: created.imageUrl || item.image,
          available: created.active !== false,
          flavors: item.flavors || [],
          options: created.options ? (typeof created.options === 'string' ? JSON.parse(created.options) : created.options) : [],
          isPopular: item.isPopular || false,
        };
        setMenuItems((prev) => {
          const updated = [newItem, ...prev.filter((m) => m.id !== newItem.id)];
          saveToStorage('pos_menu_items_cache', updated);
          return updated;
        });
        showToast(`✓ Added "${newItem.name}" to database catalog!`);
        return;
      }
    } catch (err) {
      console.error('Failed to create menu item on server:', err);
    }

    const newItem: MenuItem = { ...item, id: `item-${Date.now()}` };
    setMenuItems((prev) => {
      const updated = [newItem, ...prev];
      saveToStorage('pos_menu_items_cache', updated);
      return updated;
    });
    showToast(`Added "${newItem.name}" to menu!`);
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    // Immediate optimistic local update
    setMenuItems((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
      saveToStorage('pos_menu_items_cache', updated);
      return updated;
    });

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/menu-items/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        },
        body: JSON.stringify({
          title: updates.name,
          name: updates.name,
          description: updates.description,
          price: updates.price,
          imageUrl: updates.image,
          image: updates.image,
          categoryTitle: updates.category,
          category: updates.category,
          active: updates.available,
          available: updates.available,
          flavors: updates.flavors,
          options: updates.options,
        })
      });

      if (res.ok) {
        showToast('✓ Menu item updated in database!');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`⚠️ ${errData.error || 'Failed to update item on server'}`);
      }
    } catch (err) {
      console.error('[updateMenuItem] Server sync error:', err);
    }
  };

  const deleteMenuItem = async (id: string): Promise<boolean> => {
    console.log('[deleteMenuItem] Attempting to delete menu item ID:', id);
    const target = menuItems.find((m) => m.id === id);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/menu-items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete menu item');
      }

      console.log('[deleteMenuItem] Delete API response success:', data);
      // Instant React state update so item vanishes immediately without page refresh
      setMenuItems((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveToStorage('pos_menu_items_cache', updated);
        return updated;
      });

      if (data.strategy === 'SOFT_DELETE' || data.strategy === 'SOFT_DELETE_FALLBACK') {
        showToast(`✓ "${target?.name || 'Item'}" deactivated in database.`);
      } else {
        showToast(`✓ "${target?.name || 'Item'}" permanently removed from database.`);
      }
      return true;
    } catch (err: any) {
      console.error('[deleteMenuItem] Error during delete execution:', err);
      showToast(`❌ ${err.message || 'Error deleting menu item'}`);
      return false;
    }
  };

  const toggleItemAvailability = async (id: string) => {
    const item = menuItems.find((m) => m.id === id);
    if (!item) return;
    const newAvail = item.available === false ? true : false;
    await updateMenuItem(id, { available: newAvail });
  };

  const addCategory = async (name: string) => {
    const catName = name.trim();
    if (!catName) return;

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        },
        body: JSON.stringify({ name: catName, title: catName })
      });

      if (res.ok) {
        const body = await res.json();
        const created = body.data;
        const newCat: Category = {
          id: created.slug || created.id,
          name: created.title,
          itemCount: 0,
        };
        setCategories((prev) => {
          const updated = [...prev, newCat];
          saveToStorage('pos_categories_cache', updated);
          return updated;
        });
        showToast(`✓ Category "${catName}" saved to database!`);
        return;
      }
    } catch (err) {
      console.error('[addCategory] Error creating category on server:', err);
    }

    const newCat: Category = {
      id: catName.toLowerCase().replace(/\s+/g, '-'),
      name: catName,
      itemCount: 0,
    };
    setCategories((prev) => {
      const updated = [...prev, newCat];
      saveToStorage('pos_categories_cache', updated);
      return updated;
    });
    showToast(`Category "${catName}" created!`);
  };

  const updateCategory = async (id: string, name: string) => {
    const catName = name.trim();
    if (!catName) return;

    setCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, name: catName } : c));
      saveToStorage('pos_categories_cache', updated);
      return updated;
    });

    try {
      const token = await getAuthToken();
      await fetch(`/api/categories/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        },
        body: JSON.stringify({ name: catName, title: catName })
      });
      showToast(`✓ Category updated to "${catName}" in database`);
    } catch (err) {
      console.error('[updateCategory] Error updating category on server:', err);
    }
  };

  const deleteCategory = async (id: string) => {
    if (id === 'all') return;
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveToStorage('pos_categories_cache', updated);
      return updated;
    });

    try {
      const token = await getAuthToken();
      await fetch(`/api/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-manager-pin': currentUser?.pin || '1111',
          'x-user-role': currentUser?.role || 'owner',
        }
      });
      showToast('✓ Category deactivated in database');
    } catch (err) {
      console.error('[deleteCategory] Error deleting category on server:', err);
    }
  };

  const reorderCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    showToast('Category order saved.');
  };

  const addDriver = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!drivers.includes(trimmed)) {
      setDrivers((prev) => [...prev, trimmed]);
    }
    const exists = users.some(
      (u) =>
        u.name.toLowerCase() === trimmed.toLowerCase() ||
        (u.username && u.username.toLowerCase() === trimmed.toLowerCase())
    );
    if (!exists) {
      addNewUser({
        name: trimmed,
        username: `rider_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        pin: '0000',
        role: 'rider',
        outlet: 'Main Branch',
        active: true,
      });
    }
  };

  const addDeliveryDriver = (driverName: string) => {
    addDriver(driverName);
  };

  // POS Cart item operations
  const addToPosCart = (item: MenuItem, flavor?: string, extraMods?: { name: string; price: number }[]) => {
    const chosenFlavor = flavor || (item.flavors && item.flavors.length > 0 ? item.flavors[0] : undefined);
    const chosenMods = extraMods || [];
    const modTotal = chosenMods.reduce((acc, m) => acc + m.price, 0);
    const unitPrice = item.price + modTotal;

    setPosCart((prev) => {
      // Check if identical item (same id + flavor + modifiers) exists
      const existingIdx = prev.items.findIndex(
        (i) =>
          i.menuItemId === item.id &&
          i.flavor === chosenFlavor &&
          JSON.stringify(i.modifiers) === JSON.stringify(chosenMods)
      );

      if (existingIdx !== -1) {
        const nextItems = [...prev.items];
        nextItems[existingIdx].quantity += 1;
        return { ...prev, items: nextItems };
      }

      const newCartItem: PosCartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        menuItemId: item.id,
        name: item.name,
        basePrice: item.price,
        price: unitPrice,
        quantity: 1,
        flavor: chosenFlavor,
        modifiers: chosenMods,
        extraCheesePrice: item.extraCheesePrice,
        extraChickenPrice: item.extraChickenPrice,
        thinCrustPrice: item.thinCrustPrice,
        options: item.options,
        itemNote: '',
        image: item.image,
      };

      return { ...prev, items: [...prev.items, newCartItem] };
    });
  };

  const removeFromPosCart = (cartItemId: string) => {
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== cartItemId),
    }));
  };

  const updateCartItemQty = (cartItemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromPosCart(cartItemId);
      return;
    }
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === cartItemId ? { ...i, quantity: qty } : i)),
    }));
  };

  const updateCartItemFlavor = (cartItemId: string, flavor: string) => {
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === cartItemId ? { ...i, flavor } : i)),
    }));
  };

  const toggleCartItemModifier = (cartItemId: string, modName: string, price: number) => {
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        if (i.id !== cartItemId) return i;
        const exists = i.modifiers.some((m) => m.name === modName);
        const nextMods = exists
          ? i.modifiers.filter((m) => m.name !== modName)
          : [...i.modifiers, { name: modName, price }];
        const modsTotal = nextMods.reduce((sum, m) => sum + m.price, 0);
        return {
          ...i,
          modifiers: nextMods,
          price: i.basePrice + modsTotal,
        };
      }),
    }));
  };

  const updateCartItemNote = (cartItemId: string, note: string) => {
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === cartItemId ? { ...i, itemNote: note } : i)),
    }));
  };

  const toggleCartItemCollapse = (cartItemId: string) => {
    setPosCart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === cartItemId ? { ...i, isCollapsed: !i.isCollapsed } : i
      ),
    }));
  };

  const clearPosCart = () => {
    setPosCart(DEFAULT_EMPTY_CART);
  };

  const setPosOrderType = (orderType: OrderType) => setPosCart((prev) => ({ ...prev, orderType }));
  const setPosTableNumber = (tableNumber: string) => setPosCart((prev) => ({ ...prev, tableNumber }));
  const setPosServer = (serverId: string, serverName: string) => setPosCart((prev) => ({ ...prev, serverId, serverName }));
  const setPosDeliveryDriver = (deliveryDriver: string) => setPosCart((prev) => ({ ...prev, deliveryDriver }));
  const setPosDiscountPercent = (discountPercent: number) => setPosCart((prev) => ({ ...prev, discountPercent }));
  const setPosTipAmount = (tipAmount: number) => setPosCart((prev) => ({ ...prev, tipAmount }));
  const setPosPaymentMethod = (paymentMethod: PaymentMethod) => setPosCart((prev) => ({ ...prev, paymentMethod }));
  const setPosNotes = (notes: string) => setPosCart((prev) => ({ ...prev, notes }));

  const setPosCustomerField = (field: keyof NonNullable<PosCartState['customer']>, value: any) => {
    setPosCart((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value,
      },
    }));
  };

  const setFullCustomer = (cust: Customer | null) => {
    if (!cust) {
      setPosCart((prev) => ({
        ...prev,
        customer: { name: '', phone: '', address: '', notes: '' },
      }));
      return;
    }
    setPosCart((prev) => ({
      ...prev,
      customer: {
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        address: cust.address || '',
        notes: cust.deliveryNotes || '',
        vipTier: cust.vipTier,
        loyaltyPoints: cust.loyaltyPoints,
        isBlocked: cust.isBlocked,
        blockReason: cust.blockReason,
        blockedAt: cust.blockedAt,
        blockedBy: cust.blockedBy,
      },
    }));
  };

  // Customer Lookup & Upsert via Prisma Server Endpoints
  const lookupCustomer = useCallback(
    async (
      phone: string
    ): Promise<{ found: boolean; customer?: Customer; pastOrders?: Order[] }> => {
      const clean = (phone || '').replace(/\D/g, '');
      // Make sure to fetch customer data only when 11 digits phone number completes
      if (!clean || clean.length < 11) return { found: false };

      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.found && data.customer) {
            setPosCart((prev) => ({
              ...prev,
              customer: {
                id: data.customer.id,
                name: data.customer.name,
                phone: data.customer.phone || clean,
                address: data.customer.address || '',
                notes: data.customer.deliveryNotes || data.customer.notes || '',
                vipTier: data.customer.vipTier,
                loyaltyPoints: data.customer.loyaltyPoints,
                isBlocked: data.customer.isBlocked,
                blockReason: data.customer.blockReason,
                blockedAt: data.customer.blockedAt,
                blockedBy: data.customer.blockedBy,
              },
            }));
            posDB.cacheCustomer(currentUser?.organizationId || 'org_default', data.customer).catch(() => {});
            return { found: true, customer: data.customer, pastOrders: data.pastOrders || [] };
          }
        }
      } catch (err) {
        console.warn('Customer lookup error:', err);
      }

      // Check IndexedDB cache
      try {
        const cachedInDB = await posDB.getCachedCustomer(currentUser?.organizationId || 'org_default', clean);
        if (cachedInDB) {
          setPosCart((prev) => ({
            ...prev,
            customer: {
              id: cachedInDB.id,
              name: cachedInDB.name,
              phone: cachedInDB.phone || clean,
              address: cachedInDB.address || '',
              notes: cachedInDB.deliveryNotes || cachedInDB.notes || '',
              vipTier: cachedInDB.vipTier,
              loyaltyPoints: cachedInDB.loyaltyPoints,
              isBlocked: cachedInDB.isBlocked,
              blockReason: cachedInDB.blockReason,
              blockedAt: cachedInDB.blockedAt,
              blockedBy: cachedInDB.blockedBy,
            },
          }));
          return { found: true, customer: cachedInDB, pastOrders: [] };
        }
      } catch (err) {}

      // Local fallback in state
      const found = customers.find((c) => {
        const dbDigits = (c.phone || '').replace(/\D/g, '');
        return dbDigits === clean || (clean.length === 11 && dbDigits.endsWith(clean)) || (dbDigits.length === 11 && clean.endsWith(dbDigits));
      });

      if (found) {
        setPosCart((prev) => ({
          ...prev,
          customer: {
            id: found.id,
            name: found.name,
            phone: found.phone || clean,
            address: found.address || '',
            notes: found.deliveryNotes || found.notes || '',
            vipTier: found.vipTier,
            loyaltyPoints: found.loyaltyPoints,
            isBlocked: found.isBlocked,
            blockReason: found.blockReason,
            blockedAt: found.blockedAt,
            blockedBy: found.blockedBy,
          },
        }));
        return { found: true, customer: found, pastOrders: [] };
      }

      return { found: false };
    },
    [customers]
  );

  const isManagerOrOwnerUser = useCallback((user?: UserAccount | null) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    return role === 'owner' || role === 'manager' || role === 'admin';
  }, []);

  const blockCustomer = useCallback(
    async (
      phone: string,
      reason: string,
      blockedBy?: string
    ): Promise<{ success: boolean; error?: string; customer?: Customer }> => {
      const clean = (phone || '').replace(/\D/g, '');
      if (!clean) return { success: false, error: 'Valid phone number is required.' };
      if (!reason || !reason.trim()) {
        return { success: false, error: 'Reason is required to block a customer.' };
      }

      if (!isManagerOrOwnerUser(currentUser)) {
        showToast('⚠️ Permission Denied: Only Manager or Owner can block customers.');
        return { success: false, error: 'Only Manager or Owner users can block customers.' };
      }

      const trimmedReason = reason.trim();
      const staffName = blockedBy || currentUser?.name || 'Manager';
      const blockedAt = new Date().toISOString();

      const matchPhone = (p1?: string, p2?: string) => {
        if (!p1 || !p2) return false;
        const d1 = String(p1).replace(/\D/g, '');
        const d2 = String(p2).replace(/\D/g, '');
        return d1 && d2 && (d1 === d2 || (d1.length >= 7 && d2.length >= 7 && (d1.endsWith(d2) || d2.endsWith(d1))));
      };

      let updatedCustomer: Customer | undefined;
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => matchPhone(c.phone, phone) || matchPhone((c as any).phoneNumber, phone));
        if (idx !== -1) {
          const updated = [...prev];
          updatedCustomer = {
            ...prev[idx],
            isBlocked: true,
            blockReason: trimmedReason,
            blockedAt,
            blockedBy: staffName,
          };
          updated[idx] = updatedCustomer;
          return updated;
        } else {
          updatedCustomer = {
            id: `cust-blk-${Date.now()}`,
            name: 'Blocked Customer',
            phone: clean,
            isBlocked: true,
            blockReason: trimmedReason,
            blockedAt,
            blockedBy: staffName,
            loyaltyPoints: 0,
            vipTier: 'Regular',
            totalOrdersCount: 0,
            totalSpent: 0,
            createdAt: new Date().toISOString(),
          };
          return [updatedCustomer, ...prev];
        }
      });

      // Synchronize active posCart customer if matching
      setPosCart((prev) => {
        if (matchPhone(prev.customer?.phone, phone)) {
          return {
            ...prev,
            customer: {
              ...prev.customer,
              isBlocked: true,
              blockReason: trimmedReason,
              blockedAt,
              blockedBy: staffName,
            },
          };
        }
        return prev;
      });

      if (updatedCustomer) {
        posDB.cacheCustomer(currentUser?.organizationId || 'org_default', updatedCustomer).catch(() => {});
      }

      try {
        const token = localStorage.getItem('pos_jwt_token');
        const res = await fetch('/api/customers/block', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-user-role': currentUser?.role || 'owner',
            'x-manager-pin': currentUser?.pin || '1111',
          },
          body: JSON.stringify({
            phone: clean || phone,
            reason: trimmedReason,
            blockedBy: staffName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            updatedCustomer = data.customer;
            setCustomers((prev) => prev.map((c) => (c.id === data.customer.id || matchPhone(c.phone, phone) ? data.customer : c)));
            posDB.cacheCustomer(currentUser?.organizationId || 'org_default', data.customer).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Backend block API error:', e);
      }

      showToast(`⛔ Customer ${clean || phone} has been blocked.`);
      return { success: true, customer: updatedCustomer };
    },
    [currentUser, isManagerOrOwnerUser, showToast]
  );

  const unblockCustomer = useCallback(
    async (phone: string): Promise<{ success: boolean; error?: string; customer?: Customer }> => {
      const clean = (phone || '').replace(/\D/g, '');
      if (!clean) return { success: false, error: 'Valid phone number is required.' };

      if (!isManagerOrOwnerUser(currentUser)) {
        showToast('⚠️ Permission Denied: Only Manager or Owner can unblock customers.');
        return { success: false, error: 'Only Manager or Owner users can unblock customers.' };
      }

      const matchPhone = (p1?: string, p2?: string) => {
        if (!p1 || !p2) return false;
        const d1 = String(p1).replace(/\D/g, '');
        const d2 = String(p2).replace(/\D/g, '');
        return d1 && d2 && (d1 === d2 || (d1.length >= 7 && d2.length >= 7 && (d1.endsWith(d2) || d2.endsWith(d1))));
      };

      let updatedCustomer: Customer | undefined;
      setCustomers((prev) => {
        return prev.map((c) => {
          if (matchPhone(c.phone, phone) || matchPhone((c as any).phoneNumber, phone)) {
            updatedCustomer = {
              ...c,
              isBlocked: false,
              blockReason: undefined,
              blockedAt: undefined,
              blockedBy: undefined,
            };
            return updatedCustomer;
          }
          return c;
        });
      });

      setPosCart((prev) => {
        if (matchPhone(prev.customer?.phone, phone)) {
          return {
            ...prev,
            customer: {
              ...prev.customer,
              isBlocked: false,
              blockReason: undefined,
              blockedAt: undefined,
              blockedBy: undefined,
            },
          };
        }
        return prev;
      });

      if (updatedCustomer) {
        posDB.cacheCustomer(currentUser?.organizationId || 'org_default', updatedCustomer).catch(() => {});
      }

      try {
        const token = localStorage.getItem('pos_jwt_token');
        const res = await fetch('/api/customers/unblock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-user-role': currentUser?.role || 'owner',
            'x-manager-pin': currentUser?.pin || '1111',
          },
          body: JSON.stringify({ phone: clean || phone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            updatedCustomer = data.customer;
            setCustomers((prev) => {
              const exists = prev.some((c) => c.id === data.customer.id || matchPhone(c.phone, phone));
              if (exists) {
                return prev.map((c) => (c.id === data.customer.id || matchPhone(c.phone, phone) ? data.customer : c));
              }
              return [data.customer, ...prev];
            });
            posDB.cacheCustomer(currentUser?.organizationId || 'org_default', data.customer).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Backend unblock API error:', e);
      }

      showToast(`✓ Customer ${clean || phone} unblocked successfully.`);
      return { success: true, customer: updatedCustomer };
    },
    [currentUser, isManagerOrOwnerUser, showToast]
  );

  const isCustomerBlocked = useCallback(
    (phone: string): { blocked: boolean; reason?: string; customer?: Customer } => {
      const clean = (phone || '').replace(/\D/g, '');
      if (!clean) return { blocked: false };
      const found = customers.find((c) => {
        const dbDigits = (c.phone || '').replace(/\D/g, '');
        return (
          (dbDigits === clean || (clean.length === 11 && dbDigits.endsWith(clean)) || (dbDigits.length === 11 && clean.endsWith(dbDigits))) &&
          Boolean(c.isBlocked)
        );
      });
      if (found) {
        return { blocked: true, reason: found.blockReason || 'Customer is blocked from placing orders.', customer: found };
      }
      return { blocked: false };
    },
    [customers]
  );

  const upsertCustomer = async (custData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    deliveryNotes?: string;
    notes?: string;
  }): Promise<Customer> => {
    const cleanPhone = (custData.phone || '').replace(/\D/g, '');
    let resultCustomer: Customer | null = null;

    try {
      const res = await fetch('/api/customers/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...custData,
          phone: cleanPhone || custData.phone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          resultCustomer = data.customer;
        }
      }
    } catch (e) {
      console.warn('Customer upsert fallback to client state:', e);
    }

    if (!resultCustomer) {
      resultCustomer = {
        id: `cust-${Date.now()}`,
        name: (custData.name && custData.name.trim()) || 'Customer',
        phone: cleanPhone || custData.phone,
        email: custData.email || '',
        address: custData.address || '',
        deliveryNotes: custData.deliveryNotes || custData.notes || '',
        vipTier: 'Regular',
        loyaltyPoints: 50,
        totalOrdersCount: 1,
        totalSpent: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
    }

    setCustomers((prev) => {
      const idx = prev.findIndex((c) => (c.phone || '').replace(/\D/g, '') === cleanPhone);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...prev[idx], ...resultCustomer! };
        return updated;
      }
      return [resultCustomer!, ...prev];
    });

    try {
      await posDB.cacheCustomer(currentUser?.organizationId || 'org_default', resultCustomer);
      if (cleanPhone) {
        await posDB.cacheCustomer(currentUser?.organizationId || 'org_default', { ...resultCustomer, phone: cleanPhone });
      }
    } catch (err) {}

    return resultCustomer;
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    const sum = posCart.items.reduce((acc, i) => acc + (Number(i.price) * Number(i.quantity)), 0);
    return roundToCurrency(sum);
  }, [posCart.items]);

  const cartDiscount = useMemo(() => {
    const pct = Number(posCart.discountPercent) || 0;
    return roundToCurrency((cartSubtotal * pct) / 100);
  }, [cartSubtotal, posCart.discountPercent]);

  const cartTax = useMemo(() => {
    // 16% standard sales tax
    return roundToCurrency((cartSubtotal - cartDiscount) * 0.16);
  }, [cartSubtotal, cartDiscount]);

  const cartDeliveryFee = useMemo(() => {
    return posCart.orderType === 'delivery' ? 150 : 0;
  }, [posCart.orderType]);

  const cartTotal = useMemo(() => {
    const rawTotal = cartSubtotal - cartDiscount + cartTax + cartDeliveryFee + (Number(posCart.tipAmount) || 0);
    return roundToCurrency(Math.max(0, rawTotal));
  }, [cartSubtotal, cartDiscount, cartTax, cartDeliveryFee, posCart.tipAmount]);

  // Order Punch & Persistence
  const punchOrder = async (tenderedAmount?: number, outletName?: string, splitPayments?: SplitPaymentEntry[]): Promise<Order> => {
    if (isPunchOrderInFlightRef.current) {
      throw new Error('An order is already being processed. Please wait.');
    }
    if (posCart.items.length === 0) {
      throw new Error('Cannot punch an empty order');
    }
    isPunchOrderInFlightRef.current = true;

    try {
      // Ensure shift is started
      if (!currentShift) {
        const defaultFloat = 0;
        const notes = `Shift auto-started on order punch by ${currentUser?.name || 'Cashier'}`;
        openShift(defaultFloat, notes);
        showToast(`🚀 Auto-started Shift for cashier ${currentUser?.name || 'Cashier'}!`);
      }

      if (posCart.orderType === 'delivery' && !posCart.deliveryDriver) {
        throw new Error('A delivery rider must be selected for delivery orders.');
      }

      // Check if customer is blocked
      const custPhone = (posCart.customer?.phone || '').replace(/\D/g, '');
      const isCustBlocked = Boolean(posCart.customer?.isBlocked) || (custPhone ? customers.some(c => (c.phone || '').replace(/\D/g, '') === custPhone && c.isBlocked) : false);
      if (isCustBlocked) {
        const foundBlocked = customers.find(c => (c.phone || '').replace(/\D/g, '') === custPhone && c.isBlocked);
        const reason = posCart.customer?.blockReason || foundBlocked?.blockReason || 'Customer is blocked from placing orders.';
        showToast(`⛔ BLOCKED CUSTOMER: Cannot place order! (${reason})`);
        throw new Error(`Blocked customer cannot place an order. Reason: ${reason}`);
      }

      const orderSeq = 100 + orders.length + 1;
      const orderNumber = `ORD-${orderSeq}`;
      const effectiveBranch = outletName || currentUser?.outlet || 'Gulberg Branch';
      const effectiveDriver = (posCart.orderType === 'delivery' || posCart.orderType === 'takeaway')
        ? (posCart.deliveryDriver || (posCart.orderType === 'delivery' ? 'Unassigned Rider' : 'Self Pickup'))
        : undefined;

      const isPaid = tenderedAmount !== undefined ? tenderedAmount > 0 : (splitPayments && splitPayments.length > 0);

      const effectivePaymentMethod: PaymentMethod = (splitPayments && splitPayments.length > 0)
        ? 'split'
        : (posCart.paymentMethod || 'cash');

      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        orderNumber,
        type: posCart.orderType,
        orderType: posCart.orderType,
        status: 'PUNCHED',
        paymentStatus: isPaid ? 'paid' : 'unpaid',
        paymentMethod: effectivePaymentMethod,
        splitPayments: splitPayments && splitPayments.length > 0 ? splitPayments : undefined,
        customer: {
          name: posCart.customer?.name || (posCart.orderType === 'delivery' ? 'Delivery Customer' : posCart.orderType === 'takeaway' ? 'Takeaway Customer' : 'Walk-in Customer'),
          phone: posCart.customer?.phone || '',
          address: posCart.customer?.address || '',
          deliveryNotes: posCart.customer?.notes || '',
        },
        tableNumber: posCart.orderType === 'dine_in' ? posCart.tableNumber : undefined,
        deliveryDriver: effectiveDriver,
        riderName: effectiveDriver,
        outlet: effectiveBranch,
        branchName: effectiveBranch,
        items: posCart.items.map((item) => ({
          id: `oi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          flavor: item.flavor,
          modifiers: item.modifiers,
          customization: [item.flavor, ...(item.modifiers || []).map((m) => m.name), item.itemNote]
            .filter(Boolean)
            .join(', '),
          image: item.image,
        })),
        subtotal: cartSubtotal,
        tax: cartTax,
        discount: cartDiscount,
        tip: posCart.tipAmount || 0,
        deliveryFee: cartDeliveryFee,
        total: cartTotal,
        amountTendered: tenderedAmount ?? cartTotal,
        changeGiven: tenderedAmount ? Math.max(0, tenderedAmount - cartTotal) : 0,
        notes: posCart.notes,
        cashierName: currentUser.name,
        cashierId: currentUser.id,
        createdAt: new Date().toISOString(),
        createdById: currentUser.id,
        terminalId: 'POS-MAIN-01',
        serverId: posCart.serverId,
        serverName: posCart.serverName,
      };

      // Auto-upsert customer via backend
      if (posCart.customer?.phone) {
        const cleanDigits = posCart.customer.phone.replace(/\D/g, '');
        if (cleanDigits.length >= 7) {
          upsertCustomer({
            name: (posCart.customer.name && posCart.customer.name.trim()) || 'Customer',
            phone: cleanDigits,
            address: posCart.customer.address,
            deliveryNotes: posCart.customer.notes,
          }).catch(() => {});
        }
      }

      let finalOrder = newOrder;
      try {
        const token = localStorage.getItem('pos_jwt_token');
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(newOrder),
        });
        if (response.ok) {
          const serverOrder = await response.json();
          finalOrder = serverOrder;
        } else {
          console.warn('Server responded with non-OK status. Queuing offline in IndexedDB:', response.status);
          await posDB.queueOrder(newOrder, currentUser?.organizationId, currentUser?.branchId);
        }
      } catch (e) {
        console.warn('Network unreachable. Persisting order into local offline IndexedDB queue:', e);
        try {
          await posDB.queueOrder(newOrder, currentUser?.organizationId, currentUser?.branchId);
          showToast(`⚡ Network offline: Order #${newOrder.orderNumber} saved locally to till queue.`);
        } catch (idbErr) {
          console.error('Critical IndexedDB Failure:', idbErr);
        }
      }

      setOrders((prev) => {
        const filtered = prev.filter(
          (o) =>
            o.id !== finalOrder.id &&
            o.id !== newOrder.id &&
            (!finalOrder.orderNumber || o.orderNumber !== finalOrder.orderNumber)
        );
        return deduplicateOrders([finalOrder, ...filtered]);
      });
      
      // Network Thermal ESC/POS Receipt Printing Service
      setPrintQueueOrder(finalOrder);
      fetch('/api/printer/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: finalOrder }),
      }).catch((e) => console.warn('Network thermal print error:', e));

      // Trigger Cash Drawer Kick pulse if cash payment is tendered
      const hasCashTendered =
        finalOrder.paymentMethod === 'cash' ||
        (finalOrder.splitPayments && finalOrder.splitPayments.some((p: any) => p.method === 'cash'));
      if (hasCashTendered) {
        fetch('/api/printer/drawer-kick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch((e) => console.warn('Drawer kick error:', e));
      }

      // Auto-deduct inventory
      setStockItems((prev) =>
        prev.map((stk) => {
          if (stk.name.includes('Cheese')) return { ...stk, currentStock: Math.max(0, stk.currentStock - 0.2) };
          if (stk.name.includes('Chicken')) return { ...stk, currentStock: Math.max(0, stk.currentStock - 0.3) };
          if (stk.name.includes('Flour')) return { ...stk, currentStock: Math.max(0, stk.currentStock - 0.25) };
          return stk;
        })
      );

      clearPosCart();
      showToast(`✓ Order ${finalOrder.orderNumber || newOrder.orderNumber} successfully punched!`);
      return finalOrder;
    } finally {
      isPunchOrderInFlightRef.current = false;
    }
  };

  const updateOrderStatus = (
    orderId: string, 
    status: Order['status'], 
    meta?: { 
      paymentStatus?: string; 
      paymentMethod?: string; 
      riderId?: string;
      amountTendered?: number;
      changeGiven?: number;
      reason?: string;
      cancelReason?: string;
      splitPayments?: SplitPaymentEntry[];
    }
  ) => {
    const normalizedStatus = (status || '').toLowerCase() as Order['status'];

    if (normalizedStatus === 'cancelled') {
      let cancelReason = meta?.reason || meta?.cancelReason;
      if (!cancelReason || !cancelReason.trim()) {
        const targetOrder = orders.find((o) => o.id === orderId);
        const orderNum = targetOrder?.orderNumber || orderId;
        const promptInput = window.prompt(`Please enter cancellation reason for Order #${orderNum}:`, 'Customer change of mind');
        if (promptInput === null) return; // User pressed Cancel on prompt
        cancelReason = promptInput.trim() || 'Customer change of mind';
      }
      cancelOrder(orderId, cancelReason);
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { 
        ...o, 
        status: normalizedStatus,
        ...(meta?.paymentStatus ? { paymentStatus: meta.paymentStatus as any } : {}),
        ...(meta?.paymentMethod ? { paymentMethod: meta.paymentMethod as any } : {}),
        ...(meta?.splitPayments ? { splitPayments: meta.splitPayments } : {}),
        ...(meta?.amountTendered !== undefined ? { amountTendered: meta.amountTendered, tenderedAmount: meta.amountTendered } : {}),
        ...(meta?.changeGiven !== undefined ? { changeGiven: meta.changeGiven } : {}),
        updatedAt: new Date().toISOString() 
      } : o))
    );
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: normalizedStatus,
        ...(meta?.paymentStatus ? { paymentStatus: meta.paymentStatus } : {}),
        ...(meta?.paymentMethod ? { paymentMethod: meta.paymentMethod } : {}),
        ...(meta?.splitPayments ? { splitPayments: meta.splitPayments } : {}),
        ...(meta?.riderId ? { riderId: meta.riderId } : {}),
      }),
    }).catch((err) => {
      console.warn('Status sync queued locally:', err);
    });
    showToast(`Order status updated to ${status.replace('_', ' ')}`);
  };

  const refundOrder = (orderId: string, reason: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'refunded',
              paymentStatus: 'refunded',
              refundReason: reason,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'refunded' }),
    }).catch(() => {});
    showToast(`Order ${orderId} refunded successfully.`);
  };

  const cancelOrder = async (orderId: string, reason: string, managerPin?: string) => {
    const target = orders.find((o) => o.id === orderId);
    const orderAmt = target ? (target.total || target.subtotal || 0) : 0;
    const itemsSummary = target?.items ? target.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : 'Order cancelled';
    const cleanReason = reason && reason.trim() ? reason.trim() : 'Customer change of mind';

    // 1. Immediate optimistic local update
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const existingNotes = o.notes || '';
        const updatedNotes = existingNotes.includes('[CANCELLED]:')
          ? existingNotes
          : existingNotes ? `${existingNotes} | [CANCELLED]: ${cleanReason}` : `[CANCELLED]: ${cleanReason}`;
        return {
          ...o,
          status: 'cancelled',
          cancelReason: cleanReason,
          notes: updatedNotes,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    addSalesAdjustment({
      orderId: target?.id || orderId,
      orderNumber: target?.orderNumber || orderId,
      type: 'CANCELLATION',
      authorizerName: currentUser.name,
      authorizerRole: currentUser.role,
      originalAmount: orderAmt,
      newAmount: 0,
      netDelta: -orderAmt,
      itemsSummary,
      reason: cleanReason,
    });

    // 2. Sync to backend database
    try {
      const token = await getAuthToken(managerPin);
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reason: cleanReason,
          managerId: currentUser.id,
          managerName: currentUser.name,
        }),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.order) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? {
                    ...resData.order,
                    cancelReason: cleanReason,
                    notes: resData.order.notes || `[CANCELLED]: ${cleanReason}`,
                  }
                : o
            )
          );
        }
      }
    } catch (err) {
      console.warn('Network offline during cancel, saved to offline local storage:', err);
    }

    showToast(`✓ Order #${target?.orderNumber || orderId} cancelled & ledger adjusted.`);
  };

  const editOrder = async (orderId: string, updates: Partial<Order>) => {
    const target = orders.find((o) => o.id === orderId);
    const oldTotal = target ? (target.total || 0) : 0;
    const newTotal = updates.total !== undefined ? updates.total : oldTotal;
    const priceDelta = newTotal - oldTotal;
    
    // Calculate shift delta based on payment status changes
    const wasPaid = target?.paymentStatus === 'paid';
    const isNowPaid = updates.paymentStatus === 'paid' || (updates.paymentStatus === undefined && wasPaid);
    
    let shiftDelta = 0;
    if (!wasPaid && isNowPaid) {
      shiftDelta = newTotal; // newly cashed out
    } else if (wasPaid && isNowPaid) {
      shiftDelta = priceDelta; // price modified on an already paid order
    } else if (wasPaid && !isNowPaid) {
      shiftDelta = -oldTotal; // payment reversed
    }

    // 1. Immediate optimistic local update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              ...updates,
              items: updates.items || o.items,
              status: updates.status || (o.status === 'completed' || o.status === 'cancelled' ? o.status : 'modified'),
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    if (target && (priceDelta !== 0 || updates.items)) {
      const itemsSummary = updates.items
        ? updates.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')
        : 'Modified order items';

      addSalesAdjustment({
        orderId: target.id,
        orderNumber: target.orderNumber || target.id,
        type: 'MODIFICATION',
        authorizerName: currentUser.name,
        authorizerRole: currentUser.role,
        originalAmount: oldTotal,
        newAmount: newTotal,
        netDelta: priceDelta,
        itemsSummary,
        reason: (updates as any).reason || 'Item modification / price adjustment',
      });
    }

    // 2. Sync to backend database
    try {
      const token = await getAuthToken((updates as any).managerPin);
      const response = await fetch(`/api/orders/${orderId}/modify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...updates,
          managerId: currentUser.id,
          managerName: currentUser.name,
        }),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.order) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? resData.order : o)));
        }
      }
    } catch (err) {
      console.warn('Network offline during modify, saved to offline local storage:', err);
    }

    showToast(`✓ Order #${target?.orderNumber || orderId} updated & ledger reconciled.`);
  };

  const assignDeliveryDriver = (orderId: string, driver: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              deliveryDriver: driver,
              riderName: driver,
              status: o.status === 'pending' || o.status === 'PUNCHED' || o.status === 'in_kitchen' || o.status === 'ready' ? 'dispatched' : o.status,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    const newStatus = 'dispatched';
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, riderId: driver }),
    }).catch(() => {});

    showToast(`✓ Order assigned to Rider & Dispatched`);
  };

  // Park / Recall orders
  const parkCurrentOrder = (title?: string) => {
    if (posCart.items.length === 0) return;
    const parked: ParkedOrder = {
      id: `park-${Date.now()}`,
      parkedAt: new Date().toISOString(),
      parkedBy: currentUser.name,
      title: title || `${posCart.customer?.name || 'Walk-in'} (${posCart.items.length} items)`,
      cart: { ...posCart },
    };
    setParkedOrders((prev) => [...prev, parked]);
    clearPosCart();
    showToast(`Order parked as "${parked.title}"`);
  };

  const recallParkedOrder = (parkedId: string) => {
    const target = parkedOrders.find((p) => p.id === parkedId);
    if (!target || !target.cart) return;
    setPosCart({
      items: target.cart.items || [],
      customer: target.cart.customer || {},
      orderType: target.cart.orderType || 'dine_in',
      tableNumber: target.cart.tableNumber,
      paymentMethod: target.cart.paymentMethod || 'cash',
      notes: target.cart.notes,
    });
    setParkedOrders((prev) => prev.filter((p) => p.id !== parkedId));
    showToast(`Recalled parked order "${target.title || 'Order'}"`);
  };

  const deleteParkedOrder = (parkedId: string) => {
    setParkedOrders((prev) => prev.filter((p) => p.id !== parkedId));
    showToast('Parked order cleared');
  };

  // Shift Management
  const openShift = (openingFloat: number, notes?: string) => {
    if (currentShift && currentShift.status === 'open') {
      showToast('⚠️ A shift is already open. Please close the active shift before opening a new one.');
      return;
    }
    const shiftSeq = Date.now().toString().slice(-4);
    const sNumber = `SH-${shiftSeq}`;
    const shift: RegisterShift = {
      id: `shift-${Date.now()}`,
      shiftNumber: sNumber,
      cashierName: currentUser.name,
      openedBy: currentUser.id,
      openedById: currentUser.id,
      terminalId: 'POS-MAIN-01',
      openedAt: new Date().toISOString(),
      openingFloat,
      startingFloat: openingFloat,
      cashSales: 0,
      cardSales: 0,
      otherSales: 0,
      totalGrossSales: 0,
      totalTax: 0,
      totalDiscounts: 0,
      totalTips: 0,
      cashInDrawerExpected: openingFloat,
      transactionsCount: 0,
      status: 'open',
      notes,
    };
    setCurrentShift(shift);
    saveToStorage('pos_current_shift', shift);

    // Sync to backend register shift API
    fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftNumber: sNumber,
        cashierName: currentUser.name,
        startingFloat: openingFloat,
        notes,
        openedById: currentUser.id,
      }),
    }).catch((e) => console.warn('Shift opened in offline mode:', e));

    showToast(`✓ Shift opened with PKR ${openingFloat.toLocaleString()} starting float`);
  };

  const updatePettyCash = (newAmount: number) => {
    setCurrentShift((prev) => {
      if (!prev) return prev;
      return { ...prev, openingFloat: newAmount, startingFloat: newAmount };
    });
    showToast(`Petty cash updated to PKR ${newAmount.toLocaleString()}`);
  };

  const closeShift = (actualCash: number, notes?: string) => {
    if (!currentShift) return;
    const diff = actualCash - currentShift.cashInDrawerExpected;
    const closed: RegisterShift = {
      ...currentShift,
      status: 'closed',
      closedAt: new Date().toISOString(),
      actualCashInDrawer: actualCash,
      cashDifference: diff,
      notes: notes || currentShift.notes,
    };
    setCurrentShift(closed);
    saveToStorage('pos_current_shift', closed);

    // Immediately record to historical shifts ledger so reports are immediately up to date
    const newHist: HistoricalShiftRecord = {
      id: `hist-${closed.id}-${Date.now()}`,
      shiftNumber: closed.shiftNumber,
      cashierName: closed.cashierName || currentUser.name,
      role: currentUser.role,
      outlet: currentUser.outlet || 'Main Branch',
      openedAt: closed.openedAt,
      closedAt: closed.closedAt || new Date().toISOString(),
      startingPettyCash: closed.startingFloat || closed.openingFloat || 0,
      totalGrossSales: closed.totalGrossSales || 0,
      cashSales: closed.cashSales || 0,
      cardSales: closed.cardSales || 0,
      expectedCash: closed.cashInDrawerExpected || 0,
      actualCash: actualCash,
      shortageOverage: diff,
      transactionsCount: closed.transactionsCount || 0,
      status: 'closed',
      notes: notes || closed.notes,
    };
    setHistoricalShifts((prev) => [newHist, ...prev]);

    // Check if today is the very last date of the month to trigger automatic monthly rider fleet reset after closing shift
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (tomorrow.getDate() === 1) {
      const nowStr = new Date().toISOString();
      setRiderResets((prev) => ({
        ...prev,
        all: nowStr,
      }));
      setTimeout(() => {
        showToast('📅 Last day of month shift close: Rider fleet statistics have been reset for the new month!');
      }, 1500);
    }

    showToast(`✓ Shift closed. Difference: PKR ${diff.toLocaleString()}`);
  };

  const updateStockQuantity = (id: string, newStock: number) => {
    setStockItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, currentStock: Math.max(0, newStock) } : s))
    );
    showToast('Inventory stock updated');
  };

  const isRestricted = (capability: string): boolean => {
    try {
      if (!currentUser || !currentUser.restrictions) return false;
      const parsed = JSON.parse(currentUser.restrictions);
      return Array.isArray(parsed) && parsed.includes(capability);
    } catch {
      return false;
    }
  };

  return (
    <RestaurantContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        setCurrentUser,
        isLoggedIn,
        setIsLoggedIn,
        loginUser,
        logoutUser,
        isRestricted,
        loginTheme,
        setLoginTheme,
        outlets,
    addOutlet,
    deleteOutlet,
    users,
        addNewUser,
        updateUser,
        updateUserPin,
        toggleUserActive,
        deleteUser,
        menuItems,
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        toggleItemAvailability,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        salesAdjustments,
        addSalesAdjustment,
        historicalShifts,
        posCart,
        addToPosCart,
        removeFromPosCart,
        updateCartItemQty,
        updateCartItemFlavor,
        toggleCartItemModifier,
        updateCartItemNote,
        toggleCartItemCollapse,
        clearPosCart,
        setPosOrderType,
        setPosTableNumber,
        setPosServer,
        setPosDeliveryDriver,
        setPosDiscountPercent,
        setPosTipAmount,
        setPosPaymentMethod,
        setPosNotes,
        setPosCustomerField,
        setFullCustomer,
        customers,
        drainOfflineQueue,
        lookupCustomer,
        upsertCustomer,
        blockCustomer,
        unblockCustomer,
        isCustomerBlocked,
        orders,
        parkedOrders,
        parkCurrentOrder,
        recallParkedOrder,
        deleteParkedOrder,
        cashDrops,
        dropRiderCash,
        addOrder,
        punchOrder,
        updateOrderStatus,
        refundOrder,
        cancelOrder,
        editOrder,
        assignDeliveryDriver,
        activeReceiptOrder,
        setActiveReceiptOrder,
        activeDeliverySlipOrder,
        setActiveDeliverySlipOrder,
        printQueueOrder,
        setPrintQueueOrder,
        currentShift,
        openShift,
        closeShift,
        updatePettyCash,
        stockItems,
        updateStockQuantity,
        tables,
        addTable,
        deleteTable,
        updateTableStatus,
        cartSubtotal,
        cartTax,
        cartDeliveryFee,
        cartDiscount,
        cartTotal,
        drivers,
        deliveryDrivers,
        addDriver,
        addDeliveryDriver,
        getRiderStats,
        riderResets,
        resetRiderStats,
        resetAllRidersStats,
        toast,
        showToast,
        syncFromServer,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

const DEFAULT_FALLBACK_USER: UserAccount = {
  id: 'usr-1',
  name: 'Administrator (Robert Vance)',
  username: 'admin',
  email: 'admin@masterpos.com',
  pin: '1111',
  password: '1111',
  role: 'owner',
  outlet: 'All Outlets',
  active: true,
  createdAt: '2025-01-01',
};

export const useRestaurant = (): RestaurantContextType => {
  const context = useContext(RestaurantContext);
  if (!context) {
    console.warn('useRestaurant was called outside of a RestaurantProvider. Returning fallback context.');
    return {
      theme: 'dark',
      toggleTheme: () => {},
      currentUser: DEFAULT_FALLBACK_USER,
      setCurrentUser: () => {},
      isLoggedIn: true,
      setIsLoggedIn: () => {},
      loginUser: () => ({ success: true }),
      logoutUser: () => {},
      isRestricted: () => false,
      loginTheme: 'dark',
      setLoginTheme: () => {},
      outlets: [],
      addOutlet: async () => {},
      deleteOutlet: async () => {},
      users: [],
      addNewUser: async () => {},
      updateUser: async () => true,
      updateUserPin: async () => {},
      toggleUserActive: async () => {},
      deleteUser: async () => true,
      menuItems: [],
      categories: [],
      selectedCategory: 'all',
      setSelectedCategory: () => {},
      searchQuery: '',
      setSearchQuery: () => {},
      addMenuItem: () => {},
      updateMenuItem: () => {},
      deleteMenuItem: async () => true,
      toggleItemAvailability: () => {},
      addCategory: () => {},
      updateCategory: () => {},
      deleteCategory: () => {},
      reorderCategories: () => {},
      salesAdjustments: [],
      addSalesAdjustment: () => {},
      historicalShifts: [],
      posCart: DEFAULT_EMPTY_CART,
      addToPosCart: () => {},
      removeFromPosCart: () => {},
      updateCartItemQty: () => {},
      updateCartItemFlavor: () => {},
      toggleCartItemModifier: () => {},
      updateCartItemNote: () => {},
      toggleCartItemCollapse: () => {},
      clearPosCart: () => {},
      setPosOrderType: () => {},
      setPosTableNumber: () => {},
      setPosServer: () => {},
      setPosDeliveryDriver: () => {},
      setPosDiscountPercent: () => {},
      setPosTipAmount: () => {},
      setPosPaymentMethod: () => {},
      setPosNotes: () => {},
      setPosCustomerField: () => {},
      setFullCustomer: () => {},
      customers: [],
      drainOfflineQueue: async () => {},
      lookupCustomer: async () => ({ found: false }),
      upsertCustomer: async () => ({} as Customer),
      blockCustomer: async () => ({ success: false }),
      unblockCustomer: async () => ({ success: false }),
      isCustomerBlocked: () => ({ blocked: false }),
      orders: [],
      parkedOrders: [],
      parkCurrentOrder: () => {},
      recallParkedOrder: () => {},
      deleteParkedOrder: () => {},
      cashDrops: [],
      dropRiderCash: () => {},
      addOrder: () => {},
      punchOrder: async () => ({} as Order),
      updateOrderStatus: () => {},
      refundOrder: async () => true,
      cancelOrder: async () => true,
      editOrder: async () => true,
      assignDeliveryDriver: async () => true,
      activeReceiptOrder: null,
      setActiveReceiptOrder: () => {},
      activeDeliverySlipOrder: null,
      setActiveDeliverySlipOrder: () => {},
      printQueueOrder: null,
      setPrintQueueOrder: () => {},
      currentShift: null,
      openShift: async () => {},
      closeShift: async () => {},
      updatePettyCash: () => {},
      stockItems: [],
      updateStockQuantity: () => {},
      tables: [],
      addTable: async () => {},
      deleteTable: async () => {},
      updateTableStatus: async () => {},
      cartSubtotal: 0,
      cartTax: 0,
      cartDeliveryFee: 0,
      cartDiscount: 0,
      cartTotal: 0,
      drivers: [],
      deliveryDrivers: [],
      addDriver: () => {},
      addDeliveryDriver: () => {},
      getRiderStats: () => ({
        totalAssigned: 0,
        assignedItemsCount: 0,
        delivered: 0,
        deliveredItemsCount: 0,
        cancelled: 0,
        active: 0,
        inTransit: 0,
        totalRevenue: 0,
        cancelledRevenue: 0,
        netFleetRevenue: 0,
        codCashOnHand: 0,
      }),
      riderResets: {},
      resetRiderStats: () => {},
      resetAllRidersStats: () => {},
      toast: null,
      showToast: () => {},
      syncFromServer: async () => {},
    };
  }
  return context;
};
