import React, { useState } from 'react';
import {
  X,
  Edit3,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Minus,
  CheckCircle,
  Clock,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderItemRecord, UserAccount } from '../../types';
import { ManagerAuthModal } from '../auth/ManagerAuthModal';

interface OrderEditCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const OrderEditCancelModal: React.FC<OrderEditCancelModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const { currentUser, showToast, cancelOrder, editOrder, menuItems } = useRestaurant();
  const [editedItems, setEditedItems] = useState<OrderItemRecord[]>([]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'modify' | 'cancel' | null>(null);
  const [selectedMenuItemToAdd, setSelectedMenuItemToAdd] = useState<string>('');

  const handleAddItem = (menuItemId: string) => {
    if (!menuItemId) return;
    const found = menuItems.find((m) => m.id === menuItemId);
    if (!found) return;

    setEditedItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.menuItemId === menuItemId);
      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: copy[existingIdx].quantity + 1,
        };
        return copy;
      }
      const newItem: OrderItemRecord = {
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

  React.useEffect(() => {
    if (order) {
      setEditedItems(order.items.map((i) => ({ ...i })));
      setEditNotes(order.notes || '');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const isCashier = currentUser.role === 'cashier';
  const isPunched = order.status === 'PUNCHED' || order.status === 'pending' || order.status === 'in_kitchen';

  const updatedSubtotal = editedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const updatedTax = Math.round(updatedSubtotal * 0.16);
  const updatedTotal = updatedSubtotal + updatedTax + (order.deliveryFee || 0) - (order.discount || 0);

  const handleUpdateQty = (idx: number, delta: number) => {
    setEditedItems((prev) => {
      const copy = [...prev];
      const newQty = copy[idx].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== idx);
      }
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };

  const handleTriggerAction = (action: 'modify' | 'cancel') => {
    setPendingAction(action);
    if (isCashier) {
      setIsAuthModalOpen(true);
    } else {
      // Direct manager action
      const defaultReason = action === 'cancel' ? 'Manager void' : 'Manager modification';
      const reasonPrompt = window.prompt(`Please enter audit reason to ${action} order #${order.orderNumber}:`, defaultReason);
      // Even if they leave it empty, fallback to defaultReason so they can still proceed smoothly
      const reason = reasonPrompt?.trim() || defaultReason;
      executeAction(action, currentUser, reason);
    }
  };

  const executeAction = async (action: 'modify' | 'cancel', manager: UserAccount, auditReason: string) => {
    try {
      if (action === 'cancel') {
        await cancelOrder(order.id, auditReason);
      } else {
        await editOrder(order.id, {
          items: editedItems,
          subtotal: updatedSubtotal,
          tax: updatedTax,
          total: updatedTotal,
          notes: editNotes,
          reason: auditReason,
        });
      }
      onClose();
    } catch (err) {
      console.error('Order modification failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                Manage Order #{order.orderNumber}
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[#00897b]/20 text-emerald-400 border border-[#00897b]/30">
                  {order.status}
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Customer: {order.customer?.name || 'Walk-in'} • Created by: {order.cashierName || 'Cashier'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cashier Protection Warning */}
        {isCashier && (
          <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>RBAC Guardrail:</strong> Cashiers cannot modify or cancel punched tickets without Manager PIN authorization.
            </span>
          </div>
        )}

        {/* Order Items List Editor */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 no-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-300">Order Line Items:</label>
              {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMenuItemToAdd}
                    onChange={(e) => handleAddItem(e.target.value)}
                    className="bg-stone-950 border border-stone-800 text-stone-200 text-[11px] px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#00897b] font-medium transition cursor-pointer"
                  >
                    <option value="">+ Add Item from Menu...</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (PKR {m.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {editedItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block truncate">{item.name}</span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    PKR {item.price.toLocaleString()} each
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-stone-900 border border-stone-800 rounded-lg p-0.5">
                    <button
                      onClick={() => handleUpdateQty(idx, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-800 text-stone-300 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(idx, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-800 text-stone-300 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-mono font-bold text-emerald-400 w-20 text-right">
                    PKR {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Special Notes */}
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1">
              Order Instructions & Delivery Notes:
            </label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00897b]"
            />
          </div>

          {/* Financial Summary */}
          <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-1 font-mono text-xs text-stone-400">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="text-white">PKR {updatedSubtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (16%):</span>
              <span className="text-white">PKR {updatedTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-emerald-400 pt-1 border-t border-stone-800">
              <span>Updated Total:</span>
              <span>PKR {updatedTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center justify-between">
          <button
            onClick={() => handleTriggerAction('cancel')}
            className="px-4 py-2 bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Cancel / Void Ticket
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={() => handleTriggerAction('modify')}
              className="px-5 py-2 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Save Modifications
            </button>
          </div>
        </div>

        {/* Manager Auth Modal */}
        <ManagerAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          actionTitle={`Authorize ${pendingAction === 'cancel' ? 'Cancellation' : 'Modification'} of Order #${order.orderNumber}`}
          actionDescription={`Manager or Owner PIN override required to ${pendingAction} this active ticket.`}
          onAuthorized={(mgr, reason) => {
            if (pendingAction) {
              executeAction(pendingAction, mgr, reason);
            }
          }}
        />
      </div>
    </div>
  );
};
