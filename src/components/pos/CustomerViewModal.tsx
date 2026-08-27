import React from 'react';
import { X, User, Phone, MapPin, Award, ShoppingBag, Clock, PlusCircle } from 'lucide-react';
import { Customer, Order } from '../../types';

interface CustomerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  pastOrders: Order[];
  onReorderItem?: (item: any) => void;
}

export const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
  isOpen,
  onClose,
  customer,
  pastOrders,
  onReorderItem,
}) => {
  if (!isOpen || !customer) return null;

  const vipColors: Record<string, string> = {
    Platinum: 'from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/40',
    Gold: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40',
    Silver: 'from-slate-400/20 to-zinc-400/20 text-slate-300 border-slate-400/40',
    Regular: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/40',
  };

  const badgeClass = vipColors[customer.vipTier] || vipColors.Regular;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00897b] to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{customer.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border bg-gradient-to-r ${badgeClass}`}>
                  ⭐ {customer.vipTier} Member
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono flex items-center gap-2 mt-0.5">
                <Phone className="w-3 h-3 text-[#00897b]" />
                {customer.phone}
                {customer.email && <span>• {customer.email}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-stone-200">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800">
              <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
                <Award className="w-3.5 h-3.5 text-amber-400" /> Loyalty Points
              </span>
              <p className="text-xl font-bold text-amber-300 font-mono mt-1">
                {customer.loyaltyPoints} <span className="text-xs font-normal text-stone-400">pts</span>
              </p>
            </div>

            <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800">
              <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Total Visits
              </span>
              <p className="text-xl font-bold text-emerald-300 font-mono mt-1">
                {customer.totalOrdersCount}{' '}
                <span className="text-xs font-normal text-stone-400">orders</span>
              </p>
            </div>

            <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800">
              <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
                💳 Lifetime Spend
              </span>
              <p className="text-xl font-bold text-white font-mono mt-1">
                PKR {customer.totalSpent.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Delivery Address & Notes */}
          <div className="bg-stone-950/50 p-4 rounded-xl border border-stone-800 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-300">Saved Address: </span>
                <span className="text-stone-400">{customer.address || 'Walk-in / Counter'}</span>
              </div>
            </div>
            {customer.deliveryNotes && (
              <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/20 p-2.5 rounded-lg">
                <strong>Preferences / Delivery Notes:</strong> {customer.deliveryNotes}
              </div>
            )}
          </div>

          {/* Past Orders & 1-Click Reorder */}
          <div>
            <h4 className="text-sm font-bold text-stone-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00897b]" />
              Order History & Favorite Items ({pastOrders.length})
            </h4>

            {pastOrders.length === 0 ? (
              <div className="text-center py-8 bg-stone-950/40 rounded-xl border border-dashed border-stone-800 text-stone-500 text-sm">
                No past transactions recorded yet for this customer.
              </div>
            ) : (
              <div className="space-y-3">
                {pastOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3.5 bg-stone-950/80 rounded-xl border border-stone-800 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">{order.orderNumber}</span>
                      <span className="text-stone-400">
                        {new Date(order.createdAt).toLocaleDateString()} • PKR {order.total.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-700/70 text-xs text-stone-300"
                        >
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          {onReorderItem && (
                            <button
                              onClick={() => onReorderItem(item)}
                              className="text-emerald-400 hover:text-emerald-300 ml-1 p-0.5 hover:bg-emerald-950/50 rounded transition cursor-pointer"
                              title="Add to Current POS Cart"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-semibold text-sm transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
