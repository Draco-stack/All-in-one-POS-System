import React, { useState } from 'react';
import {
  X,
  Phone,
  User,
  MapPin,
  Plus,
  Minus,
  Trash2,
  Check,
  Search,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, MenuItem } from '../../types';
import { playCashRegisterSound } from '../../utils/audio';

interface CallCenterOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: Order) => void;
}

export const CallCenterOrderModal: React.FC<CallCenterOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { menuItems, currentUser, showToast, outlets } = useRestaurant();
  
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('Sargodha');
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number; flavor?: string }[]>([]);
  const [itemSearch, setItemSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const branches = ['Sargodha', 'Jinnah Colony', 'Eden Garden', 'Gujrat', 'Gojra', 'Gulberg Branch'];

  const filteredMenuItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.category.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const addItemToCart = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.item.id === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [...prev, { item, quantity: 1, flavor: item.flavors?.[0] }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((p) => (p.item.id === itemId ? { ...p, quantity: p.quantity + delta } : p))
        .filter((p) => p.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, p) => sum + p.item.price * p.quantity, 0);
  const deliveryFee = cart.length > 0 ? 100 : 0;
  const total = subtotal + deliveryFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      showToast('⚠️ Please enter customer contact phone number');
      return;
    }
    if (!customerName.trim()) {
      showToast('⚠️ Please enter customer name');
      return;
    }
    if (!customerAddress.trim()) {
      showToast('⚠️ Please enter customer delivery address');
      return;
    }
    if (cart.length === 0) {
      showToast('⚠️ Please add at least 1 item to the order');
      return;
    }

    setIsSubmitting(true);
    
    // Generate order ID following screenshot format
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `WY${Math.floor(100 + Math.random() * 899)}V${Math.floor(500 + Math.random() * 499)}${randomSuffix}`;

    const now = new Date();
    const timeFormatted = `${now.getHours() < 10 ? '0' + now.getHours() : now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`;

    const newOrder: Order = {
      id: `del-cc-${Date.now()}`,
      orderNumber,
      type: 'delivery',
      orderType: 'delivery',
      source: 'Call Center',
      sourceChannel: 'Call Center',
      status: 'in_kitchen',
      paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
      paymentMethod,
      deliveryElapsedMinutes: 1,
      deliveryMinutes: 1,
      branchName: selectedBranch,
      outlet: `${selectedBranch} Branch`,
      subtotal,
      tax: 0,
      discount: 0,
      deliveryFee,
      total,
      cashierName: currentUser.name || 'Call Center Agent',
      punchedBy: currentUser.name || 'Call Center Agent',
      deliveryDriver: 'Carlos Rodriguez',
      riderName: 'Carlos Rodriguez',
      riderPhone: '0315-9988771',
      riderVehicle: 'Honda 125 (LEA-4891)',
      deliveryAddress: customerAddress,
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        deliveryNotes,
      },
      items: cart.map((p) => ({
        id: `item-${Date.now()}-${p.item.id}`,
        name: p.item.name,
        price: p.item.price,
        quantity: p.quantity,
        flavor: p.flavor,
      })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      timeline: [
        { status: 'Punched', timestamp: `2026-08-28 ${timeFormatted}`, actor: currentUser.name },
        { status: 'In Kitchen', timestamp: `2026-08-28 ${timeFormatted}`, actor: 'Kitchen Display' },
      ],
    };

    playCashRegisterSound();
    if (onOrderCreated) {
      onOrderCreated(newOrder);
    }
    showToast(`✓ Call Center Order #${orderNumber} punched & dispatched to kitchen!`);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
      <div className="bg-[#1b1c2e] border border-stone-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#141524] border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Call Center Delivery Punch
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-mono font-bold">
                  LIVE DISPATCH
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Logged in as <span className="text-white font-bold">{currentUser.name}</span> • Quick Order Creation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer Details Column */}
            <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                1. Customer & Delivery Address
              </h3>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Customer Contact Phone *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 03150679738"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-[#161726] border border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr Shoaib / Mr Ashir"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#161726] border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Target Branch *
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full bg-[#161726] border border-stone-700 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b} Branch
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Complete Delivery Address *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-red-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. House 44, Street 9, Satellite Town"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-[#161726] border border-stone-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Landmark / Rider Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ring bell twice, deliver to 2nd floor"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full bg-[#161726] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-300 placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Payment Method
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161726] text-stone-400 border border-stone-700'
                    }`}
                  >
                    💵 Cash on Delivery (COD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      paymentMethod === 'online'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#161726] text-stone-400 border border-stone-700'
                    }`}
                  >
                    💳 Paid Online
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items & Cart Column */}
            <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center justify-between mb-3">
                  <span>2. Add Menu Items</span>
                  <span className="text-[11px] text-stone-400 font-normal">
                    {cart.length} item(s) selected
                  </span>
                </h3>

                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search menu items or categories..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full bg-[#161726] border border-stone-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Add Pills */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 mb-4 custom-scrollbar">
                  {filteredMenuItems.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => addItemToCart(item)}
                      className="p-2 rounded-lg bg-[#161726] hover:bg-[#202238] border border-stone-800 flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-stone-400 capitalize">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          PKR {item.price}
                        </span>
                        <span className="p-1 rounded bg-stone-800 text-stone-300 hover:text-white">
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Active Cart */}
                <div className="border-t border-stone-800 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                    Active Order Items:
                  </p>
                  {cart.length === 0 ? (
                    <p className="text-xs text-stone-500 italic text-center py-3 bg-[#161726] rounded-lg">
                      No items added yet. Click items above to add.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                      {cart.map((p) => (
                        <div
                          key={p.item.id}
                          className="p-2 bg-[#161726] rounded-lg border border-stone-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-bold text-white truncate">{p.item.name}</p>
                            <span className="text-[10px] text-stone-400 font-mono">
                              PKR {p.item.price} each
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQty(p.item.id, -1)}
                              className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-white w-4 text-center">
                              {p.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(p.item.id, 1)}
                              className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-emerald-400 w-16 text-right">
                              PKR {p.item.price * p.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-[#161726] p-3 rounded-xl border border-stone-800 space-y-1 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-stone-200">PKR {subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Delivery Dispatch:</span>
                  <span className="font-mono font-bold text-stone-200">PKR {deliveryFee}</span>
                </div>
                <div className="flex justify-between font-black text-white text-sm border-t border-stone-800 pt-1.5 mt-1">
                  <span>Total (PKR):</span>
                  <span className="font-mono text-emerald-400 text-base">PKR {total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 border-t border-stone-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || cart.length === 0}
              className="px-6 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-50 text-white text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-lg"
            >
              <Truck className="w-4 h-4" />
              Punch & Broadcast Delivery Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
