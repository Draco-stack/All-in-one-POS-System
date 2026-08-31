export interface MenuItemOption {
  name: string;
  price: number;
  choices?: { name?: string; label?: string; price?: number; extraPrice?: number }[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  inStock?: boolean;
  available?: boolean;
  isPopular?: boolean;
  isSpecial?: boolean;
  dietary?: string[];
  preparationTimeMinutes?: number;
  flavors?: string[];
  extraCheesePrice?: number;
  extraChickenPrice?: number;
  thinCrustPrice?: number;
  options?: MenuItemOption[];
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  itemCount?: number;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  deliveryNotes?: string;
  notes?: string;
  favoriteItems?: string[];
  loyaltyPoints?: number;
  vipTier?: string;
  totalOrdersCount?: number;
  totalSpent?: number;
  createdAt?: string;
}

export interface CartItemModifier {
  name: string;
  price: number;
}

export interface PosCartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  basePrice?: number;
  quantity: number;
  flavor?: string;
  modifiers: CartItemModifier[];
  itemNote?: string;
  isCollapsed?: boolean;
  image?: string;
  extraCheesePrice?: number;
  extraChickenPrice?: number;
  thinCrustPrice?: number;
  selectedOptions?: any[];
}

export type CartItem = PosCartItem;

export interface PosCartCustomer {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  vipTier?: string;
  loyaltyPoints?: number;
}

export interface PosCartState {
  items: PosCartItem[];
  customer: PosCartCustomer;
  orderType: OrderType;
  tableNumber?: string;
  deliveryDriver?: string;
  serverId?: string;
  serverName?: string;
  discountPercent?: number;
  tipAmount?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface OrderItemRecord {
  id: string;
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  flavor?: string;
  modifiers?: CartItemModifier[];
  itemNote?: string;
  image?: string;
  customization?: string;
  selectedOptions?: any[];
}

export type OrderItem = OrderItemRecord;

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'drive_thru';
export type OrderStatus = 'open' | 'pending' | 'in_kitchen' | 'ready' | 'dispatched' | 'delivered' | 'completed' | 'cancelled' | 'refunded' | 'PUNCHED' | 'MODIFIED' | 'punched' | 'modified';
export type PaymentStatus = 'paid' | 'unpaid' | 'partially_paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'online' | 'unpaid';

export interface Order {
  id: string;
  orderNumber?: string;
  receiptNumber?: string;
  terminalId?: string;
  tableNumber?: string;
  type?: OrderType;
  orderType?: OrderType;
  source?: string;
  sourceChannel?: 'Call Center' | 'Online' | 'POS' | 'Mobile App' | 'Website' | string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  items: OrderItemRecord[];
  customer?: Customer;
  deliveryDriver?: string;
  riderName?: string;
  riderPhone?: string;
  riderVehicle?: string;
  deliveryAddress?: string;
  serverId?: string;
  serverName?: string;
  outlet?: string;
  branchName?: string;
  subtotal: number;
  tax: number;
  discount: number;
  tip?: number;
  deliveryFee: number;
  total: number;
  amountTendered?: number;
  tenderedAmount?: number;
  changeGiven?: number;
  cashierName?: string;
  cashierId?: string;
  punchedBy?: string;
  deliveryElapsedMinutes?: number;
  deliveryMinutes?: number;
  createdById?: string;
  createdAt: string;
  updatedAt?: string;
  refundReason?: string;
  cancelReason?: string;
  notes?: string;
  timeline?: {
    status: string;
    timestamp: string;
    note?: string;
    actor?: string;
  }[];
}

export interface ParkedOrder {
  id: string;
  title?: string;
  orderNumber?: string;
  parkedBy?: string;
  cart?: {
    items: PosCartItem[];
    customer?: PosCartCustomer;
    tableNumber?: string;
    orderType?: OrderType;
    paymentMethod?: PaymentMethod;
    notes?: string;
  };
  parkedAt: string;
}

export interface RegisterShift {
  id: string;
  shiftNumber: string;
  terminalId?: string;
  openedBy?: string;
  openedById?: string;
  cashierName?: string;
  cashierId?: string;
  closedBy?: string;
  startingFloat?: number;
  openingFloat?: number;
  totalSales?: number;
  totalGrossSales?: number;
  totalTax?: number;
  totalDiscounts?: number;
  cashSales: number;
  cardSales: number;
  otherSales?: number;
  totalTips: number;
  cashInDrawerExpected: number;
  actualCashInDrawer?: number;
  actualCash?: number;
  startingPettyCash?: number;
  expectedCash?: number;
  shortageOverage?: number;
  cashInDrawerActual?: number;
  cashDifference?: number;
  denominationBreakdown?: Record<string, number>;
  transactionsCount: number;
  status: 'open' | 'closed';
  notes?: string;
  openedAt: string;
  closedAt?: string;
}

export interface DenominationCounts {
  5000: number;
  1000: number;
  500: number;
  100: number;
  50: number;
  20: number;
  10: number;
}

export interface ShiftAuditRecord {
  id: string;
  shiftId: string;
  userId?: string;
  cashierName: string;
  startTime: string;
  endTime: string;
  startingPettyCash: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  expectedCash: number;
  actualCash: number;
  shortageOverage: number;
  floatRetained?: number;
  lockerDeposit?: number;
  denominationBreakdown: DenominationCounts;
  notes?: string;
  status: 'closed';
  createdAt: string;
}

export interface OrderAuditLogRecord {
  id: string;
  orderId: string;
  action: 'PUNCHED' | 'MODIFIED' | 'CANCELLED' | 'REPRINTED' | 'REFUNDED';
  reason?: string;
  performedById?: string;
  managerName: string;
  previousData?: string;
  newData?: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'manager' | 'cashier' | 'kitchen' | 'owner' | 'rider' | 'server';

export interface UserAccount {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  username?: string;
  email?: string;
  password?: string;
  avatar?: string;
  outlet?: string;
  active?: boolean;
  phone?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface InventoryStockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minThreshold?: number;
  minimumThreshold?: number;
  costPerUnit: number;
  lastRestocked?: string;
}

export interface SalesAdjustmentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  type: 'CANCELLATION' | 'MODIFICATION';
  authorizerName: string;
  authorizerRole: string;
  originalAmount: number;
  newAmount: number;
  netDelta: number;
  itemsSummary: string;
  reason: string;
  timestamp: string;
}

export interface RiderStats {
  totalAssigned: number;
  delivered: number;
  cancelled: number;
  active: number;
  inTransit: number;
  totalRevenue: number;
}

