import React, { useState } from 'react';
import {
  Clock,
  ChefHat,
  CheckCircle,
  Truck,
  RotateCcw,
  Search,
  Filter,
  Receipt,
  FileText,
  AlertCircle,
  Edit3,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderStatus } from '../../types';
import { OrderEditCancelModal } from './OrderEditCancelModal';

export const OrderQueueView: React.FC = () => {
  const { orders, updateOrderStatus, refundOrder, currentUser, assignDeliveryDriver, deliveryDrivers, getRiderStats } = useRestaurant();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState<string>('');
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [selectedOrderForManage, setSelectedOrderForManage] = useState<Order | null>(null);
  const [dispatchModalOrder, setDispatchModalOrder] = useState<Order | null>(null);
  const [selectedRiderForDispatch, setSelectedRiderForDispatch] = useState<string>('');

  const statusConfig: Record<
    OrderStatus,
    { label: string; bg: string; text: string; nextStatus?: OrderStatus; nextLabel?: string }
  > = {
    pending: {
      label: 'New Order',
      bg: 'bg-amber-500/20 border-amber-500/40',
      text: 'text-amber-400',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    open: {
      label: 'Active Ticket',
      bg: 'bg-amber-500/20 border-amber-500/40',
      text: 'text-amber-400',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    PUNCHED: {
      label: 'Punched & Live',
      bg: 'bg-teal-500/20 border-teal-500/40',
      text: 'text-teal-300',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    punched: {
      label: 'Punched & Live',
      bg: 'bg-teal-500/20 border-teal-500/40',
      text: 'text-teal-300',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    MODIFIED: {
      label: 'Modified Ticket',
      bg: 'bg-indigo-500/20 border-indigo-500/40',
      text: 'text-indigo-300',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    modified: {
      label: 'Modified Ticket',
      bg: 'bg-indigo-500/20 border-indigo-500/40',
      text: 'text-indigo-300',
      nextStatus: 'in_kitchen',
      nextLabel: 'Send to Kitchen',
    },
    in_kitchen: {
      label: 'Cooking in Kitchen',
      bg: 'bg-orange-500/20 border-orange-500/40',
      text: 'text-orange-400',
      nextStatus: 'ready',
      nextLabel: 'Mark Ready',
    },
    ready: {
      label: 'Ready for Pickup',
      bg: 'bg-emerald-500/20 border-emerald-500/40',
      text: 'text-emerald-400',
      nextStatus: 'completed',
      nextLabel: 'Complete Order',
    },
    dispatched: {
      label: 'Out with Rider',
      bg: 'bg-blue-500/20 border-blue-500/40',
      text: 'text-blue-400',
      nextStatus: 'completed',
      nextLabel: 'Delivered & Close',
    },
    completed: {
      label: 'Completed',
      bg: 'bg-stone-800 border-stone-700',
      text: 'text-stone-400',
    },
    cancelled: {
      label: 'Cancelled / Void',
      bg: 'bg-red-950/40 border-red-800/40',
      text: 'text-red-400',
    },
    refunded: {
      label: 'Refunded',
      bg: 'bg-purple-950/40 border-purple-800/40',
      text: 'text-purple-400',
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-emerald-950/40 border-emerald-800/40',
      text: 'text-emerald-400',
    },
  };

  const filteredOrders = orders.filter((o) => {
    const matchesType = filterType === 'all' || (o.type || o.orderType) === filterType;
    const currentSt = (o.status || 'pending').toLowerCase();
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? currentSt === 'pending' ||
          currentSt === 'open' ||
          currentSt === 'punched' ||
          currentSt === 'modified' ||
          currentSt === 'in_kitchen' ||
          currentSt === 'ready' ||
          currentSt === 'dispatched'
        : currentSt === filterStatus.toLowerCase();

    const query = search.toLowerCase();
    const matchesSearch =
      !search ||
      o.orderNumber.toLowerCase().includes(query) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(query)) ||
      (o.customer?.phone && o.customer.phone.includes(query)) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(query));

    return matchesType && matchesStatus && matchesSearch;
  });

  const handleRefundSubmit = () => {
    if (selectedOrderForRefund && refundReason) {
      refundOrder(selectedOrderForRefund.id, refundReason);
      setSelectedOrderForRefund(null);
      setRefundReason('');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#1a1d24] text-stone-100 font-sans space-y-6 no-scrollbar">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#232833] p-4 rounded-2xl border border-stone-800">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-[#00897b]" />
            Live Kitchen Display & Order Dispatch
          </h2>
          <p className="text-xs text-stone-400">
            Real-time kitchen ticket flow, dispatch status tracking, and RBAC manager order modifications.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search order #, phone, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#171a21] border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#171a21] border border-stone-700 rounded-xl text-stone-200 focus:outline-none text-xs font-semibold"
          >
            <option value="active">Active Tickets ({orders.filter((o) => ['pending', 'PUNCHED', 'MODIFIED', 'in_kitchen', 'ready'].includes(o.status)).length})</option>
            <option value="all">All Historical Tickets</option>
            <option value="PUNCHED">Punched</option>
            <option value="in_kitchen">In Kitchen</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-[#171a21] border border-stone-700 rounded-xl text-stone-200 focus:outline-none text-xs font-semibold"
          >
            <option value="all">All Order Types</option>
            <option value="dine_in">Dine-In</option>
            <option value="takeaway">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="py-20 text-center bg-[#232833]/40 rounded-2xl border border-dashed border-stone-800 text-stone-500">
          <Receipt className="w-12 h-12 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-400">No active kitchen orders found</p>
          <p className="text-xs text-stone-600 mt-1">Punch new orders from POS terminal to see live kitchen tickets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const conf = statusConfig[order.status] || statusConfig[order.status?.toLowerCase() as OrderStatus] || statusConfig.pending;
            const elapsedMins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
            return (
              <div
                key={order.id}
                className="bg-[#232833] border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-stone-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-white">
                        {order.orderNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#171a21] text-[10px] uppercase font-black text-stone-300 border border-stone-800">
                        {(order.type || order.orderType || 'takeaway').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {order.type === 'dine_in'
                        ? order.tableNumber || 'Table'
                        : order.type === 'delivery'
                        ? `Delivery: ${order.customer?.name || 'Customer'}`
                        : `Takeaway: ${order.customer?.name || 'Walk-in'}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${conf.bg} ${conf.text}`}>
                      {conf.label}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono block mt-1">
                      {elapsedMins}m ago
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 flex-1">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#171a21]/90 rounded-xl border border-stone-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#00897b]/20 border border-[#00897b]/30 text-emerald-400 font-mono font-bold flex items-center justify-center text-[11px]">
                          {item.quantity}x
                        </span>
                        <div>
                          <span className="font-bold text-white">{item.name}</span>
                          {item.flavor && (
                            <p className="text-[10px] text-amber-300 mt-0.5">
                              {item.flavor}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-stone-400 text-[11px]">
                        PKR {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Delivery details */}
                {order.type === 'delivery' && order.customer?.address && (
                  <div className="bg-[#171a21] p-2.5 rounded-xl border border-stone-800 text-[11px] text-stone-400">
                    <span className="font-bold text-stone-300 block">Address:</span>
                    {order.customer.address}
                  </div>
                )}

                {/* Total & Action Footer */}
                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  <div className="font-mono text-xs">
                    <span className="text-stone-400">Total: </span>
                    <span className="font-bold text-emerald-400">
                      PKR {order.total.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Manage/Edit Button (RBAC protected) */}
                    <button
                      onClick={() => setSelectedOrderForManage(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Edit / Cancel Ticket (Manager Auth)"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      Manage
                    </button>

                    {order.status === 'ready' && (order.type === 'delivery' || order.orderType === 'delivery') ? (
                      <button
                        onClick={() => {
                          setSelectedRiderForDispatch(order.deliveryDriver || deliveryDrivers[0] || '');
                          setDispatchModalOrder(order);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
                      >
                        <Truck className="w-3 h-3" />
                        Dispatch Rider
                      </button>
                    ) : conf.nextStatus && conf.nextLabel && (
                      <button
                        onClick={() => updateOrderStatus(order.id, conf.nextStatus!)}
                        className="px-3 py-1.5 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        {conf.nextLabel} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Edit / Cancel Modal */}
      <OrderEditCancelModal
        isOpen={!!selectedOrderForManage}
        onClose={() => setSelectedOrderForManage(null)}
        order={selectedOrderForManage}
      />

      {/* REFUND AUTHORIZATION MODAL */}
      {selectedOrderForRefund && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-red-400 font-bold text-base border-b border-stone-800 pb-3">
              <AlertCircle className="w-5 h-5" />
              Authorize Order Refund ({selectedOrderForRefund.orderNumber})
            </div>

            <p className="text-xs text-stone-400">
              Authorized by <strong className="text-white">{currentUser.name}</strong> ({currentUser.role}). Please provide the customer reason for audit trail.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-stone-300 font-semibold">Refund Reason:</label>
              <textarea
                rows={3}
                placeholder="e.g. Wrong items delivered, customer cancelled before kitchen dispatch..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setSelectedOrderForRefund(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={!refundReason}
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md"
              >
                Confirm Refund (PKR {selectedOrderForRefund.total})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH RIDER SELECTION MODAL */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-base border-b border-stone-800 pb-3">
              <Truck className="w-5 h-5" />
              Dispatch Order {dispatchModalOrder.orderNumber} to Rider
            </div>

            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-400">Customer:</span>
                <span className="text-white font-bold">{dispatchModalOrder.customer?.name || 'Walk-in Delivery'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Address:</span>
                <span className="text-stone-300 font-medium truncate max-w-[220px]">
                  {dispatchModalOrder.customer?.address || 'No address specified'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Order Value:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  PKR {dispatchModalOrder.total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-stone-300 font-semibold block">Select Delivery Rider:</label>
              <select
                value={selectedRiderForDispatch}
                onChange={(e) => setSelectedRiderForDispatch(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                {deliveryDrivers.map((driver) => {
                  const stats = getRiderStats(driver);
                  return (
                    <option key={driver} value={driver}>
                      {driver} ({stats.totalAssigned} assigned • ✓{stats.delivered} delivered | ✗{stats.cancelled} void)
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedRiderForDispatch && (
              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-[11px] text-blue-300 flex items-center justify-between">
                <span>Rider Track Record:</span>
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className="text-emerald-400">✓ {getRiderStats(selectedRiderForDispatch).delivered} Del</span>
                  <span className="text-red-400">✗ {getRiderStats(selectedRiderForDispatch).cancelled} Can</span>
                  <span className="text-amber-400">⏳ {getRiderStats(selectedRiderForDispatch).inTransit} Active</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedRiderForDispatch) {
                    await assignDeliveryDriver(dispatchModalOrder.id, selectedRiderForDispatch);
                    await updateOrderStatus(dispatchModalOrder.id, 'dispatched');
                  }
                  setDispatchModalOrder(null);
                }}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                Dispatch Rider Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
