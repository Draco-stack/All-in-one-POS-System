import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order } from '../../types';
import {
  X,
  Search,
  RotateCcw,
  Edit,
  XCircle,
  Truck,
  Receipt,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { EditOrderModal } from '../orders/EditOrderModal';
import { CancelOrderModal } from '../orders/CancelOrderModal';
import { DeliveryDriverSlipModal } from './DeliveryDriverSlipModal';
import { ReceiptModal } from './ReceiptModal';

interface BlinkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlinkOrdersModal: React.FC<BlinkOrdersModalProps> = ({ isOpen, onClose }) => {
  const {
    orders,
    setActiveReceiptOrder,
    activeReceiptOrder,
    activeDeliverySlipOrder,
    setActiveDeliverySlipOrder,
    assignDeliveryDriver,
    deliveryDrivers,
    getRiderStats,
  } = useRestaurant();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer?.phone && o.customer?.phone.includes(searchQuery)) ||
      (o.deliveryDriver && o.deliveryDriver.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-stone-100 animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-black text-sm shadow-md border border-emerald-400/20">
              B
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span>Blink Co Orders & Call Center Dispatch</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  {filteredOrders.length} records
                </span>
              </h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Live order queue, dispatch drivers, edit, cancel and print receipts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3.5 bg-stone-950/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search order #, customer, phone, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            {['all', 'open', 'punched_kitchen', 'ready', 'completed', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer text-[10px] tracking-wider ${
                  statusFilter === st
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md border border-emerald-400/20'
                    : 'bg-stone-900 border border-white/5 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-950/40">
          <table className="w-full text-left text-xs bg-stone-900/80 rounded-2xl border border-white/5 shadow-inner overflow-hidden">
            <thead className="bg-stone-950/90 border-b border-white/5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Order #</th>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Customer & Phone</th>
                <th className="p-3.5">Type & Driver</th>
                <th className="p-3.5">Items</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-500 font-medium">
                    No orders found matching criteria
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isCancelled = order.status === 'cancelled';
                  const isRefunded = order.status === 'refunded';
                  const dateFormatted = new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isCancelled ? 'bg-rose-950/10 opacity-70' : ''
                      }`}
                    >
                      <td className="p-3.5 font-black font-mono text-emerald-400">{order.orderNumber}</td>
                      <td className="p-3.5 text-stone-400 font-mono text-[11px]">{dateFormatted}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-stone-200">{order.customer?.name}</div>
                        {order.customer?.phone && (
                          <div className="text-[10px] text-stone-400 font-mono">{order.customer?.phone}</div>
                        )}
                        {order.customer.address && (
                          <div className="text-[10px] text-stone-500 truncate max-w-[160px]" title={order.customer.address}>
                            📍 {order.customer.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold uppercase text-stone-300 block text-[10px] tracking-wider">
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.type === 'delivery' && (
                          <div className="mt-1">
                            <select
                              value={order.deliveryDriver || deliveryDrivers[0] || 'Carlos Rodriguez'}
                              onChange={(e) => assignDeliveryDriver(order.id, e.target.value)}
                              className="bg-stone-950 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 focus:outline-none focus:border-emerald-500/50 max-w-[180px] truncate cursor-pointer"
                            >
                              {deliveryDrivers.map((driver) => {
                                const stats = getRiderStats(driver);
                                return (
                                  <option key={driver} value={driver}>
                                    🛵 {driver} {stats.totalAssigned > 0 ? `(${stats.totalAssigned} • ✓${stats.delivered} ✗${stats.cancelled})` : '(0)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-stone-300 text-xs max-w-xs truncate font-medium">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isCancelled
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                              : isRefunded
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                              : order.status === 'completed'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.cancelReason && (
                          <div className="text-[9px] text-rose-400 mt-0.5 italic truncate max-w-[120px]">
                            {order.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-black font-mono text-white text-xs">
                        PKR {order.total.toFixed(0)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isCancelled && (
                            <button
                              onClick={() => setEditingOrder(order)}
                              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-white/5"
                              title="Edit Order"
                            >
                              <Edit className="w-3 h-3 text-sky-400" />
                              <span>Edit</span>
                            </button>
                          )}

                          {order.type === 'delivery' && (
                            <button
                              onClick={() => setActiveDeliverySlipOrder(order)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                              title="Print Driver Slip"
                            >
                              <Truck className="w-3 h-3 text-emerald-400" />
                              <span>Slip</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveReceiptOrder(order)}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-white/5"
                            title="Receipt"
                          >
                            <Receipt className="w-3 h-3 text-stone-400" />
                            <span>Receipt</span>
                          </button>

                          {!isCancelled && (
                            <button
                              onClick={() => setCancellingOrder(order)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                              title="Cancel Order"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} />
        <CancelOrderModal order={cancellingOrder} onClose={() => setCancellingOrder(null)} />
        <DeliveryDriverSlipModal
          order={activeDeliverySlipOrder}
          onClose={() => setActiveDeliverySlipOrder(null)}
        />
        <ReceiptModal order={activeReceiptOrder} onClose={() => setActiveReceiptOrder(null)} />
      </div>
    </div>
  );
};
