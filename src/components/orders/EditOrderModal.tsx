import React, { useState } from 'react';
import { Order, OrderItem, OrderType, UserAccount } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Save, Plus, Minus, Trash2, Edit, Truck, Utensils, ShoppingBag, ShieldAlert } from 'lucide-react';
import { ManagerOverrideModal } from '../auth/ManagerOverrideModal';

interface EditOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, onClose, onSaved }) => {
  const { menuItems, deliveryDrivers, getRiderStats, editOrder, currentUser, showToast } = useRestaurant();

  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const [deliveryDriver, setDeliveryDriver] = useState<string>('Carlos Rodriguez');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedMenuItemToAdd, setSelectedMenuItemToAdd] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState<boolean>(false);

  React.useEffect(() => {
    if (order) {
      setOrderType(order.type || order.orderType || 'dine_in');
      setTableNumber(order.tableNumber || 'Table 1');
      setDeliveryDriver(order.deliveryDriver || deliveryDrivers[0] || 'Carlos Rodriguez');
      setCustomerName(order.customer?.name || '');
      setCustomerPhone(order.customer?.phone || '');
      setCustomerAddress(order.customer?.address || '');
      setOrderNotes(order.notes || (order.customer as any)?.notes || '');
      setItems([...order.items]);
    }
  }, [order, deliveryDrivers]);

  if (!order) return null;

  // Recalculate financial breakdown
  const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const deliveryFee = orderType === 'delivery' ? 150 : 0;
  const tax = Math.round(subtotal * 0.16);
  const tip = order.tip || 0;
  const total = subtotal + tax + tip + deliveryFee;

  const handleUpdateQty = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as OrderItem[]
      );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleAddItem = (menuItemId: string) => {
    if (!menuItemId) return;
    const found = menuItems.find((m) => m.id === menuItemId);
    if (!found) return;

    setItems((prev) => {
      const existing = prev.find((it) => it.menuItemId === menuItemId);
      if (existing) {
        return prev.map((it) => (it.menuItemId === menuItemId ? { ...it, quantity: it.quantity + 1 } : it));
      }
      const newItem: OrderItem = {
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuItemId: found.id,
        name: found.name,
        price: found.price,
        quantity: 1,
        image: found.image,
      };
      return [...prev, newItem];
    });
    setSelectedMenuItemToAdd('');
  };

  const executeSave = async (authorizedBy?: string, reason?: string) => {
    setIsSaving(true);
    try {
      await editOrder(order.id, {
        type: orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
        deliveryDriver: orderType === 'delivery' ? deliveryDriver : undefined,
        customer: {
          ...order.customer,
          name: customerName || 'Guest',
          phone: customerPhone,
          address: customerAddress,
          notes: orderNotes,
        },
        notes: reason ? `${orderNotes ? orderNotes + ' | ' : ''}[MODIFIED by ${authorizedBy}: ${reason}]` : orderNotes,
        items,
        subtotal,
        tax,
        deliveryFee,
        total,
      });
      showToast(`✓ Order ${order.orderNumber} successfully modified`);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      showToast(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (items.length === 0) {
      showToast('Order must contain at least one item');
      return;
    }

    const isCashier = currentUser?.role?.toLowerCase() === 'cashier';
    const isPunched = order.status === 'PUNCHED' || order.status === 'open' || order.status === 'in_kitchen';

    if (isCashier && isPunched) {
      // Prompt Manager Override
      setIsManagerModalOpen(true);
    } else {
      executeSave(currentUser?.name, 'Direct Manager Edit');
    }
  };

  return (
    <div id="edit-order-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-400">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Edit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Edit Order {order.orderNumber}</h3>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                Status: {order.status}
              </span>
            </div>
          </div>
          <button
            id="close-edit-order-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-stone-300">
          {/* Order Type Selector */}
          <div>
            <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-400 mb-2">Order Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrderType('dine_in')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  orderType === 'dine_in'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400/30 text-white shadow-md'
                    : 'bg-stone-950/80 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Dine-In</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  orderType === 'takeaway'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400/30 text-white shadow-md'
                    : 'bg-stone-950/80 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Takeaway</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  orderType === 'delivery'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400/30 text-white shadow-md'
                    : 'bg-stone-950/80 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Delivery</span>
              </button>
            </div>
          </div>

          {/* Conditional Table or Delivery Driver */}
          {orderType === 'dine_in' ? (
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Table Number</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. Table 4"
                className="w-full bg-stone-900 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          ) : orderType === 'delivery' ? (
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Assigned Delivery Driver</label>
              <select
                value={deliveryDriver}
                onChange={(e) => setDeliveryDriver(e.target.value)}
                className="w-full bg-stone-900 border border-white/10 rounded-xl px-3.5 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {deliveryDrivers.map((d) => {
                  const stats = getRiderStats(d);
                  return (
                    <option key={d} value={d}>
                      {d} {stats.totalAssigned > 0 ? `(${stats.totalAssigned} orders • ✓${stats.delivered} | ✗${stats.cancelled})` : '(0 orders)'}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          {/* Customer & Address Information */}
          <div className="bg-stone-950/80 p-4 rounded-xl border border-white/5 space-y-3">
            <h4 className="font-bold text-stone-200 uppercase tracking-wider text-[10px]">Customer & Contact Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-stone-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Customer Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="w-full bg-stone-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Delivery Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Apt 4B, Gate #12"
                className="w-full bg-stone-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Order / Kitchen Notes</label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Extra napkins, sauce on side"
                className="w-full bg-stone-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Itemized Order List & Modification */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-300 uppercase tracking-wider text-[10px]">Ordered Dishes ({items.length})</label>
              {/* Add dish dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedMenuItemToAdd}
                  onChange={(e) => handleAddItem(e.target.value)}
                  className="bg-stone-900 border border-white/10 text-stone-200 text-xs px-3 py-1 rounded-xl focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  <option value="">+ Add Item from Menu...</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (PKR {m.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-3 bg-stone-950/80 rounded-xl border border-white/5"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-white block">{it.name}</span>
                    <span className="text-stone-400 text-[10px] font-mono">PKR {it.price.toLocaleString()} each</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-stone-900 border border-white/10 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(it.id, -1)}
                        className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-white">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(it.id, 1)}
                        className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="w-20 text-right font-mono font-bold text-amber-400">
                      PKR {(it.price * it.quantity).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="w-7 h-7 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 flex items-center justify-center cursor-pointer transition-all border border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recalculated Financial Summary */}
          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-white/5 flex items-center justify-between font-mono">
            <div className="space-y-0.5 text-stone-400 text-xs">
              <p>Subtotal: PKR {subtotal.toLocaleString()}</p>
              <p>Tax (16%): PKR {tax.toLocaleString()}</p>
              {orderType === 'delivery' && <p>Delivery Fee: PKR 150</p>}
            </div>
            <div className="text-right">
              <span className="text-stone-400 text-[10px] uppercase block font-sans font-bold">New Order Total</span>
              <span className="text-xl font-black text-amber-400 font-mono">PKR {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-950/60 border-t border-white/5 flex items-center justify-end gap-2.5">
          <button
            id="cancel-edit-order-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-bold border border-white/5 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            id="save-edit-order-btn"
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-lg border border-amber-400/20 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Order Changes'}</span>
          </button>
        </div>
      </div>

      {/* Manager Override Modal for Cashier Security */}
      <ManagerOverrideModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title={`Manager Authorization Required - Edit Order ${order.orderNumber}`}
        actionDescription="Punched orders cannot be modified without an authorizing Manager/Owner PIN and logged reason."
        onAuthorized={(manager, reason) => {
          executeSave(manager.name, reason);
        }}
      />
    </div>
  );
};
