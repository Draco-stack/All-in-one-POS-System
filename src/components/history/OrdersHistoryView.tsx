import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order } from '../../types';
import { EditOrderModal } from '../orders/EditOrderModal';
import { CancelOrderModal } from '../orders/CancelOrderModal';
import { DeliveryDriverSlipModal } from '../pos/DeliveryDriverSlipModal';
import { ReceiptModal } from '../pos/ReceiptModal';
import { exportToStyledExcel } from '../../utils/excelExporter';
import {
  History,
  Search,
  Receipt,
  RotateCcw,
  Edit,
  XCircle,
  Truck,
  Download,
  Calendar,
  Printer,
} from 'lucide-react';

export const OrdersHistoryView: React.FC = () => {
  const {
    orders,
    setActiveReceiptOrder,
    activeReceiptOrder,
    activeDeliverySlipOrder,
    setActiveDeliverySlipOrder,
    setPrintQueueOrder,
    refundOrder,
    assignDeliveryDriver,
    deliveryDrivers,
    currentUser,
    theme,
  } = useRestaurant();

  const isManagerOrOwner = currentUser.role === 'owner' || currentUser.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  
  // Modals
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('Customer request / Return');

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.customer?.phone && o.customer.phone.includes(searchQuery)) ||
      (o.deliveryDriver && o.deliveryDriver.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchPayment = paymentFilter === 'all' || o.paymentMethod === paymentFilter;
    const matchType = typeFilter === 'all' || o.type === typeFilter;
    return matchSearch && matchPayment && matchType;
  });

  const handleProcessRefund = async () => {
    if (!refundModalOrder) return;
    await refundOrder(refundModalOrder.id, refundReason);
    setRefundModalOrder(null);
  };

  // Export orders to styled Excel report
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export.');
      return;
    }

    exportToStyledExcel({
      reportType: 'all',
      orders: filteredOrders,
      filename: `Whites_Orders_History_${new Date().toISOString().slice(0, 10)}.xls`,
    });
  };

  return (
    <div className={`h-[calc(100vh-4rem)] flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0b0c10] text-stone-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Top Filter Bar */}
      <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 transition-colors ${
        theme === 'dark' ? 'bg-[#12141c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              <span>Orders History & Invoicing</span>
              <span className={`text-xs font-mono font-normal ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
                ({filteredOrders.length} records)
              </span>
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
              Reprint receipts, driver dispatch slips, manager audits and refunds
            </p>
          </div>
        </div>

        {/* Search, Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${theme === 'dark' ? 'text-stone-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search order #, customer, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`border rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium w-52 focus:outline-none transition-colors ${
                theme === 'dark'
                  ? 'bg-[#08090d] border-white/10 text-stone-100 focus:border-teal-500 placeholder-stone-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-teal-600 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Type filter */}
          <div className={`flex items-center p-1 rounded-xl border text-xs ${
            theme === 'dark' ? 'bg-[#08090d] border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  typeFilter === t
                    ? 'bg-[#00897b] text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-stone-400 hover:text-stone-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Payment filter */}
          <div className={`flex items-center p-1 rounded-xl border text-xs ${
            theme === 'dark' ? 'bg-[#08090d] border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            {(['all', 'cash', 'card'] as const).map((pm) => (
              <button
                key={pm}
                onClick={() => setPaymentFilter(pm)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  paymentFilter === pm
                    ? 'bg-[#00897b] text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-stone-400 hover:text-stone-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#181a24] hover:bg-stone-800 text-stone-200 border-white/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Export transactions to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className={`border rounded-2xl overflow-hidden shadow-xl transition-colors ${
          theme === 'dark' ? 'bg-[#12141c] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <table className="w-full text-left text-xs">
            <thead className={`border-b text-[10px] font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'bg-[#08090d] border-white/10 text-stone-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Time</th>
                <th className="p-3">Customer & Details</th>
                <th className="p-3">Type & Driver</th>
                <th className="p-3">Items</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-medium ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-100'}`}>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-stone-500">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No transactions found</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const dateFormatted = new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isCancelled = order.status === 'cancelled';
                  const isRefunded = order.status === 'refunded';

                  return (
                    <tr key={order.id} className={`transition ${
                      theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                    } ${isCancelled ? 'opacity-60 bg-red-950/10' : ''}`}>
                      <td className="p-3 font-bold font-mono text-teal-400">
                        {order.orderNumber}
                      </td>
                      <td className={`p-3 font-mono ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>{dateFormatted}</td>
                      <td className="p-3">
                        <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{order.customer?.name || 'Walk-in'}</div>
                        {order.customer?.phone && (
                          <div className={`text-[11px] font-mono ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>{order.customer?.phone}</div>
                        )}
                        {order.customer?.address && (
                          <div className="text-[10px] text-teal-400 truncate max-w-[180px]" title={order.customer.address}>
                            📍 {order.customer.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`font-bold uppercase block text-[11px] ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.tableNumber && (
                          <span className={`text-[10px] ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>Table {order.tableNumber}</span>
                        )}
                        {order.type === 'delivery' && (
                          <div className="mt-1">
                            <select
                              value={order.deliveryDriver || deliveryDrivers[0] || 'Rider 1 (Farhan)'}
                              onChange={(e) => assignDeliveryDriver(order.id, e.target.value)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded border focus:outline-none focus:border-teal-500 ${
                                theme === 'dark'
                                  ? 'bg-[#08090d] text-teal-300 border-white/10'
                                  : 'bg-white text-teal-700 border-slate-300'
                              }`}
                              title="Assign Driver"
                            >
                              {deliveryDrivers.map((driver) => (
                                <option key={driver} value={driver}>
                                  🚗 {driver}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className={`p-3 max-w-xs truncate ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-3">
                        {(() => {
                          const st = (order.status || '').toLowerCase();
                          const isCanc = st === 'cancelled' || st === 'refunded' || st === 'void';
                          const isDeliv = st === 'delivered' || st === 'completed' || st === 'ready';
                          const isOnWay = st === 'dispatched' || st === 'on_the_way';

                          return (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                isCanc
                                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                                  : isDeliv
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(52,211,153,0.35)]'
                                  : isOnWay
                                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {order.status.replace('_', ' ')}
                            </span>
                          );
                        })()}
                        {order.cancelReason && (
                          <div className="text-[9px] text-rose-400 mt-0.5 italic truncate max-w-[120px]">
                            {order.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className={`p-3 text-right font-black font-mono text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Rs. {order.total.toFixed(0)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Delivery Slip (for delivery orders) */}
                          {order.type === 'delivery' && (
                            <button
                              id={`slip-order-${order.id}`}
                              onClick={() => setActiveDeliverySlipOrder(order)}
                              className="px-2 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Print Driver Slip"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Slip</span>
                            </button>
                          )}

                          {/* Standard Receipt Modal */}
                          <button
                            id={`receipt-order-${order.id}`}
                            onClick={() => setActiveReceiptOrder(order)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                            }`}
                            title="View Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* Reprint Thermal Receipt */}
                          {order.status === 'completed' || order.status === 'PUNCHED' || order.status === 'ready' || order.status === 'dispatched' || order.status === 'delivered' ? (
                            <button
                              id={`reprint-order-${order.id}`}
                              onClick={() => {
                                setPrintQueueOrder(order);
                                setTimeout(() => window.print(), 500);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-1 shadow-lg shadow-teal-900/30 transition cursor-pointer active:scale-95"
                              title="Reprint Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Reprint</span>
                            </button>
                          ) : null}

                          {/* Edit Order (Manager/Owner only) */}
                          {!isCancelled && !isRefunded && (
                            isManagerOrOwner ? (
                              <button
                                id={`edit-order-${order.id}`}
                                onClick={() => setEditingOrder(order)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                                  theme === 'dark'
                                    ? 'bg-stone-800 hover:bg-stone-700 text-teal-400'
                                    : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'
                                }`}
                                title="Edit Order Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            ) : null
                          )}

                          {/* Cancel Order (Manager/Owner only) */}
                          {!isCancelled && !isRefunded && (
                            isManagerOrOwner ? (
                              <button
                                id={`cancel-order-${order.id}`}
                                onClick={() => setCancellingOrder(order)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                                  theme === 'dark'
                                    ? 'bg-stone-800 hover:bg-red-950/40 text-stone-400 hover:text-red-400'
                                    : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200'
                                }`}
                                title="Cancel Order"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => alert('Only Managers and Owners are authorized to cancel orders.')}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-not-allowed ${
                                  theme === 'dark' ? 'bg-[#08090d] text-stone-600' : 'bg-slate-100 text-slate-400'
                                }`}
                                title="Manager permission required"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Locked</span>
                              </button>
                            )
                          )}

                          {/* Refund (Manager/Owner only) */}
                          {!isCancelled && !isRefunded && order.paymentStatus === 'paid' && (
                            isManagerOrOwner ? (
                              <button
                                id={`refund-order-${order.id}`}
                                onClick={() => setRefundModalOrder(order)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                                  theme === 'dark'
                                    ? 'bg-stone-800 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                }`}
                                title="Issue Refund"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Refund</span>
                              </button>
                            ) : null
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
      </div>

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
      />

      {/* Cancel Order Modal */}
      <CancelOrderModal
        order={cancellingOrder}
        onClose={() => setCancellingOrder(null)}
      />

      {/* Delivery Driver Slip Modal */}
      <DeliveryDriverSlipModal
        order={activeDeliverySlipOrder}
        onClose={() => setActiveDeliverySlipOrder(null)}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
      />

      {/* Refund Confirmation Modal */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#12141c] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-2 text-rose-500 font-bold text-base">
              <RotateCcw className="w-5 h-5" />
              <span>Issue Refund for {refundModalOrder.orderNumber}</span>
            </div>

            <div className={`p-3 rounded-xl border space-y-1 text-xs ${
              theme === 'dark' ? 'bg-[#08090d] border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex justify-between ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
                <span>Customer:</span>
                <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{refundModalOrder.customer?.name || 'Walk-in'}</span>
              </div>
              <div className={`flex justify-between ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
                <span>Total to Refund:</span>
                <span className="font-black text-rose-500 text-sm font-mono">
                  Rs. {refundModalOrder.total.toFixed(0)}
                </span>
              </div>
              <div className={`flex justify-between ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
                <span>Payment Method:</span>
                <span className="uppercase font-bold">{refundModalOrder.paymentMethod}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className={`text-xs font-bold uppercase ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Refund Reason</label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#08090d] border-white/10 text-stone-100 focus:border-rose-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-rose-600'
                }`}
              />
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-100'
            }`}>
              <button
                onClick={() => setRefundModalOrder(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                  theme === 'dark'
                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleProcessRefund}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition shadow-md active:scale-95"
              >
                Confirm Refund (Rs. {refundModalOrder.total.toFixed(0)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
