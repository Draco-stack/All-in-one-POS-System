import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order } from '../../types';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Search,
  Receipt,
} from 'lucide-react';

export const ActiveTicketsView: React.FC = () => {
  const { orders, updateOrderStatus, setActiveReceiptOrder } = useRestaurant();
  const [filterType, setFilterType] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [searchTicket, setSearchTicket] = useState('');

  // Active tickets only (not completed or refunded or cancelled)
  const activeOrders = orders.filter((o) => {
    const st = (o.status || '').toLowerCase();
    return st !== 'completed' && st !== 'delivered' && st !== 'refunded' && st !== 'cancelled';
  });

  const filteredOrders = activeOrders.filter((o) => {
    const matchType = filterType === 'all' || o.type === filterType;
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchTicket.toLowerCase()) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(searchTicket.toLowerCase())) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(searchTicket.toLowerCase()));
    return matchType && matchSearch;
  });

  const getElapsedTimeMinutes = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, diff);
  };

  const handleAdvanceStatus = async (order: Order) => {
    if ((order.status as string) === 'open' || (order.status as string) === 'punched_kitchen' || order.status === 'pending' || order.status === 'in_kitchen') {
      await updateOrderStatus(order.id, 'ready');
    } else if (order.status === 'ready') {
      await updateOrderStatus(order.id, 'completed');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="p-4 bg-stone-900 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00897b]/10 border border-[#00897b]/30 flex items-center justify-center text-[#00897b]">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Active Kitchen & Table Tickets</span>
              <span className="px-2 py-0.5 rounded-full bg-[#00897b]/20 text-teal-300 text-xs font-mono font-bold">
                {activeOrders.length} active
              </span>
            </h2>
            <p className="text-xs text-stone-400">Live tracker for kitchen food prep, dispatch chits, and table status</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search table or ticket #"
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
            {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  filterType === t ? 'bg-[#00897b] text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets Cards Grid */}
      <div className="flex-1 p-5 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-500 py-16">
            <CheckCircle2 className="w-12 h-12 opacity-30 text-emerald-500 mb-2" />
            <p className="text-base font-bold text-stone-300">All caught up! No active tickets</p>
            <p className="text-xs text-stone-400 mt-1">New orders punched on the POS register will appear here immediately</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const elapsed = getElapsedTimeMinutes(order.createdAt);
              const isUrgent = elapsed > 15;
              const isReady = order.status === 'ready';

              return (
                <div
                  key={order.id}
                  className={`bg-stone-900 border rounded-2xl p-4 flex flex-col justify-between shadow-lg transition ${
                    isReady
                      ? 'border-emerald-500/60 shadow-emerald-950/30'
                      : isUrgent
                      ? 'border-rose-500/60 shadow-rose-950/30'
                      : 'border-stone-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2 border-b border-stone-800 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-teal-400 font-mono">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${
                          isUrgent
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {elapsed} min ago
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase text-[10px]">
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.tableNumber && <span>{order.tableNumber}</span>}
                      </div>

                      <span className="text-stone-400 text-[11px] truncate max-w-[130px]">
                        {order.customer?.name || 'Walk-in'}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 space-y-2 flex-1 overflow-y-auto max-h-52">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5 text-xs">
                        <div className="flex items-start justify-between font-semibold text-stone-200">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-stone-800 text-teal-400 font-mono font-bold flex items-center justify-center text-xs">
                              {item.quantity}
                            </span>
                            <span className="truncate max-w-[180px]">{item.name}</span>
                          </div>
                        </div>

                        {item.customization && (
                          <p className="text-[10px] text-teal-400/90 italic pl-7">↳ {item.customization}</p>
                        )}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[10px] text-stone-400 pl-7">
                            {item.selectedOptions.map((opt, i) => (
                              <span key={i} className="mr-2">
                                + {opt.choice}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveReceiptOrder(order)}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                      title="View / Print Receipt"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow ${
                        isReady
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                          : 'bg-[#00897b] hover:bg-[#00796b] text-white shadow-teal-900/30'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isReady ? 'Mark Completed' : 'Mark Food Ready'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
