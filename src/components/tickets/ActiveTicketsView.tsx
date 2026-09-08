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

  // Active tickets only (not completed or refunded or cancelled or dispatched)
  const activeOrders = orders.filter((o) => {
    const st = (o.status || '').toLowerCase();
    return st !== 'completed' && st !== 'delivered' && st !== 'refunded' && st !== 'cancelled' && st !== 'dispatched';
  });

  const filteredOrders = activeOrders.filter((o) => {
    const matchType = filterType === 'all' || o.type === filterType;
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchTicket.toLowerCase()) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(searchTicket.toLowerCase())) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(searchTicket.toLowerCase()));
    return matchType && matchSearch;
  });

  const [visibleCount, setVisibleCount] = useState(10);
  const displayedOrders = filteredOrders.slice(0, visibleCount);

  const getElapsedTimeMinutes = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, diff);
  };

  const handleAdvanceStatus = async (order: Order) => {
    if ((order.status as string) === 'open' || (order.status as string) === 'punched_kitchen' || order.status === 'pending' || order.status === 'in_kitchen') {
      await updateOrderStatus(order.id, 'ready');
    } else if (order.status === 'ready') {
      await updateOrderStatus(order.id, 'dispatched');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="p-4 bg-white dark:bg-stone-900 border-b border-slate-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
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
            <p className="text-xs text-slate-500 dark:text-stone-400">Live tracker for kitchen food prep, dispatch chits, and table status</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 dark:text-stone-400" />
            <input
              type="text"
              placeholder="Search table or ticket #"
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          <div className="flex items-center bg-white dark:bg-stone-950 p-1 rounded-xl border border-slate-200 dark:border-stone-800">
            {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  filterType === t ? 'bg-[#00897b] text-white shadow' : 'text-slate-500 dark:text-stone-400 hover:text-stone-200'
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
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-stone-500 py-16">
            <CheckCircle2 className="w-12 h-12 opacity-30 text-emerald-500 mb-2" />
            <p className="text-base font-bold text-slate-700 dark:text-stone-300">All caught up! No active tickets</p>
            <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">New orders punched on the POS register will appear here immediately</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedOrders.map((order) => {
              const elapsed = getElapsedTimeMinutes(order.createdAt);
              const isUrgent = elapsed > 15;
              const isWarming = elapsed >= 8 && elapsed <= 15;
              const ordSt = (order.status || '').toLowerCase();
              const isCancelled = ordSt === 'cancelled' || ordSt === 'refunded' || ordSt === 'void';
              const isDelivered = ordSt === 'delivered' || ordSt === 'completed' || ordSt === 'ready';
              const isOnTheWay = ordSt === 'dispatched' || ordSt === 'on_the_way';
              const isReady = ordSt === 'ready';

              return (
                <div
                  key={order.id}
                  className={`relative overflow-hidden border-2 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 ${
                    isCancelled
                      ? 'bg-gradient-to-b from-[#261016] via-[#170e12] to-[#0c0709] border-rose-500/95 shadow-[0_0_24px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/40'
                      : isDelivered
                      ? 'bg-gradient-to-b from-[#0e1d15] via-[#111617] to-[#0b0e12] border-emerald-400/95 shadow-[0_0_24px_rgba(52,211,153,0.32)] ring-1 ring-emerald-400/40'
                      : isOnTheWay
                      ? 'bg-gradient-to-b from-[#24170a] via-[#17120d] to-[#0d0a06] border-amber-400/95 shadow-[0_0_24px_rgba(245,158,11,0.32)] ring-1 ring-orange-400/40'
                      : isUrgent
                      ? 'bg-gradient-to-b from-[#211116] via-[#161017] to-[#0f0c12] border-rose-500/90 shadow-[0_0_26px_rgba(244,63,94,0.32)] ring-1 ring-rose-500/40'
                      : isWarming
                      ? 'bg-gradient-to-b from-[#20180d] via-[#171410] to-[#0e0e12] border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30'
                      : 'bg-white dark:bg-stone-900/95 border-slate-200 dark:border-white/15 dark:shadow-[0_0_15px_rgba(255,255,255,0.03)]'
                  }`}
                >
                  {/* Top Glowing Ambient Bar reflecting status light */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isCancelled
                        ? 'bg-gradient-to-r from-red-600 via-rose-300 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.95)]'
                        : isDelivered
                        ? 'bg-gradient-to-r from-emerald-500 via-green-300 to-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.95)]'
                        : isOnTheWay
                        ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.95)]'
                        : isUrgent
                        ? 'bg-gradient-to-r from-rose-500 via-rose-300 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                        : isWarming
                        ? 'bg-gradient-to-r from-amber-500 via-amber-200 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]'
                        : 'bg-gradient-to-r from-teal-500 via-emerald-300 to-teal-500 opacity-60'
                    }`}
                  />

                  {/* Card Header */}
                  <div className="space-y-2 border-b border-slate-200 dark:border-white/10 pb-3 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-teal-400 dark:text-teal-300 font-mono tracking-tight drop-shadow-xs">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-black flex items-center gap-1.5 border shadow-xs ${
                          isUrgent
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                            : isWarming
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : isReady
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {elapsed}m ago
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase text-[10px] font-black tracking-wider">
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.tableNumber && (
                          <span className="text-stone-200 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[11px]">
                            {order.tableNumber}
                          </span>
                        )}
                      </div>

                      <span className="text-slate-600 dark:text-stone-300 text-xs font-semibold truncate max-w-[140px]">
                        {order.customer?.name || 'Walk-in'}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 space-y-2 flex-1 overflow-y-auto max-h-52">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-[#08090d]/90 border border-slate-200 dark:border-white/10 space-y-1 text-xs">
                        <div className="flex items-start justify-between font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-teal-500/25 border border-teal-400/50 text-teal-300 font-mono font-black flex items-center justify-center text-xs shadow-xs">
                              {item.quantity}x
                            </span>
                            <span className="truncate max-w-[180px] leading-snug">{item.name}</span>
                          </div>
                        </div>

                        {item.customization && (
                          <p className="text-[11px] text-teal-300 font-medium italic pl-7">↳ {item.customization}</p>
                        )}
                        {item.flavor && (
                          <p className="text-[11px] text-amber-300 font-semibold pl-7">✦ {item.flavor}</p>
                        )}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[10px] text-slate-500 dark:text-stone-400 pl-7">
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
                  <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveReceiptOrder(order)}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-white/10 transition cursor-pointer active:scale-95 shadow-xs"
                      title="View / Print Receipt"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 border ${
                        isReady
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                          : 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400/30 shadow-[0_0_15px_rgba(20,184,166,0.35)]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isReady ? 'Dispatch Order' : 'Mark Food Ready'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredOrders.length > 10 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-slate-200 dark:border-stone-800 shadow-md mt-4">
            <div className="text-xs text-slate-500 dark:text-stone-400 font-mono flex items-center gap-2">
              <span>Showing <strong className="text-white">{displayedOrders.length}</strong> of <strong className="text-white">{filteredOrders.length}</strong> tickets</span>
              {filteredOrders.length > visibleCount && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 text-[10px] font-bold border border-teal-500/20">
                  {filteredOrders.length - visibleCount} remaining
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {filteredOrders.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="px-5 py-2.5 bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Load More Tickets (+10)</span>
                  <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">
                    +{Math.min(10, filteredOrders.length - visibleCount)}
                  </span>
                </button>
              )}

              {visibleCount > 10 && (
                <button
                  onClick={() => setVisibleCount(10)}
                  className="px-3 py-2 bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 font-semibold text-xs rounded-xl transition cursor-pointer border border-slate-300 dark:border-stone-700"
                >
                  Reset to 10
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
