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
  const deliveryFee = orderType === 'delivery' ? 3.5 : 0;
  const tax = subtotal * 0.085;
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
    <div id="edit-order-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Edit className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">Edit Order {order.orderNumber}</h3>
            <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded font-mono">
              Status: {order.status}
            </span>
          </div>
          <button
            id="close-edit-order-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-stone-300">
          {/* Order Type Selector */}
          <div>
            <label className="block font-bold text-stone-400 uppercase tracking-wider mb-1.5">Order Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrderType('dine_in')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition ${
                  orderType === 'dine_in'
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Dine-In</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition ${
                  orderType === 'takeaway'
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Takeaway</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition ${
                  orderType === 'delivery'
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
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
              <label className="block font-bold text-stone-400 mb-1">Table Number</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. Table 4"
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          ) : orderType === 'delivery' ? (
            <div>
              <label className="block font-bold text-stone-400 mb-1">Assigned Delivery Driver</label>
              <select
                value={deliveryDriver}
                onChange={(e) => setDeliveryDriver(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
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
          <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 space-y-3">
            <h4 className="font-bold text-stone-200 uppercase tracking-wider text-[11px]">Customer & Contact Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-stone-400 mb-1">Customer Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 555-0123"
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-400 mb-1">Delivery Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Apt 4B, Gate #12"
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-stone-400 mb-1">Order / Kitchen Notes</label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Extra napkins, sauce on side"
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Itemized Order List & Modification */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-400 uppercase tracking-wider">Ordered Dishes ({items.length})</label>
              {/* Add dish dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedMenuItemToAdd}
                  onChange={(e) => handleAddItem(e.target.value)}
                  className="bg-stone-950 border border-stone-700 text-stone-200 text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-amber-500"
                >
                  <option value="">+ Add Item from Menu...</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-white block">{it.name}</span>
                    <span className="text-stone-400 text-[11px]">${it.price.toFixed(2)} each</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-stone-900 border border-stone-700 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(it.id, -1)}
                        className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-white">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(it.id, 1)}
                        className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="w-16 text-right font-bold text-amber-400">
                      ${(it.price * it.quantity).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 flex items-center justify-center cursor-pointer transition border border-red-900/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recalculated Financial Summary */}
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex items-center justify-between font-mono">
            <div className="space-y-0.5 text-stone-400">
              <p>Subtotal: ${subtotal.toFixed(2)}</p>
              <p>Tax (8.5%): ${tax.toFixed(2)}</p>
              {orderType === 'delivery' && <p>Delivery Fee: $3.50</p>}
            </div>
            <div className="text-right">
              <span className="text-stone-400 text-xs uppercase block font-sans font-bold">New Order Total</span>
              <span className="text-xl font-bold text-amber-400 font-mono">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-end gap-2">
          <button
            id="cancel-edit-order-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            id="save-edit-order-btn"
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-lg shadow-amber-600/30"
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
