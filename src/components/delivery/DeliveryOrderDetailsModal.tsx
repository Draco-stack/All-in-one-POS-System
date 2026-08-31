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
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';

interface DeliveryOrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
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
  const [selectedRider, setSelectedRider] = useState<string>(order?.riderName || order?.deliveryDriver || '');
  const [riderPhoneInput, setRiderPhoneInput] = useState<string>(order?.riderPhone || '0315-9988771');
  const [riderVehicleInput, setRiderVehicleInput] = useState<string>(order?.riderVehicle || 'Honda 125 (LEA-4891)');
  const [isEditingRider, setIsEditingRider] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setSelectedRider(order.riderName || order.deliveryDriver || '');
      setRiderPhoneInput(order.riderPhone || '0315-9988771');
      setRiderVehicleInput(order.riderVehicle || 'Honda 125 (LEA-4891)');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const getSlaBadge = (mins?: number) => {
    const elapsed = mins ?? order.deliveryElapsedMinutes ?? 30;
    if (elapsed > 45) {
      return { bg: 'bg-[#b71c1c]', text: 'text-white', label: `${elapsed}m (Delayed / High SLA)` };
    }
    if (elapsed >= 30) {
      return { bg: 'bg-[#d97706]', text: 'text-stone-950', label: `${elapsed}m (Moderate)` };
    }
    return { bg: 'bg-[#0284c7]', text: 'text-white', label: `${elapsed}m (On Time)` };
  };

  const sla = getSlaBadge();

  const handleSaveRider = () => {
    if (selectedRider && order) {
      onAssignRider(order.id, selectedRider, riderPhoneInput, riderVehicleInput);
      setIsEditingRider(false);
      showToast(`✓ Rider ${selectedRider} assigned to Order #${order.orderNumber || order.id}`);
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

  const statusOptions: { value: OrderStatus; label: string; bg: string }[] = [
    { value: 'in_kitchen', label: 'In Kitchen (Cooking)', bg: 'bg-blue-600' },
    { value: 'ready', label: 'Ready for Pickup', bg: 'bg-teal-600' },
    { value: 'dispatched', label: 'On The Way (Dispatched)', bg: 'bg-amber-600' },
    { value: 'delivered', label: 'Delivered (Completed)', bg: 'bg-emerald-600' },
    { value: 'cancelled', label: 'Cancelled / Void', bg: 'bg-red-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200 print:hidden">
      <div className="bg-[#1b1c2e] border border-stone-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#141524] border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Order #{order.orderNumber || order.id}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${sla.bg} ${sla.text}`}>
                  {order.deliveryElapsedMinutes ? `${order.deliveryElapsedMinutes}m` : 'Live'}
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-xs font-mono">
                  {order.branchName || order.outlet || 'Main Branch'}
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono mt-0.5">
                Punched at {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '21:52'} • Source: <span className="text-stone-300 font-semibold">{order.source || order.sourceChannel || 'Call Center'}</span> • Puncher: <span className="text-emerald-400 font-semibold">{order.punchedBy || order.cashierName || 'Staff'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintSlip}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition flex items-center gap-1.5 border border-stone-700 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Status Quick Bar */}
          <div className="bg-[#222438] p-4 rounded-xl border border-stone-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider block mb-1">
                Active Order Status
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white capitalize flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  {order.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-stone-400">
                  (Payment: <span className={order.paymentStatus === 'paid' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{order.paymentStatus.toUpperCase()} - {order.paymentMethod.toUpperCase()}</span>)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdateStatus(order.id, opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    order.status === opt.value
                      ? `${opt.bg} text-white shadow-lg ring-2 ring-white/20`
                      : 'bg-stone-800/80 hover:bg-stone-700 text-stone-300 border border-stone-700/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer & Delivery Destination Card */}
            <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer & Destination Details
                </h3>
                <span className="text-[11px] font-mono text-stone-400">
                  ID: {order.customer?.id || 'CUST-WALK'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-stone-800/40">
                  <span className="text-stone-400">Customer Name:</span>
                  <span className="font-bold text-white text-sm">{order.customer?.name || 'Walk-in Customer'}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-stone-800/40">
                  <span className="text-stone-400">Phone Contact:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{order.customer?.phone || 'N/A'}</span>
                    {order.customer?.phone && (
                      <>
                        <a
                          href={`tel:${order.customer.phone}`}
                          title="Direct Phone Call"
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-emerald-400 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp Chat"
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-emerald-400 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="py-1 border-b border-stone-800/40">
                  <span className="text-stone-400 block mb-1">Delivery Address:</span>
                  <p className="text-stone-200 bg-[#161726] p-2.5 rounded-lg border border-stone-800 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{order.deliveryAddress || order.customer?.address || 'Main Delivery Sector'}</span>
                  </p>
                </div>

                {order.customer?.deliveryNotes && (
                  <div className="py-1">
                    <span className="text-amber-400 font-bold block mb-1">Special Delivery Notes:</span>
                    <p className="text-amber-200/90 bg-amber-950/20 p-2 rounded-lg border border-amber-900/40 italic">
                      "{order.customer.deliveryNotes}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rider & Dispatch Assignment Card */}
            <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Delivery Rider Assignment
                </h3>
                <button
                  onClick={() => setIsEditingRider(!isEditingRider)}
                  className="text-xs text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditingRider ? 'Cancel' : 'Change Rider'}
                </button>
              </div>

              {isEditingRider ? (
                <div className="space-y-3 bg-[#161726] p-3 rounded-lg border border-stone-800 text-xs">
                  <div>
                    <label className="block text-stone-400 mb-1 font-bold">Select Available Rider:</label>
                    <select
                      value={selectedRider}
                      onChange={(e) => setSelectedRider(e.target.value)}
                      className="w-full bg-[#222438] border border-stone-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                    >
                      <option value="">-- Choose Rider --</option>
                      {deliveryDrivers.map((d) => (
                        <option key={d} value={d}>
                          {d} (Active Rider)
                        </option>
                      ))}
                      <option value="Carlos Rodriguez">Carlos Rodriguez</option>
                      <option value="Samir Khan">Samir Khan</option>
                      <option value="Marcus Vance">Marcus Vance</option>
                      <option value="David Miller">David Miller</option>
                      <option value="Elena Scott">Elena Scott</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-400 mb-1">Rider Phone:</label>
                    <input
                      type="text"
                      value={riderPhoneInput}
                      onChange={(e) => setRiderPhoneInput(e.target.value)}
                      className="w-full bg-[#222438] border border-stone-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-400 mb-1">Rider Vehicle / Bike Plate:</label>
                    <input
                      type="text"
                      value={riderVehicleInput}
                      onChange={(e) => setRiderVehicleInput(e.target.value)}
                      className="w-full bg-[#222438] border border-stone-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <button
                    onClick={handleSaveRider}
                    className="w-full py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs transition cursor-pointer"
                  >
                    Confirm & Save Rider Assignment
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-stone-800/40">
                    <span className="text-stone-400">Assigned Rider:</span>
                    <span className="font-bold text-white text-sm">
                      {order.riderName || order.deliveryDriver || 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-stone-800/40">
                    <span className="text-stone-400">Rider Contact:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-stone-300">{order.riderPhone || riderPhoneInput}</span>
                      <a
                        href={`tel:${order.riderPhone || riderPhoneInput}`}
                        className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-blue-400"
                        title="Call Rider"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-stone-800/40">
                    <span className="text-stone-400">Vehicle / Bike:</span>
                    <span className="font-semibold text-stone-300">
                      {order.riderVehicle || riderVehicleInput}
                    </span>
                  </div>

                  <div className="p-3 bg-[#161726] rounded-lg border border-stone-800 text-[11px] text-stone-400 flex items-center gap-2">
                    <NavigationIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rider GPS live tracking connected • Estimated dispatch distance: 3.8 km</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Delivery Timeline Stepper */}
          <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Live Order & Dispatch Timeline
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
              <div className="p-2.5 rounded-lg bg-[#161726] border border-emerald-500/30 text-center">
                <span className="w-5 h-5 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1">
                  ✓
                </span>
                <p className="text-[11px] font-bold text-white">1. Punched</p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">21:52</p>
              </div>

              <div className={`p-2.5 rounded-lg border text-center ${
                ['in_kitchen', 'ready', 'dispatched', 'delivered'].includes(order.status)
                  ? 'bg-[#161726] border-emerald-500/30'
                  : 'bg-[#161726]/40 border-stone-800 opacity-60'
              }`}>
                <span className="w-5 h-5 mx-auto rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mb-1">
                  🍳
                </span>
                <p className="text-[11px] font-bold text-white">2. Kitchen Prep</p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">21:55</p>
              </div>

              <div className={`p-2.5 rounded-lg border text-center ${
                ['ready', 'dispatched', 'delivered'].includes(order.status)
                  ? 'bg-[#161726] border-emerald-500/30'
                  : 'bg-[#161726]/40 border-stone-800 opacity-60'
              }`}>
                <span className="w-5 h-5 mx-auto rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs mb-1">
                  📦
                </span>
                <p className="text-[11px] font-bold text-white">3. Ready</p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">22:10</p>
              </div>

              <div className={`p-2.5 rounded-lg border text-center ${
                ['dispatched', 'delivered'].includes(order.status)
                  ? 'bg-[#161726] border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-[#161726]/40 border-stone-800 opacity-60'
              }`}>
                <span className="w-5 h-5 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs mb-1">
                  🛵
                </span>
                <p className="text-[11px] font-bold text-white">4. On The Way</p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">22:15</p>
              </div>

              <div className={`p-2.5 rounded-lg border text-center ${
                order.status === 'delivered'
                  ? 'bg-[#161726] border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : 'bg-[#161726]/40 border-stone-800 opacity-60'
              }`}>
                <span className="w-5 h-5 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1">
                  🏠
                </span>
                <p className="text-[11px] font-bold text-white">5. Delivered</p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">{order.status === 'delivered' ? '22:40' : 'Pending'}</p>
              </div>
            </div>
          </div>

          {/* Itemized Order List & Financial Breakdown */}
          <div className="bg-[#222438] p-5 rounded-xl border border-stone-800 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Itemized Items & Bill Breakdown
            </h3>

            <div className="divide-y divide-stone-800/80 border border-stone-800/80 rounded-xl overflow-hidden bg-[#161726]">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-[#1f2136] transition">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-stone-800 text-white font-bold flex items-center justify-center text-xs">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-bold text-white">{item.name}</p>
                        {item.flavor && (
                          <span className="text-[11px] text-amber-400 block font-medium">
                            Flavor: {item.flavor}
                          </span>
                        )}
                        {item.itemNote && (
                          <span className="text-[11px] text-stone-400 italic block">
                            Note: {item.itemNote}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-stone-200">
                      PKR {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-stone-400 text-xs">
                  1x Standard Delivery Combo
                </div>
              )}
            </div>

            {/* Bill Summary */}
            <div className="p-4 bg-[#161726] rounded-xl border border-stone-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal Items:</span>
                <span className="font-mono font-semibold text-stone-200">
                  PKR {order.subtotal?.toLocaleString() || (order.total - 100).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Delivery Dispatch Fee:</span>
                <span className="font-mono font-semibold text-stone-200">
                  PKR {order.deliveryFee?.toLocaleString() || '100'}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Promotional Discount:</span>
                  <span className="font-mono font-semibold">- PKR {order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-stone-800 pt-2 flex justify-between items-center text-sm font-black text-white">
                <span>Grand Total (PKR):</span>
                <span className="text-emerald-400 font-mono text-base">
                  PKR {order.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#141524] border-t border-stone-800 flex items-center justify-between">
          <div className="text-xs text-stone-400">
            Assigned Branch: <span className="text-white font-bold">{order.branchName || 'Main'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
