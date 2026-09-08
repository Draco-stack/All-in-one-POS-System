import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Eye,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderStatus } from '../../types';
import { OrderEditCancelModal } from './OrderEditCancelModal';
import { DeliveryOrderDetailsModal } from '../delivery/DeliveryOrderDetailsModal';

export const OrderQueueView: React.FC = () => {
  const { orders, updateOrderStatus, refundOrder, currentUser, assignDeliveryDriver, deliveryDrivers, getRiderStats, showToast, theme } = useRestaurant();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState<string>('');
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [selectedOrderForManage, setSelectedOrderForManage] = useState<Order | null>(null);
  const [selectedOrderForInspect, setSelectedOrderForInspect] = useState<Order | null>(null);
  const [dispatchModalOrder, setDispatchModalOrder] = useState<Order | null>(null);
  const [selectedRiderForDispatch, setSelectedRiderForDispatch] = useState<string>('');
  const [transitioningOrderId, setTransitioningOrderId] = useState<string | null>(null);

  const handleTransitionStatus = async (orderId: string, nextStatus: OrderStatus, paymentStatus?: string) => {
    if (transitioningOrderId === orderId) return;
    if (nextStatus === 'completed' && paymentStatus?.toUpperCase() !== 'PAID') {
      showToast('❌ Cannot complete order. Order is UNPAID. Process at POS Cashout.');
      return;
    }
    setTransitioningOrderId(orderId);
    try {
      await Promise.resolve(updateOrderStatus(orderId, nextStatus));
    } catch (err) {
      console.error('Failed to transition order status:', err);
    } finally {
      setTimeout(() => {
        setTransitioningOrderId(null);
      }, 400);
    }
  };

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

  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    setVisibleCount(10);
  }, [filterType, filterStatus, search]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, visibleCount);
  }, [filteredOrders, visibleCount]);

  const handleRefundSubmit = () => {
    if (selectedOrderForRefund && refundReason) {
      refundOrder(selectedOrderForRefund.id, refundReason);
      setSelectedOrderForRefund(null);
      setRefundReason('');
    }
  };

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto font-sans space-y-6 no-scrollbar transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0f1117] text-stone-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Top Header & Metrics Bar */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border transition-colors ${
        theme === 'dark' ? 'bg-[#151821] border-stone-800 shadow-lg' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div>
          <h2 className={`text-lg md:text-xl font-black flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            <ChefHat className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
            Live Kitchen Display & Order Dispatch
          </h2>
          <p className={`text-xs mt-0.5 ${
            theme === 'dark' ? 'text-stone-400' : 'text-slate-500'
          }`}>
            Real-time kitchen ticket flow, dispatch status tracking, and RBAC manager order modifications.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
              theme === 'dark' ? 'text-stone-400' : 'text-slate-400'
            }`} />
            <input
              type="text"
              placeholder="Search order #, phone, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-8 pr-3 py-1.5 border rounded-xl text-xs focus:outline-none transition-colors ${
                theme === 'dark'
                  ? 'bg-[#0c0e14] border-stone-700 text-white placeholder-stone-500 focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
              }`}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-3 py-1.5 border rounded-xl focus:outline-none text-xs font-semibold cursor-pointer transition-colors ${
              theme === 'dark'
                ? 'bg-[#0c0e14] border-stone-700 text-stone-200 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
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
            className={`px-3 py-1.5 border rounded-xl focus:outline-none text-xs font-semibold cursor-pointer transition-colors ${
              theme === 'dark'
                ? 'bg-[#0c0e14] border-stone-700 text-stone-200 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
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
        <div className={`py-20 px-6 text-center rounded-3xl border border-dashed transition-all duration-100 flex flex-col items-center justify-center space-y-4 ${
          theme === 'dark'
            ? 'bg-[#0c0e14] border-stone-800 text-stone-400 shadow-sm'
            : 'bg-slate-50 border-slate-300 text-slate-500 shadow-2xs'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className={`text-base font-black tracking-wide uppercase ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
              No Kitchen Orders in Queue
            </h3>
            <p className="text-xs leading-relaxed text-stone-400 font-medium">
              Punch new orders from the POS terminal or online dispatch to see live kitchen tickets populated here in real time.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-2 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 tabular-nums">
            <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
            <span>KDS Station Standby</span>
          </div>
        </div>
      ) : (
        <>
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
            {displayedOrders.map((order, idx) => {
              const conf = statusConfig[order.status] || statusConfig[order.status?.toLowerCase() as OrderStatus] || statusConfig.pending;
              const elapsedMins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
              return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.1, delay: Math.min(idx * 0.015, 0.1) }}
                key={order.id}
                className={`border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all duration-100 active:scale-[0.99] ${
                  theme === 'dark'
                    ? 'bg-[#12141c] border-stone-800/90 shadow-md hover:border-stone-700'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Header */}
                <div className={`flex items-start justify-between border-b pb-3 ${
                  theme === 'dark' ? 'border-stone-800' : 'border-slate-100'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-black text-base tabular-nums ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {order.orderNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black border ${
                        theme === 'dark'
                          ? 'bg-[#0c0e14] text-stone-300 border-stone-800'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {(order.type || order.orderType || 'takeaway').replace('_', ' ')}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${
                      theme === 'dark' ? 'text-stone-400' : 'text-slate-500'
                    }`}>
                      {order.type === 'dine_in'
                        ? order.tableNumber || 'Table'
                        : order.type === 'delivery'
                        ? `Delivery: ${order.customer?.name || 'Customer'} - ${order.customer?.phone || 'No phone'}`
                        : `Takeaway: ${order.customer?.name || 'Walk-in'}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${conf.bg} ${conf.text}`}>
                      {conf.label}
                    </span>
                    <span className={`text-[10px] font-mono block mt-1 ${
                      theme === 'dark' ? 'text-stone-500' : 'text-slate-400'
                    }`}>
                      {elapsedMins}m ago
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 flex-1">
                  {order.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        theme === 'dark'
                          ? 'bg-[#0c0e14]/80 border-stone-800/80 text-stone-200'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 font-mono font-bold flex items-center justify-center text-[11px]">
                          {item.quantity}x
                        </span>
                        <div>
                          <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {item.name}
                          </span>
                          {item.flavor && (
                            <p className="text-[10px] text-amber-500 font-medium mt-0.5">
                              {item.flavor}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`font-mono text-[11px] font-semibold ${
                        theme === 'dark' ? 'text-stone-400' : 'text-slate-600'
                      }`}>
                        PKR {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Delivery details */}
                {order.type === 'delivery' && order.customer?.address && (
                  <div className={`p-2.5 rounded-xl border text-[11px] ${
                    theme === 'dark'
                      ? 'bg-[#0c0e14] border-stone-800 text-stone-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span className={`font-bold block ${theme === 'dark' ? 'text-stone-300' : 'text-slate-800'}`}>
                      Address:
                    </span>
                    {order.customer.address}
                  </div>
                )}

                {/* Total & Action Footer */}
                <div className={`pt-2.5 border-t flex items-center justify-between ${
                  theme === 'dark' ? 'border-stone-800' : 'border-slate-100'
                }`}>
                  <div className="font-mono text-xs">
                    <span className={theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}>Total: </span>
                    <span className="font-bold text-emerald-500 text-sm">
                      PKR {order.total.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Inspect View Details */}
                    <button
                      onClick={() => setSelectedOrderForInspect(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-500 hover:text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border border-blue-500/30 active:scale-95"
                      title="Inspect complete order details"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>

                    {/* Manage/Edit Button (RBAC protected) */}
                    <button
                      onClick={() => setSelectedOrderForManage(order)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                        theme === 'dark'
                          ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                      title="Edit / Cancel Ticket (Manager Auth)"
                    >
                      <Edit3 className="w-3 h-3 text-amber-500" />
                      Manage
                    </button>

                    {order.status === 'ready' && (order.type === 'delivery' || order.orderType === 'delivery') ? (
                      <button
                        disabled={transitioningOrderId === order.id}
                        onClick={() => {
                          setSelectedRiderForDispatch(order.deliveryDriver || order.riderName || deliveryDrivers[0] || '');
                          setDispatchModalOrder(order);
                        }}
                        className={`px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 ${
                          transitioningOrderId === order.id ? 'opacity-60 cursor-not-allowed animate-pulse' : ''
                        }`}
                      >
                        <Truck className="w-3 h-3" />
                        Dispatch Rider
                      </button>
                    ) : conf.nextStatus && conf.nextLabel && (
                      <button
                        disabled={transitioningOrderId === order.id}
                        onClick={() => {
                          const isDelivery = order.type === 'delivery' || order.orderType === 'delivery';
                          const isDeliveringTransition = conf.nextStatus === 'dispatched' || conf.nextStatus === 'completed';
                          const hasDriver = order.deliveryDriver || order.riderName;

                          if (isDelivery && isDeliveringTransition && !hasDriver) {
                            setSelectedRiderForDispatch(deliveryDrivers[0] || '');
                            setDispatchModalOrder(order);
                            showToast('⚠️ A delivery rider is required to dispatch/deliver this order.');
                            return;
                          }

                          handleTransitionStatus(order.id, conf.nextStatus!, order.paymentStatus);
                        }}
                        className={`px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer active:scale-95 ${
                          transitioningOrderId === order.id ? 'opacity-60 cursor-not-allowed animate-pulse' : ''
                        }`}
                      >
                        {transitioningOrderId === order.id ? 'Updating...' : `${conf.nextLabel} →`}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>

        {filteredOrders.length > 10 && (
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border shadow-md transition-colors ${
            theme === 'dark' ? 'bg-[#151821] border-stone-800' : 'bg-white border-slate-200'
          }`}>
            <div className={`text-xs font-mono flex items-center gap-2 ${
              theme === 'dark' ? 'text-stone-400' : 'text-slate-500'
            }`}>
              <span>Showing <strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{displayedOrders.length}</strong> of <strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{filteredOrders.length}</strong> orders</span>
              {filteredOrders.length > visibleCount && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">
                  {filteredOrders.length - visibleCount} more available
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {filteredOrders.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Load More Orders (+10)</span>
                  <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">
                    +{Math.min(10, filteredOrders.length - visibleCount)}
                  </span>
                </button>
              )}

              {visibleCount > 10 && (
                <button
                  onClick={() => setVisibleCount(10)}
                  className={`px-3 py-2 font-semibold text-xs rounded-xl transition cursor-pointer active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  Reset to 10
                </button>
              )}
            </div>
          </div>
        )}
      </>
      )}

      {/* Complete Order Details Modal */}
      {selectedOrderForInspect && (
        <DeliveryOrderDetailsModal
          order={selectedOrderForInspect}
          isOpen={!!selectedOrderForInspect}
          onClose={() => setSelectedOrderForInspect(null)}
          onUpdateStatus={(orderId, newStatus) => {
            updateOrderStatus(orderId, newStatus);
            if (selectedOrderForInspect) {
              setSelectedOrderForInspect({ ...selectedOrderForInspect, status: newStatus });
            }
          }}
          onAssignRider={(orderId, riderName, phone, vehicle) => {
            assignDeliveryDriver(orderId, riderName);
            if (selectedOrderForInspect) {
              setSelectedOrderForInspect({
                ...selectedOrderForInspect,
                riderName,
                deliveryDriver: riderName,
                riderPhone: phone,
                riderVehicle: vehicle,
              });
            }
          }}
        />
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
              <div className="flex items-center justify-between">
                <label className="text-xs text-stone-300 font-bold block">
                  Select Delivery Rider *
                </label>
                {!selectedRiderForDispatch && (
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 animate-pulse">
                    Required
                  </span>
                )}
              </div>
              <select
                value={selectedRiderForDispatch}
                onChange={(e) => setSelectedRiderForDispatch(e.target.value)}
                required
                className={`w-full bg-stone-950 border rounded-xl p-3 text-xs text-white focus:outline-none font-bold transition ${
                  !selectedRiderForDispatch ? 'border-amber-500/70 text-amber-300 ring-1 ring-amber-500/30' : 'border-stone-800 focus:border-blue-500'
                }`}
              >
                <option value="">-- Select Rider (Required for Delivery)* --</option>
                {deliveryDrivers.map((driver) => {
                  const stats = getRiderStats(driver);
                  return (
                    <option key={driver} value={driver}>
                      🛵 {driver} ({stats.totalAssigned} assigned • ✓{stats.delivered} delivered | ✗{stats.cancelled} void)
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
                  if (!selectedRiderForDispatch) {
                    showToast('⚠️ Please select a delivery rider. Rider is required for delivery orders.');
                    return;
                  }
                  await assignDeliveryDriver(dispatchModalOrder.id, selectedRiderForDispatch);
                  await updateOrderStatus(dispatchModalOrder.id, 'dispatched');
                  setDispatchModalOrder(null);
                  showToast(`🚀 Order #${dispatchModalOrder.orderNumber} dispatched with rider ${selectedRiderForDispatch}`);
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
