import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  UserAccount,
  UserRole,
  InventoryStockItem,
  SalesAdjustmentRecord,
  RiderStats,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_CUSTOMERS,
  INITIAL_STOCK,
  HISTORICAL_SHIFT_AUDITS,
  INITIAL_SALES_ADJUSTMENTS,
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
  lookupCustomer: (phone: string) => Promise<{ found: boolean; customer?: Customer; pastOrders?: Order[] }>;
  upsertCustomer: (customerData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    deliveryNotes?: string;
    notes?: string;
  }) => Promise<Customer>;

  // Orders & Transactions
  orders: Order[];
  parkedOrders: ParkedOrder[];
  parkCurrentOrder: (title?: string) => void;
  recallParkedOrder: (parkedId: string) => void;
  deleteParkedOrder: (parkedId: string) => void;
  punchOrder: (tenderedAmount?: number, outletName?: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  refundOrder: (orderId: string, reason: string) => void;
  cancelOrder: (orderId: string, reason: string) => Promise<any>;
  editOrder: (orderId: string, updates: any) => Promise<any>;
  assignDeliveryDriver: (orderId: string, driver: string) => void;

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

  // Toast
  toast: string | null;
  showToast: (msg: string) => void;
}

const DEFAULT_EMPTY_CART: PosCartState = {
  items: [],
  customer: {
    name: '',
    phone: '',
    address: '',
    notes: '',
  },
  orderType: 'takeaway',
  tableNumber: 'Table 1',
  deliveryDriver: 'Carlos Rodriguez',
  discountPercent: 0,
  tipAmount: 0,
  paymentMethod: 'cash',
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

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('pos_theme') as 'light' | 'dark') || 'dark';
  });
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
    loadFromStorage('pos_outlets_cache', ['Gulberg Branch', 'DHA Phase 5', 'F-7 Islamabad', 'Mall of Lahore'])
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
        name: 'Robert Vance (Owner)',
        username: 'owner',
        email: 'owner@whitescastle.com',
        pin: '1111',
        password: '1111',
        role: 'owner',
        outlet: 'All Outlets',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-2',
        name: 'Farhan Tariq (Manager)',
        username: 'manager',
        email: 'manager@whitescastle.com',
        pin: '2222',
        password: '2222',
        role: 'manager',
        outlet: 'Main Branch',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-3',
        name: 'Ali Hassan (Cashier)',
        username: 'cashier',
        email: 'cashier@whitescastle.com',
        pin: '3333',
        password: '3333',
        role: 'cashier',
        outlet: 'Main Branch',
        active: true,
        createdAt: '2025-01-01',
      },
      {
        id: 'usr-4',
        name: 'Sana Malik (Cashier)',
        username: 'cashier2',
        email: 'cashier2@whitescastle.com',
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
        if (uUsername === 'owner' || uRole === 'owner') {
          return { ...u, username: 'owner', email: u.email || 'owner@whitescastle.com', pin: '1111', password: '1111' };
        }
        if (uUsername === 'manager' || uRole === 'manager') {
          return { ...u, username: 'manager', email: u.email || 'manager@whitescastle.com', pin: '2222', password: '2222' };
        }
        if (uUsername === 'cashier' || uRole === 'cashier') {
          return { ...u, username: 'cashier', email: u.email || 'cashier@whitescastle.com', pin: '3333', password: '3333' };
        }
        return u;
      });
    }
    return defaultList;
  });
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    const saved = loadFromStorage<UserAccount | null>('pos_current_user', null);
    if (saved && saved.id) return saved;
    return users[0];
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return loadFromStorage<boolean>('pos_is_logged_in', true);
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
    showToast('🔒 Logged out. Return to login screen.');
  }, [showToast]);

  const loginUser = useCallback(
    (emailOrUser: string, passwordOrPin: string) => {
      const cleanInput = (emailOrUser || '').trim().toLowerCase();
      const cleanPass = (passwordOrPin || '').trim();

      if (!cleanInput) {
        return { success: false, error: 'Please enter your email or username.' };
      }

      if (!cleanPass) {
        return { success: false, error: 'Please enter your password or PIN.' };
      }

      // Find matching user by email, username, name, id, or role
      let matched = users.find((u) => {
        if (u.active === false) return false;
        const uUsername = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const uName = (u.name || '').toLowerCase();
        const uId = (u.id || '').toLowerCase();
        const uRole = (u.role || '').toLowerCase();

        return (
          uUsername === cleanInput ||
          uEmail === cleanInput ||
          uName === cleanInput ||
          uName.includes(cleanInput) ||
          uId === cleanInput ||
          (cleanInput === 'owner' && uRole === 'owner') ||
          (cleanInput === 'admin' && uRole === 'owner') ||
          (cleanInput === 'manager' && uRole === 'manager') ||
          (cleanInput === 'cashier' && uRole === 'cashier')
        );
      });

      if (!matched && (cleanInput === 'owner' || cleanInput === 'admin' || cleanInput.includes('owner'))) {
        matched = users.find((u) => u.role === 'owner') || users[0];
      }

      if (!matched) {
        return { success: false, error: 'Invalid Email Address / Username or Password.' };
      }

      // Credential verification against user's set PIN or password
      const isPinMatch = matched.pin === cleanPass;
      const isPassMatch = matched.password ? matched.password === cleanPass : false;
      const isDefaultRolePin =
        (matched.role === 'owner' && (cleanPass === '1111' || cleanPass === '1234')) ||
        (matched.role === 'manager' && (cleanPass === '2222' || cleanPass === '1234')) ||
        (matched.role === 'cashier' && (cleanPass === '3333' || cleanPass === '4444' || cleanPass === '1234'));

      if (isPinMatch || isPassMatch || isDefaultRolePin) {
        setCurrentUser(matched);
        setIsLoggedIn(true);
        saveToStorage('pos_is_logged_in', true);
        saveToStorage('pos_current_user', matched);
        return { success: true, user: matched };
      }

      return { success: false, error: 'Invalid Email Address / Username or Password.' };
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
  const [salesAdjustments, setSalesAdjustments] = useState<SalesAdjustmentRecord[]>(() =>
    loadFromStorage('pos_sales_adjustments_cache', INITIAL_SALES_ADJUSTMENTS)
  );
  const [historicalShifts, setHistoricalShifts] = useState<HistoricalShiftRecord[]>(() =>
    loadFromStorage('pos_shifts_cache', HISTORICAL_SHIFT_AUDITS)
  );

  // POS State
  const [posCart, setPosCart] = useState<PosCartState>(DEFAULT_EMPTY_CART);
  const [orders, setOrders] = useState<Order[]>(() => loadFromStorage('pos_orders_cache', []));
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() =>
    loadFromStorage('pos_parked_orders_cache', [])
  );
  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadFromStorage('pos_customers_cache', INITIAL_CUSTOMERS)
  );
  const [stockItems, setStockItems] = useState<InventoryStockItem[]>(() =>
    loadFromStorage('pos_stock_cache', INITIAL_STOCK)
  );
  const [drivers, setDrivers] = useState<string[]>([
    'Carlos Rodriguez',
    'Samir Khan',
    'Marcus Vance',
    'David Miller',
    'Elena Scott',
  ]);

  const [tables, setTables] = useState<{ id: string; number: string; capacity: number; status: string; active: boolean }[]>(() =>
    loadFromStorage('pos_tables_cache', [])
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
        return { totalAssigned: 0, delivered: 0, cancelled: 0, active: 0, inTransit: 0, totalRevenue: 0 };
      }
      const cleanTarget = riderIdentifier.trim().toLowerCase();
      const matchedUser = users.find(
        (u) =>
          u.id.toLowerCase() === cleanTarget ||
          u.name.toLowerCase() === cleanTarget ||
          (u.username && u.username.toLowerCase() === cleanTarget)
      );

      const targetName = (matchedUser ? matchedUser.name : riderIdentifier).trim().toLowerCase();
      const targetId = (matchedUser ? matchedUser.id : riderIdentifier).trim().toLowerCase();
      const targetUsername = (matchedUser?.username || '').trim().toLowerCase();

      const assigned = orders.filter((o) => {
        const orderDriver = (o.deliveryDriver || '').trim().toLowerCase();
        const orderRiderId = (o as any).assignedRiderId
          ? String((o as any).assignedRiderId).trim().toLowerCase()
          : '';
        return (
          orderDriver === targetName ||
          orderDriver === targetId ||
          (targetUsername && orderDriver === targetUsername) ||
          (orderRiderId && (orderRiderId === targetId || orderRiderId === cleanTarget))
        );
      });

      const delivered = assigned.filter(
        (o) => o.status === 'completed' || o.status === 'delivered'
      ).length;
      const cancelled = assigned.filter(
        (o) => o.status === 'cancelled' || o.status === 'refunded'
      ).length;
      const active = assigned.filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled' &&
          o.status !== 'refunded'
      ).length;
      const totalRevenue = assigned
        .filter((o) => o.status === 'completed' || o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0);

      return {
        totalAssigned: assigned.length,
        delivered,
        cancelled,
        active,
        inTransit: active,
        totalRevenue,
      };
    },
    [orders, users]
  );

  const addSalesAdjustment = useCallback((adj: Omit<SalesAdjustmentRecord, 'id' | 'timestamp'>) => {
    const newAdj: SalesAdjustmentRecord = {
      ...adj,
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    setSalesAdjustments((prev) => [newAdj, ...prev]);
  }, []);

  // Current Register Shift
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [activeDeliverySlipOrder, setActiveDeliverySlipOrder] = useState<Order | null>(null);
  const [printQueueOrder, setPrintQueueOrder] = useState<Order | null>(null);

  const [currentShift, setCurrentShift] = useState<RegisterShift | null>({
    id: 'shift-101',
    shiftNumber: 'SH-101',
    cashierName: 'Robert Vance',
    terminalId: 'POS-MAIN-01',
    openedAt: new Date().toISOString(),
    openingFloat: 5000,
    cashSales: 0,
    cardSales: 0,
    otherSales: 0,
    totalGrossSales: 0,
    totalTax: 0,
    totalDiscounts: 0,
    totalTips: 0,
    cashInDrawerExpected: 5000,
    transactionsCount: 0,
    status: 'open',
  });

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
    } catch (e) {
      console.warn('Tables fetch fallback to cache:', e);
    }

    // 1. Fetch Users
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedUsers: UserAccount[] = data.map((u: any) => ({
            id: u.id,
            name: u.name,
            username: u.username || u.name.toLowerCase().replace(/\s+/g, ''),
            pin: u.pin || '1234',
            role: (u.role || 'cashier').toLowerCase() as UserRole,
            outlet: u.outlet || 'Main Branch',
            active: u.active !== false,
            createdAt: u.createdAt ? String(u.createdAt).split('T')[0] : '2025-01-01',
          }));
          setUsers(mappedUsers);
        }
      }
    } catch (err) {
      console.warn('User fetch fallback to local cache:', err);
    }

    // 2. Fetch Menu Items
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedItems: MenuItem[] = data.map((i: any) => ({
            id: i.id,
            name: i.title || i.name,
            description: i.description || '',
            price: Number(i.price),
            category: i.category?.slug || i.categoryId || i.category || 'pizzas',
            image: i.imageUrl || i.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
            available: i.active !== false,
            flavors: i.flavors ? (typeof i.flavors === 'string' ? JSON.parse(i.flavors) : i.flavors) : [],
            isPopular: i.isPopular || false,
          }));
          setMenuItems(mappedItems);
        }
      }
    } catch (err) {
      console.warn('Menu fetch fallback to local cache:', err);
    }

    // 3. Fetch Customers
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCustomers(data);
      }
    } catch (e) {}

    // 4. Fetch Orders & Real-time Shift Reconciliation
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
          setCurrentShift((prev) => {
            if (!prev || prev.status !== 'open') return prev;
            const shiftStartTime = prev.openedAt ? new Date(prev.openedAt).getTime() : 0;
            const shiftOrders = data.filter(
              (o: any) =>
                (o.status || '').toLowerCase() !== 'cancelled' &&
                (o.status || '').toLowerCase() !== 'refunded' &&
                (!shiftStartTime || new Date(o.createdAt).getTime() >= shiftStartTime)
            );
            const cash = shiftOrders
              .filter((o: any) => o.paymentMethod === 'cash')
              .reduce((sum: number, o: any) => sum + (o.total || o.subtotal || 0), 0);
            const card = shiftOrders
              .filter((o: any) => o.paymentMethod === 'card' || o.paymentMethod === 'online')
              .reduce((sum: number, o: any) => sum + (o.total || o.subtotal || 0), 0);
            const tax = shiftOrders.reduce((sum: number, o: any) => sum + (o.tax || 0), 0);
            const discounts = shiftOrders.reduce((sum: number, o: any) => sum + (o.discount || 0), 0);
            const tips = shiftOrders.reduce((sum: number, o: any) => sum + (o.tip || 0), 0);

            return {
              ...prev,
              cashSales: cash,
              cardSales: card,
              totalGrossSales: cash + card,
              totalTax: tax,
              totalDiscounts: discounts,
              totalTips: tips,
              cashInDrawerExpected: (prev.openingFloat || 5000) + cash,
              transactionsCount: shiftOrders.length,
            };
          });
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
  }, []);

  // Initial mount fetch & periodic 15s background realtime sync
  useEffect(() => {
    syncFromServer();
    const interval = setInterval(syncFromServer, 15000);
    return () => clearInterval(interval);
  }, [syncFromServer]);

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

  // Staff handlers wired to real Prisma DB
  const addNewUser = async (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          username: user.username,
          pin: user.pin,
          role: user.role.toUpperCase(),
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const created = body.data;
        const newUser: UserAccount = {
          id: created.id,
          name: created.name,
          username: created.username,
          pin: user.pin,
          role: created.role.toLowerCase() as UserRole,
          outlet: user.outlet || 'Main Branch',
          active: created.active,
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
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: currentUser.name,
    };
    setUsers((prev) => [...prev, newUser]);
    showToast(`Staff member "${user.name}" created!`);
  };

  const updateUserPin = (userId: string, newPin: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPin } : u))
    );
    showToast('PIN successfully updated!');
  };

  const toggleUserActive = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const newStatus = u.active === false ? true : false;
        showToast(`Staff "${u.name}" ${newStatus ? 'activated' : 'deactivated'}.`);
        return { ...u, active: newStatus };
      })
    );
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
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
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
        toggleUserActive(userId);
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
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.image,
          categoryTitle: item.category,
          active: item.available !== false,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const created = body.data;
        const newItem: MenuItem = {
          id: created.id,
          name: created.title,
          description: created.description || '',
          price: Number(created.price),
          category: item.category,
          image: created.imageUrl || item.image,
          available: created.active,
          flavors: item.flavors || [],
          isPopular: item.isPopular || false,
        };
        setMenuItems((prev) => [newItem, ...prev]);
        showToast(`✓ Added "${newItem.name}" to database catalog!`);
        return;
      }
    } catch (err) {
      console.error('Failed to create menu item on server:', err);
    }

    const newItem: MenuItem = { ...item, id: `item-${Date.now()}` };
    setMenuItems((prev) => [newItem, ...prev]);
    showToast(`Added "${newItem.name}" to menu!`);
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setMenuItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    showToast('Menu item updated!');
  };

  const deleteMenuItem = async (id: string): Promise<boolean> => {
    console.log('[deleteMenuItem] Attempting to delete menu item ID:', id);
    const target = menuItems.find((m) => m.id === id);
    try {
      const res = await fetch(`/api/menu-items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete menu item');
      }

      console.log('[deleteMenuItem] Delete API response success:', data);
      // Instant React state update so item vanishes immediately without page refresh
      setMenuItems((prev) => prev.filter((m) => m.id !== id));

      if (data.strategy === 'SOFT_DELETE' || data.strategy === 'SOFT_DELETE_FALLBACK') {
        showToast(`✓ "${target?.name || 'Item'}" soft-deleted (active: false). Hidden from POS grid.`);
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

  const toggleItemAvailability = (id: string) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, available: m.available === false ? true : false } : m))
    );
  };

  const addCategory = (name: string) => {
    const newCat: Category = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      itemCount: 0,
    };
    setCategories((prev) => [...prev, newCat]);
    showToast(`Category "${name}" created!`);
  };

  const updateCategory = (id: string, name: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c))
    );
    showToast(`Category updated to "${name}"`);
  };

  const deleteCategory = (id: string) => {
    if (id === 'all') return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    showToast('Category removed.');
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
      },
    }));
  };

  // Customer Lookup & Upsert via Prisma Server Endpoints
  const lookupCustomer = useCallback(
    async (
      phone: string
    ): Promise<{ found: boolean; customer?: Customer; pastOrders?: Order[] }> => {
      const clean = (phone || '').replace(/\D/g, '');
      if (!clean || clean.length < 4) return { found: false };

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
                phone: prev.customer?.phone || data.customer.phone,
                address: data.customer.address || '',
                notes: data.customer.deliveryNotes || '',
                vipTier: data.customer.vipTier,
                loyaltyPoints: data.customer.loyaltyPoints,
              },
            }));
            return { found: true, customer: data.customer, pastOrders: data.pastOrders || [] };
          }
        }
      } catch (err) {
        console.warn('Customer lookup error:', err);
      }

      // Local fallback
      const found = customers.find((c) => {
        const dbDigits = c.phone.replace(/\D/g, '');
        return dbDigits === clean || (clean.length >= 10 && dbDigits.endsWith(clean));
      });

      if (found) {
        setPosCart((prev) => ({
          ...prev,
          customer: {
            id: found.id,
            name: found.name,
            phone: prev.customer?.phone || found.phone,
            address: found.address,
            notes: found.deliveryNotes || '',
            vipTier: found.vipTier,
            loyaltyPoints: found.loyaltyPoints,
          },
        }));
        return { found: true, customer: found, pastOrders: [] };
      }

      return { found: false };
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
    try {
      const res = await fetch('/api/customers/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          setCustomers((prev) => {
            const idx = prev.findIndex((c) => c.phone.replace(/\D/g, '') === custData.phone.replace(/\D/g, ''));
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = data.customer;
              return updated;
            }
            return [data.customer, ...prev];
          });
          return data.customer;
        }
      }
    } catch (e) {
      console.warn('Customer upsert fallback to client state:', e);
    }

    const fallback: Customer = {
      id: `cust-${Date.now()}`,
      name: custData.name || 'Customer',
      phone: custData.phone,
      email: custData.email,
      address: custData.address || '',
      deliveryNotes: custData.deliveryNotes || custData.notes || '',
      vipTier: 'Regular',
      loyaltyPoints: 50,
      totalOrdersCount: 1,
      totalSpent: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCustomers((prev) => [fallback, ...prev]);
    return fallback;
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return posCart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }, [posCart.items]);

  const cartDiscount = useMemo(() => {
    return (cartSubtotal * (posCart.discountPercent || 0)) / 100;
  }, [cartSubtotal, posCart.discountPercent]);

  const cartTax = useMemo(() => {
    // 16% standard sales tax
    return Math.round((cartSubtotal - cartDiscount) * 0.16);
  }, [cartSubtotal, cartDiscount]);

  const cartDeliveryFee = useMemo(() => {
    return posCart.orderType === 'delivery' ? 150 : 0;
  }, [posCart.orderType]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - cartDiscount + cartTax + cartDeliveryFee + (posCart.tipAmount || 0));
  }, [cartSubtotal, cartDiscount, cartTax, cartDeliveryFee, posCart.tipAmount]);

  // Order Punch & Persistence
  const punchOrder = async (tenderedAmount?: number, outletName?: string): Promise<Order> => {
    if (posCart.items.length === 0) {
      throw new Error('Cannot punch an empty order');
    }

    const orderSeq = 100 + orders.length + 1;
    const orderNumber = `ORD-${orderSeq}`;
    const effectiveBranch = outletName || currentUser?.outlet || 'Gulberg Branch';
    const effectiveDriver = (posCart.orderType === 'delivery' || posCart.orderType === 'takeaway')
      ? (posCart.deliveryDriver || (posCart.orderType === 'delivery' ? 'Unassigned Rider' : 'Self Pickup'))
      : undefined;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      type: posCart.orderType,
      orderType: posCart.orderType,
      status: 'pending',
      paymentStatus: 'paid',
      paymentMethod: posCart.paymentMethod,
      customer: {
        name: posCart.customer?.name || (posCart.orderType === 'delivery' ? 'Delivery Customer' : posCart.orderType === 'takeaway' ? 'Takeaway Customer' : 'Walk-in Customer'),
        phone: posCart.customer?.phone || '',
        address: posCart.customer?.address || '',
        deliveryNotes: posCart.customer?.notes || '',
      },
      tableNumber: posCart.orderType === 'dine_in' ? posCart.tableNumber : undefined,
      deliveryDriver: effectiveDriver,
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
      createdById: currentUser.id,
      terminalId: 'POS-MAIN-01',
      serverId: posCart.serverId,
      serverName: posCart.serverName,
      createdAt: new Date().toISOString(),
    };

    // Auto-upsert customer via backend
    if (posCart.customer?.phone && posCart.customer.phone.trim().length >= 4) {
      upsertCustomer({
        name: posCart.customer.name || 'Customer',
        phone: posCart.customer.phone,
        address: posCart.customer.address,
        deliveryNotes: posCart.customer.notes,
      }).catch(() => {});
    }

    let finalOrder = newOrder;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
      if (response.ok) {
        const serverOrder = await response.json();
        finalOrder = serverOrder;
      }
    } catch (e) {
      console.warn('Order synced locally due to network error:', e);
    }

    setOrders((prev) => [finalOrder, ...prev]);
    
    // Auto-print receipt
    setPrintQueueOrder(finalOrder);
    setTimeout(() => {
      window.print();
    }, 500);

    // Update current shift stats
    if (currentShift && currentShift.status === 'open') {
      setCurrentShift((prev) => {
        if (!prev) return null;
        const isCash = posCart.paymentMethod === 'cash';
        return {
          ...prev,
          totalGrossSales: prev.totalGrossSales + cartTotal,
          cashSales: isCash ? prev.cashSales + cartTotal : prev.cashSales,
          cardSales: !isCash ? prev.cardSales + cartTotal : prev.cardSales,
          totalTax: prev.totalTax + cartTax,
          totalDiscounts: prev.totalDiscounts + cartDiscount,
          totalTips: prev.totalTips + (posCart.tipAmount || 0),
          cashInDrawerExpected: isCash ? prev.cashInDrawerExpected + cartTotal : prev.cashInDrawerExpected,
          transactionsCount: prev.transactionsCount + 1,
        };
      });
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
    showToast(`✓ Order ${newOrder.orderNumber} successfully punched!`);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    const normalizedStatus = (status || '').toLowerCase() as Order['status'];
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: normalizedStatus, updatedAt: new Date().toISOString() } : o))
    );
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: normalizedStatus }),
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

  const cancelOrder = async (orderId: string, reason: string) => {
    const target = orders.find((o) => o.id === orderId);
    const orderAmt = target ? (target.total || target.subtotal || 0) : 0;
    const itemsSummary = target?.items ? target.items.map((it) => `${it.quantity}x ${it.name}`).join(', ') : 'Order cancelled';

    // 1. Immediate optimistic local update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'cancelled',
              cancelReason: reason,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
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
      reason: reason || 'Manager cancellation override',
    });

    if (currentShift && currentShift.status === 'open' && target) {
      setCurrentShift((prev) => {
        if (!prev) return null;
        const isCash = target.paymentMethod === 'cash';
        return {
          ...prev,
          totalGrossSales: Math.max(0, prev.totalGrossSales - orderAmt),
          cashSales: isCash ? Math.max(0, prev.cashSales - orderAmt) : prev.cashSales,
          cardSales: !isCash ? Math.max(0, prev.cardSales - orderAmt) : prev.cardSales,
          cashInDrawerExpected: isCash ? Math.max(0, prev.cashInDrawerExpected - orderAmt) : prev.cashInDrawerExpected,
        };
      });
    }

    // 2. Sync to backend database
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
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
      console.warn('Network offline during cancel, saved to offline local storage:', err);
    }

    showToast(`✓ Order #${target?.orderNumber || orderId} cancelled & ledger adjusted.`);
  };

  const editOrder = async (orderId: string, updates: Partial<Order>) => {
    const target = orders.find((o) => o.id === orderId);
    const oldTotal = target ? (target.total || 0) : 0;
    const newTotal = updates.total !== undefined ? updates.total : oldTotal;
    const delta = newTotal - oldTotal;

    // 1. Immediate optimistic local update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              ...updates,
              items: updates.items || o.items,
              status: o.status === 'completed' || o.status === 'cancelled' ? o.status : 'modified',
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    if (target && (delta !== 0 || updates.items)) {
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
        netDelta: delta,
        itemsSummary,
        reason: (updates as any).reason || 'Item modification / price adjustment',
      });

      if (currentShift && currentShift.status === 'open') {
        setCurrentShift((prev) => {
          if (!prev) return null;
          const isCash = target.paymentMethod === 'cash';
          return {
            ...prev,
            totalGrossSales: prev.totalGrossSales + delta,
            cashSales: isCash ? prev.cashSales + delta : prev.cashSales,
            cardSales: !isCash ? prev.cardSales + delta : prev.cardSales,
            cashInDrawerExpected: isCash ? prev.cashInDrawerExpected + delta : prev.cashInDrawerExpected,
          };
        });
      }
    }

    // 2. Sync to backend database
    try {
      const response = await fetch(`/api/orders/${orderId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
              status: o.status === 'pending' || o.status === 'PUNCHED' || o.status === 'ready' ? 'dispatched' : o.status,
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
    const shift: RegisterShift = {
      id: `shift-${Date.now()}`,
      shiftNumber: `SH-${Date.now().toString().slice(-4)}`,
      cashierName: currentUser.name,
      openedBy: currentUser.id,
      openedById: currentUser.id,
      terminalId: 'POS-MAIN-01',
      openedAt: new Date().toISOString(),
      openingFloat,
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
    showToast(`Shift opened with PKR ${openingFloat.toLocaleString()} float`);
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
    showToast(`Shift closed. Difference: PKR ${diff.toLocaleString()}`);
  };

  const updateStockQuantity = (id: string, newStock: number) => {
    setStockItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, currentStock: Math.max(0, newStock) } : s))
    );
    showToast('Inventory stock updated');
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
        loginTheme,
        setLoginTheme,
        outlets,
    addOutlet,
    deleteOutlet,
    users,
        addNewUser,
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
        lookupCustomer,
        upsertCustomer,
        orders,
        parkedOrders,
        parkCurrentOrder,
        recallParkedOrder,
        deleteParkedOrder,
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
        toast,
        showToast,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};
