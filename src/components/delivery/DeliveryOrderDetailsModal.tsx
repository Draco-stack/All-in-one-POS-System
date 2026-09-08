import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  User,
  Truck,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  Printer,
  Edit3,
  ExternalLink,
  Navigation as NavigationIcon,
  ShieldAlert,
  DollarSign,
  Package,
  Calendar,
  Check,
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { getWhatsAppDispatchData } from '../../utils/whatsapp';

interface DeliveryOrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, reason?: string) => void;
  onAssignRider: (orderId: string, riderName: string, riderPhone?: string, riderVehicle?: string) => void;
}

export const DeliveryOrderDetailsModal: React.FC<DeliveryOrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onAssignRider,
}) => {
  const { deliveryDrivers, showToast, setActiveDeliverySlipOrder } = useRestaurant();
  const [selectedRider, setSelectedRider] = useState<string>('');
  const [riderPhoneInput, setRiderPhoneInput] = useState<string>('');
  const [riderVehicleInput, setRiderVehicleInput] = useState<string>('');
  const [isEditingRider, setIsEditingRider] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setSelectedRider(order.riderName || order.deliveryDriver || '');
      setRiderPhoneInput(order.riderPhone || '');
      setRiderVehicleInput(order.riderVehicle || '');
      setIsEditingRider(false);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const elapsedMins = order.deliveryElapsedMinutes ?? (order.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)) : 0);

  const getSlaBadge = () => {
    if (order.status === 'delivered' || order.status === 'completed') {
      return { bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', label: `${elapsedMins}m (Completed)` };
    }
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return { bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400', label: 'Cancelled' };
    }
    if (elapsedMins > 45) {
      return { bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse', label: `${elapsedMins}m (SLA Breach)` };
    }
    if (elapsedMins >= 30) {
      return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300', label: `${elapsedMins}m (Approaching SLA)` };
    }
    return { bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400', label: `${elapsedMins}m (On Time)` };
  };

  const sla = getSlaBadge();

  const handleSaveRider = () => {
    if (selectedRider && order) {
      onAssignRider(order.id, selectedRider, riderPhoneInput, riderVehicleInput);
      setIsEditingRider(false);
      showToast(`✓ Rider ${selectedRider} assigned to Order #${order.orderNumber || order.id}`);
    } else {
      showToast('⚠️ Please select a valid rider from the list');
    }
  };

  const handlePrintSlip = () => {
    if (setActiveDeliverySlipOrder) {
      setActiveDeliverySlipOrder(order);
    }
    showToast(`🖨️ Printing Delivery Dispatch Slip for #${order.orderNumber || order.id}`);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const statusOptions: { value: OrderStatus; label: string; activeClass: string }[] = [
    { value: 'in_kitchen', label: 'In Kitchen', activeClass: 'bg-blue-600 text-white' },
    { value: 'ready', label: 'Ready', activeClass: 'bg-teal-600 text-white' },
    { value: 'dispatched', label: 'On The Way', activeClass: 'bg-amber-600 text-white' },
    { value: 'delivered', label: 'Delivered', activeClass: 'bg-emerald-600 text-white' },
    { value: 'cancelled', label: 'Cancel Order', activeClass: 'bg-rose-600 text-white' },
  ];

  // Format timestamp helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  // Get timeline timestamp if recorded
  const getTimelineTime = (status: OrderStatus) => {
    const item = order.timeline?.find((t) => t.status === status);
    if (item?.timestamp) {
      return formatTime(item.timestamp);
    }
    if (status === 'punched' || status === 'open' || status === 'pending') {
      return formatTime(order.createdAt);
    }
    return null;
  };

  const punchedTime = getTimelineTime('punched') || formatTime(order.createdAt);
  const kitchenTime = getTimelineTime('in_kitchen');
  const readyTime = getTimelineTime('ready');
  const dispatchedTime = getTimelineTime('dispatched');
  const deliveredTime = getTimelineTime('delivered');

  const customerPhone = order.customer?.phone || '';
  const customerName = order.customer?.name || 'Walk-in / Phone Customer';
  const customerAddress = order.deliveryAddress || order.customer?.address || 'Standard Delivery Zone';

  const orderTotal = order.total || order.subtotal || 0;
  const orderFee = order.deliveryFee ?? (order.orderType === 'delivery' ? 100 : 0);
  const orderSubtotal = order.subtotal ?? (orderTotal - orderFee);
  const orderDiscount = order.discount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200 print:hidden">
      <div className="bg-[#14161f] border border-slate-300 dark:border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-stone-100 overflow-hidden">
        
        {/* Modal Header */}
        <header className="px-6 py-4 bg-[#10121a] border-b border-slate-300 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-white tracking-tight font-mono">
                  Order #{order.orderNumber || order.id}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${sla.bg}`}>
                  {sla.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-stone-800/80 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-stone-300 text-xs font-medium">
                  {order.branchName || order.outlet || 'Main Branch'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-mono mt-0.5 flex items-center gap-2">
                <span>Punched: {punchedTime}</span>
                <span className="text-stone-600">•</span>
                <span>Source: <strong className="text-slate-700 dark:text-stone-300 font-semibold">{order.source || 'Call Center'}</strong></span>
                <span className="text-stone-600">•</span>
                <span>Cashier: <strong className="text-emerald-400 font-semibold">{order.punchedBy || order.cashierName || 'Staff'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintSlip}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 dark:border-white/10 cursor-pointer shadow-sm"
              title="Print Order Dispatch Slip"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-500 dark:text-stone-400 hover:text-white transition cursor-pointer border border-slate-300 dark:border-white/10"
              title="Close Details Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Status Quick Bar */}
          <div className="bg-[#181a24] p-4 rounded-xl border border-slate-300 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-stone-400 font-bold uppercase tracking-wider block mb-1">
                Order Lifecycle Stage &amp; Payment Status
              </span>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-black text-white capitalize flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    order.status === 'delivered' ? 'bg-emerald-400' :
                    order.status === 'dispatched' ? 'bg-amber-400 animate-pulse' :
                    order.status === 'cancelled' ? 'bg-rose-400' : 'bg-blue-400'
                  }`} />
                  {order.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-500 dark:text-stone-400">
                  • Tender: <strong className={order.paymentStatus === 'paid' ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                    {(order.paymentStatus || 'Pending').toUpperCase()} ({(order.paymentMethod || 'COD Cash').toUpperCase()})
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Status Advance Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusOptions.map((opt) => {
                const isActive = order.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const isDelivery = order.orderType === 'delivery' || order.type === 'delivery' || !order.type;
                      const isDeliveringState = opt.value === 'dispatched' || opt.value === 'delivered';
                      const currentDriver = order.riderName || order.deliveryDriver;

                      if (isDelivery && isDeliveringState && !currentDriver && !selectedRider) {
                        setIsEditingRider(true);
                        showToast('⚠️ A Delivery Rider is required for delivering orders! Please select and assign a rider first.');
                        return;
                      }

                      if (selectedRider && (!currentDriver || currentDriver !== selectedRider)) {
                        onAssignRider(order.id, selectedRider, riderPhoneInput, riderVehicleInput);
                      }

                      if (opt.value === 'cancelled') {
                        const reasonInput = window.prompt(`Please enter cancellation reason for Order #${order.orderNumber || order.id}:`, 'Customer change of mind');
                        if (reasonInput === null) return; // user hit Cancel on prompt
                        const reason = reasonInput.trim() || 'Customer requested cancellation';
                        onUpdateStatus(order.id, 'cancelled', reason);
                      } else {
                        onUpdateStatus(order.id, opt.value);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      isActive
                        ? `${opt.activeClass} border-transparent shadow-md ring-2 ring-white/20`
                        : 'bg-[#12131b] hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-stone-200 border-slate-200 dark:border-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer & Delivery Destination Card */}
            <div className="bg-[#181a24] p-5 rounded-xl border border-slate-300 dark:border-white/10 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300 dark:border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer &amp; Destination Details
                </h3>
                {order.customer?.id && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-stone-400">
                    ID: {order.customer.id}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
                  <span className="text-slate-500 dark:text-stone-400">Customer Name:</span>
                  <span className="font-bold text-white text-sm">{customerName}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
                  <span className="text-slate-500 dark:text-stone-400">Phone Contact:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">
                      {customerPhone || 'Not Provided'}
                    </span>
                    {customerPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${customerPhone}`}
                          title="Call Customer"
                          className="p-1.5 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-emerald-400 transition hover:scale-105"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        {(() => {
                          const waData = getWhatsAppDispatchData(order);
                          return (
                            <a
                              href={waData.url || `https://wa.me/${customerPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Send WhatsApp "${waData.statusLabel}" notification`}
                              className="p-1.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] transition hover:scale-105"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-1 border-b border-slate-200 dark:border-white/5">
                  <span className="text-slate-500 dark:text-stone-400 block mb-1">Delivery Address:</span>
                  <p className="text-stone-200 bg-[#101219] p-3 rounded-xl border border-slate-200 dark:border-white/5 flex items-start gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{customerAddress}</span>
                  </p>
                </div>

                {order.customer?.deliveryNotes && (
                  <div className="py-1">
                    <span className="text-amber-400 font-bold block mb-1">Special Delivery Notes:</span>
                    <p className="text-amber-200/90 bg-amber-950/20 p-2.5 rounded-xl border border-amber-900/40 italic">
                      "{order.customer.deliveryNotes}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rider & Dispatch Assignment Card */}
            <div className="bg-[#181a24] p-5 rounded-xl border border-slate-300 dark:border-white/10 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300 dark:border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Assigned Delivery Rider
                </h3>
                <button
                  onClick={() => setIsEditingRider(!isEditingRider)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditingRider ? 'Cancel' : 'Change Rider'}
                </button>
              </div>

              {isEditingRider ? (
                <div className="space-y-3 bg-[#101219] p-4 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-stone-300 mb-1 font-bold">Select Active Rider:</label>
                    <select
                      value={selectedRider}
                      onChange={(e) => setSelectedRider(e.target.value)}
                      className="w-full bg-[#181a24] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Choose Rider --</option>
                      {deliveryDrivers.map((d) => (
                        <option key={d} value={d}>
                          {d} (Fleet Rider)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-stone-300 mb-1 font-semibold">Rider Phone (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. 0300-1234567"
                      value={riderPhoneInput}
                      onChange={(e) => setRiderPhoneInput(e.target.value)}
                      className="w-full bg-[#181a24] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-stone-300 mb-1 font-semibold">Vehicle / Bike Registration (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. Bike (LEA-1234)"
                      value={riderVehicleInput}
                      onChange={(e) => setRiderVehicleInput(e.target.value)}
                      className="w-full bg-[#181a24] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleSaveRider}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Save Rider Assignment
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
                    <span className="text-slate-500 dark:text-stone-400">Assigned Rider:</span>
                    <span className="font-bold text-white text-sm">
                      {order.riderName || order.deliveryDriver ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span>🛵</span> {order.riderName || order.deliveryDriver}
                        </span>
                      ) : (
                        <button
                          onClick={() => setIsEditingRider(true)}
                          className="text-amber-400 hover:text-amber-300 font-bold text-xs bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg cursor-pointer transition flex items-center gap-1 animate-pulse"
                        >
                          <span>⚠️ Required (Click to Assign)</span>
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
                    <span className="text-slate-500 dark:text-stone-400">Rider Contact:</span>
                    <span className="font-mono text-slate-700 dark:text-stone-300">
                      {order.riderPhone || 'Not on file'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
                    <span className="text-slate-500 dark:text-stone-400">Vehicle / Bike:</span>
                    <span className="font-semibold text-slate-700 dark:text-stone-300">
                      {order.riderVehicle || 'Fleet Motorcycle'}
                    </span>
                  </div>

                  <div className="p-3 bg-[#101219] rounded-xl border border-slate-200 dark:border-white/5 text-[11px] text-slate-500 dark:text-stone-400 flex items-center gap-2">
                    <NavigationIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dispatch Routing: {order.branchName || 'Main'} Branch to Destination</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Delivery Timeline Stepper */}
          <div className="bg-[#181a24] p-5 rounded-xl border border-slate-300 dark:border-white/10 space-y-3 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Order Stage Timeline
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              {/* Stage 1: Punched */}
              <div className="p-3 rounded-xl bg-[#101219] border border-emerald-500/30 text-center">
                <span className="w-6 h-6 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1.5">
                  ✓
                </span>
                <p className="text-[11px] font-bold text-white">1. Punched</p>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono mt-0.5">{punchedTime}</p>
              </div>

              {/* Stage 2: Kitchen Prep */}
              <div className={`p-3 rounded-xl border text-center ${
                ['in_kitchen', 'ready', 'dispatched', 'delivered', 'completed'].includes(order.status)
                  ? 'bg-[#101219] border-blue-500/30'
                  : 'bg-[#101219]/40 border-slate-200 dark:border-white/5 opacity-50'
              }`}>
                <span className="w-6 h-6 mx-auto rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mb-1.5">
                  🍳
                </span>
                <p className="text-[11px] font-bold text-white">2. In Kitchen</p>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono mt-0.5">
                  {kitchenTime || (['in_kitchen', 'ready', 'dispatched', 'delivered'].includes(order.status) ? 'Active' : 'Pending')}
                </p>
              </div>

              {/* Stage 3: Ready */}
              <div className={`p-3 rounded-xl border text-center ${
                ['ready', 'dispatched', 'delivered', 'completed'].includes(order.status)
                  ? 'bg-[#101219] border-teal-500/30'
                  : 'bg-[#101219]/40 border-slate-200 dark:border-white/5 opacity-50'
              }`}>
                <span className="w-6 h-6 mx-auto rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs mb-1.5">
                  📦
                </span>
                <p className="text-[11px] font-bold text-white">3. Ready</p>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono mt-0.5">
                  {readyTime || (['ready', 'dispatched', 'delivered'].includes(order.status) ? 'Ready' : 'Pending')}
                </p>
              </div>

              {/* Stage 4: On The Way */}
              <div className={`p-3 rounded-xl border text-center ${
                ['dispatched', 'delivered', 'completed'].includes(order.status)
                  ? 'bg-[#101219] border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-[#101219]/40 border-slate-200 dark:border-white/5 opacity-50'
              }`}>
                <span className="w-6 h-6 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs mb-1.5">
                  🛵
                </span>
                <p className="text-[11px] font-bold text-white">4. Dispatched</p>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono mt-0.5">
                  {dispatchedTime || (order.status === 'dispatched' ? 'In Transit' : 'Pending')}
                </p>
              </div>

              {/* Stage 5: Delivered */}
              <div className={`p-3 rounded-xl border text-center ${
                order.status === 'delivered' || order.status === 'completed'
                  ? 'bg-[#101219] border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-[#101219]/40 border-slate-200 dark:border-white/5 opacity-50'
              }`}>
                <span className="w-6 h-6 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1.5">
                  🏠
                </span>
                <p className="text-[11px] font-bold text-white">5. Delivered</p>
                <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono mt-0.5">
                  {deliveredTime || (order.status === 'delivered' ? 'Completed' : 'Pending')}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Order List & Financial Breakdown */}
          <div className="bg-[#181a24] p-5 rounded-xl border border-slate-300 dark:border-white/10 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-white/10 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Itemized Order Basket ({order.items?.length || 0} items)
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-stone-400">
                Type: {(order.orderType || 'Delivery').toUpperCase()}
              </span>
            </div>

            <div className="divide-y divide-white/5 border border-slate-300 dark:border-white/10 rounded-xl overflow-hidden bg-[#101219]">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-stone-800 text-slate-900 dark:text-white font-mono font-bold flex items-center justify-center text-xs border border-slate-300 dark:border-white/10">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-bold text-white text-sm">{item.name}</p>
                        {item.flavor && (
                          <span className="text-[11px] text-amber-400 block font-medium">
                            Flavor: {item.flavor}
                          </span>
                        )}
                        {item.itemNote && (
                          <span className="text-[11px] text-slate-500 dark:text-stone-400 italic block">
                            Note: {item.itemNote}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-stone-200 text-sm">
                      PKR {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 dark:text-stone-400 text-xs">
                  No line items attached to this order record.
                </div>
              )}
            </div>

            {/* Bill Financial Summary */}
            <div className="p-4 bg-[#101219] rounded-xl border border-slate-300 dark:border-white/10 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-stone-400">
                <span>Subtotal Items:</span>
                <span className="font-mono font-semibold text-stone-200">
                  PKR {orderSubtotal.toLocaleString()}
                </span>
              </div>
              {orderFee > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-stone-400">
                  <span>Delivery Dispatch Fee:</span>
                  <span className="font-mono font-semibold text-stone-200">
                    PKR {orderFee.toLocaleString()}
                  </span>
                </div>
              )}
              {orderDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Promotional Discount:</span>
                  <span className="font-mono font-semibold">- PKR {orderDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-slate-300 dark:border-white/10 pt-2.5 flex justify-between items-center text-sm font-black text-white">
                <span>Total Amount Due (PKR):</span>
                <span className="text-emerald-400 font-mono text-lg">
                  PKR {orderTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3.5 bg-[#10121a] border-t border-slate-300 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-stone-400">
            Assigned Outlet: <span className="text-white font-bold">{order.branchName || 'Main Branch'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-900 dark:text-white text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-white/10"
          >
            Close Viewer
          </button>
        </footer>
      </div>
    </div>
  );
};
