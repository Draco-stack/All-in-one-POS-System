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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 border border-stone-300 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#00695c] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold text-sm">
              B
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>Blink Co Orders & Call Center Dispatch</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono font-normal">
                  {filteredOrders.length} records
                </span>
              </h3>
              <p className="text-[11px] text-teal-100">Live order queue, dispatch drivers, edit, cancel and print receipts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search order #, customer, phone, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-[#00695c]"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            {['all', 'open', 'punched_kitchen', 'ready', 'completed', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-bold uppercase transition cursor-pointer text-[11px] ${
                  statusFilter === st
                    ? 'bg-[#00695c] text-white'
                    : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-50">
          <table className="w-full text-left text-xs bg-white rounded-lg border border-stone-200 shadow-xs overflow-hidden">
            <thead className="bg-stone-100 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Time</th>
                <th className="p-3">Customer & Phone</th>
                <th className="p-3">Type & Driver</th>
                <th className="p-3">Items</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
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
                      className={`hover:bg-stone-50 transition ${
                        isCancelled ? 'bg-red-50/50 opacity-70' : ''
                      }`}
                    >
                      <td className="p-3 font-bold font-mono text-[#00695c]">{order.orderNumber}</td>
                      <td className="p-3 text-stone-500 font-mono">{dateFormatted}</td>
                      <td className="p-3">
                        <div className="font-bold text-stone-900">{order.customer?.name}</div>
                        {order.customer?.phone && (
                          <div className="text-[11px] text-stone-500 font-mono">{order.customer?.phone}</div>
                        )}
                        {order.customer.address && (
                          <div className="text-[10px] text-stone-600 truncate max-w-[160px]" title={order.customer.address}>
                            📍 {order.customer.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold uppercase text-stone-700 block text-[11px]">
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.type === 'delivery' && (
                          <div className="mt-1">
                            <select
                              value={order.deliveryDriver || deliveryDrivers[0] || 'Carlos Rodriguez'}
                              onChange={(e) => assignDeliveryDriver(order.id, e.target.value)}
                              className="bg-stone-100 text-stone-800 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-stone-300 focus:outline-none focus:border-[#00695c] max-w-[180px] truncate"
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
                      <td className="p-3 text-stone-600 max-w-xs truncate">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isCancelled
                              ? 'bg-red-100 text-red-700'
                              : isRefunded
                              ? 'bg-rose-100 text-rose-700'
                              : order.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.cancelReason && (
                          <div className="text-[9px] text-red-600 mt-0.5 italic truncate max-w-[120px]">
                            {order.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-black font-mono text-stone-900 text-sm">
                        Rs. {order.total.toFixed(0)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!isCancelled && (
                            <button
                              onClick={() => setEditingOrder(order)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              title="Edit Order"
                            >
                              <Edit className="w-3.5 h-3.5 text-sky-600" />
                              <span>Edit</span>
                            </button>
                          )}

                          {order.type === 'delivery' && (
                            <button
                              onClick={() => setActiveDeliverySlipOrder(order)}
                              className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              title="Print Driver Slip"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Slip</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveReceiptOrder(order)}
                            className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>

                          {!isCancelled && (
                            <button
                              onClick={() => setCancellingOrder(order)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-red-100 text-red-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              title="Cancel Order"
                            >
                              <XCircle className="w-3.5 h-3.5" />
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
