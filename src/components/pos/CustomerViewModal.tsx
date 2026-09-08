import React from 'react';
import { X, User, Phone, MapPin, Award, ShoppingBag, Clock, PlusCircle, Edit3 } from 'lucide-react';
import { Customer, Order } from '../../types';

interface CustomerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  pastOrders: Order[];
  onReorderItem?: (item: any) => void;
  onEditCustomer?: () => void;
}

export const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
  isOpen,
  onClose,
  customer,
  pastOrders,
  onReorderItem,
  onEditCustomer,
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/60 dark:bg-stone-950/60 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-md border border-emerald-400/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{customer.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-gradient-to-r ${badgeClass}`}>
                  ⭐ {customer.vipTier} Member
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-mono flex items-center gap-2 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                {customer.phone}
                {customer.email && <span>• {customer.email}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEditCustomer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditCustomer();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Info</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/5 text-slate-500 dark:text-stone-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-stone-200">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-950/90 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Avg. Ticket
              </span>
              <p className="text-xl font-black text-blue-300 font-mono mt-1">
                PKR {customer.totalOrdersCount > 0 ? Math.round(customer.totalSpent / customer.totalOrdersCount).toLocaleString() : '0'}
              </p>
            </div>

            <div className="bg-stone-950/90 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Total Visits
              </span>
              <p className="text-xl font-black text-emerald-300 font-mono mt-1">
                {customer.totalOrdersCount}{' '}
                <span className="text-[10px] font-normal text-slate-500 dark:text-stone-400">orders</span>
              </p>
            </div>

            <div className="bg-stone-950/90 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 flex items-center gap-1">
                💳 Lifetime Spend
              </span>
              <p className="text-xl font-black text-white font-mono mt-1">
                PKR {customer.totalSpent.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Delivery Address & Notes */}
          <div className="bg-white/60 dark:bg-stone-950/60 p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2.5 shadow-inner">
            <div className="flex items-start gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block mb-0.5">Saved Address:</span>
                <span className="text-stone-200 font-medium">{customer.address || 'Walk-in / Counter'}</span>
              </div>
            </div>
            {customer.deliveryNotes && (
              <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/20 p-3 rounded-xl shadow-inner">
                <strong className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block mb-1">Preferences / Delivery Notes:</strong> {customer.deliveryNotes}
              </div>
            )}
          </div>

          {/* Past Orders & 1-Click Reorder */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Order History & Favorite Items ({pastOrders.length})
            </h4>

            {pastOrders.length === 0 ? (
              <div className="text-center py-8 bg-white/40 dark:bg-stone-950/40 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 text-slate-400 dark:text-stone-500 text-xs">
                No past transactions recorded yet for this customer.
              </div>
            ) : (
              <div className="space-y-3">
                {pastOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3.5 bg-stone-950/80 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col gap-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">{order.orderNumber}</span>
                      <span className="text-slate-500 dark:text-stone-400 font-semibold">
                        {new Date(order.createdAt).toLocaleDateString()} • PKR {order.total.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-stone-300"
                        >
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          {onReorderItem && (
                            <button
                              onClick={() => onReorderItem(item)}
                              className="text-emerald-400 hover:text-emerald-300 ml-1 p-0.5 hover:bg-emerald-950/50 rounded-lg transition cursor-pointer"
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
        <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white/60 dark:bg-stone-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 text-stone-200 border border-slate-200 dark:border-white/5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
