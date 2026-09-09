import { z } from 'zod';

// Customer Schemas
export const CustomerLookupSchema = z.object({
  phone: z
    .string()
    .min(3, 'Phone number must be at least 3 digits')
    .max(25, 'Phone number too long')
    .transform((val) => val.trim()),
});

export const CustomerUpsertSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).default('Walk-in Customer'),
  phoneNumber: z
    .string()
    .min(3, 'Phone number must be at least 3 digits')
    .max(25)
    .transform((val) => val.trim()),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().max(255).optional().default(''),
  deliveryNotes: z.string().max(500).optional().default(''),
  vipTier: z.enum(['Regular', 'Silver', 'Gold', 'Platinum']).optional().default('Regular'),
  loyaltyPoints: z.number().int().min(0).optional().default(0),
});

// Order Schemas
export const SplitPaymentEntrySchema = z.object({
  id: z.string().optional(),
  method: z.string().default('cash'),
  amount: z.number().nonnegative(),
  reference: z.string().optional(),
}).passthrough();

export const OrderItemSchema = z.object({
  id: z.string().optional(),
  menuItemId: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  price: z.number().nonnegative('Price must be positive'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  flavor: z.string().optional(),
  modifiers: z.any().optional(),
  customization: z.string().optional(),
  itemNote: z.string().optional(),
  image: z.string().optional(),
}).passthrough();

export const OrderPunchSchema = z.object({
  orderType: z.string().default('takeaway'),
  tableNumber: z.string().optional().default(''),
  deliveryDriver: z.string().optional().default(''),
  paymentMethod: z.string().default('cash'),
  amountTendered: z.number().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  tipAmount: z.number().min(0).optional().default(0),
  notes: z.string().max(500).optional().default(''),
  customer: z
    .object({
      id: z.string().optional(),
      name: z.string().optional().default('Walk-in Customer'),
      phone: z.string().optional().default(''),
      address: z.string().optional().default(''),
      notes: z.string().optional().default(''),
      vipTier: z.string().optional(),
      loyaltyPoints: z.number().optional(),
    })
    .passthrough()
    .optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must contain at least 1 item').max(100, 'Order cannot contain more than 100 items'),
  splitPayments: z.array(SplitPaymentEntrySchema).or(z.string()).optional(),
}).passthrough();

// Shift Schemas
export const ShiftOpenSchema = z.object({
  cashierName: z.string().min(1, 'Cashier name required'),
  openingFloat: z.number().nonnegative('Opening float cannot be negative'),
  terminalId: z.string().optional().default('POS-TERM-01'),
}).passthrough();

export const ShiftCloseSchema = z.object({
  shiftId: z.string().min(1, 'Shift ID required'),
  actualCash: z.number().nonnegative('Actual cash count required'),
  floatRetained: z.number().optional().default(0),
  denominationBreakdown: z.any().optional(),
  notes: z.string().max(500).optional().default(''),
}).passthrough();

// Staff Authentication & Management
export const StaffPinAuthSchema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 digits'),
}).passthrough();

export const StaffCreateSchema = z.object({
  name: z.string().min(2, 'Name is required').max(60),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  pin: z.string().min(4, 'PIN must be at least 4 digits'),
  role: z.string().default('cashier'),
  outlet: z.string().default('Main Branch'),
}).passthrough();
