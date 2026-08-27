import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order } from '../../types';
import { EditOrderModal } from '../orders/EditOrderModal';
import { CancelOrderModal } from '../orders/CancelOrderModal';
import { DeliveryDriverSlipModal } from '../pos/DeliveryDriverSlipModal';
import { ReceiptModal } from '../pos/ReceiptModal';
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

  // Export orders to CSV spreadsheet
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export.');
      return;
    }

    const headers = ['Order Number', 'Time', 'Type', 'Customer Name', 'Phone', 'Address', 'Items', 'Total (Rs)', 'Payment Method', 'Status', 'Driver'];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString(),
      o.type,
      `"${(o.customer?.name || '').replace(/"/g, '""')}"`,
      `"${(o.customer?.phone || '').replace(/"/g, '""')}"`,
      `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
      `"${o.items.map((i) => `${i.quantity}x ${i.name}`).join('; ').replace(/"/g, '""')}"`,
      o.total,
      o.paymentMethod,
      o.status,
      `"${(o.deliveryDriver || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `WhitesCastle_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="p-3.5 bg-stone-900 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00897b]/10 border border-[#00897b]/30 flex items-center justify-center text-[#00897b]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Orders History & Invoicing</span>
              <span className="text-xs font-mono text-stone-400 font-normal">
                ({filteredOrders.length} records)
              </span>
            </h2>
            <p className="text-xs text-stone-400">Reprint receipts, driver dispatch slips, manager audits and refunds</p>
          </div>
        </div>

        {/* Search, Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search order #, customer, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500 font-medium w-52"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
            {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  typeFilter === t ? 'bg-[#00897b] text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Payment filter */}
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
            {(['all', 'cash', 'card'] as const).map((pm) => (
              <button
                key={pm}
                onClick={() => setPaymentFilter(pm)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  paymentFilter === pm ? 'bg-[#00897b] text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl border border-stone-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Export transactions to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950 border-b border-stone-800 text-[10px] font-bold uppercase text-stone-400 tracking-wider">
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
            <tbody className="divide-y divide-stone-800 font-medium">
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
                    <tr key={order.id} className={`hover:bg-stone-850 transition ${isCancelled ? 'opacity-60 bg-red-950/10' : ''}`}>
                      <td className="p-3 font-bold font-mono text-teal-400">
                        {order.orderNumber}
                      </td>
                      <td className="p-3 text-stone-400 font-mono">{dateFormatted}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{order.customer?.name || 'Walk-in'}</div>
                        {order.customer?.phone && (
                          <div className="text-[11px] text-stone-400 font-mono">{order.customer?.phone}</div>
                        )}
                        {order.customer?.address && (
                          <div className="text-[10px] text-teal-300/80 truncate max-w-[180px]" title={order.customer.address}>
                            📍 {order.customer.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold uppercase text-stone-200 block text-[11px]">
                          {order.type.replace('_', ' ')}
                        </span>
                        {order.tableNumber && (
                          <span className="text-[10px] text-stone-400">Table {order.tableNumber}</span>
                        )}
                        {order.type === 'delivery' && (
                          <div className="mt-1">
                            <select
                              value={order.deliveryDriver || deliveryDrivers[0] || 'Rider 1 (Farhan)'}
                              onChange={(e) => assignDeliveryDriver(order.id, e.target.value)}
                              className="bg-stone-950 text-teal-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-stone-700 focus:outline-none focus:border-teal-500"
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
                      <td className="p-3 text-stone-300 max-w-xs truncate">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isCancelled
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isRefunded
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : order.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.cancelReason && (
                          <div className="text-[9px] text-red-400 mt-0.5 italic truncate max-w-[120px]">
                            {order.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-black font-mono text-white text-sm">
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
                            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
                              className="px-2 py-1 rounded-lg bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-1 shadow-lg shadow-teal-900/30 transition cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-teal-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-red-950/40 text-stone-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="Cancel Order"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => alert('Only Managers and Owners are authorized to cancel orders.')}
                                className="px-2 py-1 rounded-lg bg-stone-900 text-stone-600 text-xs font-semibold flex items-center gap-1 cursor-not-allowed"
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
                                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <RotateCcw className="w-5 h-5" />
              <span>Issue Refund for {refundModalOrder.orderNumber}</span>
            </div>

            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Customer:</span>
                <span className="font-bold text-white">{refundModalOrder.customer?.name}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Total to Refund:</span>
                <span className="font-black text-rose-400 text-sm font-mono">
                  Rs. {refundModalOrder.total.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Payment Method:</span>
                <span className="uppercase">{refundModalOrder.paymentMethod}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-stone-300">Refund Reason</label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setRefundModalOrder(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessRefund}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
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
