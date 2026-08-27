import React, { useState } from 'react';
import { Order } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, Printer, Truck, Phone, MapPin, UserCheck, Plus } from 'lucide-react';

interface DeliveryDriverSlipModalProps {
  order: Order | null;
  onClose: () => void;
}

export const DeliveryDriverSlipModal: React.FC<DeliveryDriverSlipModalProps> = ({ order, onClose }) => {
  const { deliveryDrivers, addDeliveryDriver, assignDeliveryDriver, getRiderStats } = useRestaurant();
  const [selectedDriver, setSelectedDriver] = useState<string>(order?.deliveryDriver || deliveryDrivers[0] || 'Rider 1 (Farhan)');
  const [newDriverName, setNewDriverName] = useState('');
  const [showAddDriver, setShowAddDriver] = useState(false);

  React.useEffect(() => {
    if (order) {
      setSelectedDriver(order.deliveryDriver || deliveryDrivers[0] || 'Rider 1 (Farhan)');
      setNewDriverName('');
      setShowAddDriver(false);
    }
  }, [order, deliveryDrivers]);

  if (!order) return null;

  const handleDriverChange = async (driverName: string) => {
    setSelectedDriver(driverName);
    await assignDeliveryDriver(order.id, driverName);
  };

  const handleAddNewDriver = async () => {
    if (!newDriverName.trim()) return;
    const name = newDriverName.trim();
    await addDeliveryDriver(name);
    await assignDeliveryDriver(order.id, name);
    setSelectedDriver(name);
    setNewDriverName('');
    setShowAddDriver(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(order.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCashOnDelivery = order.paymentStatus !== 'paid' || (order.paymentMethod as string) === 'unpaid';

  return (
    <div id="delivery-slip-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static select-none">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-auto print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        {/* Modal Controls Bar - Hidden in Print */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-[#00897b]">
            <Truck className="w-5 h-5" />
            <span className="text-sm font-bold text-white">Delivery Driver Dispatch Slip</span>
            <span className="text-xs bg-[#00897b]/20 text-[#00897b] font-mono px-2 py-0.5 rounded border border-[#00897b]/30">
              {order.orderNumber}
            </span>
          </div>
          <button
            id="close-driver-slip-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Driver Assignment Toolbar - Hidden in Print */}
        <div className="p-3 bg-stone-950/80 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 print:hidden text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-stone-400" />
            <span className="text-stone-300 font-semibold">Assign Driver:</span>
            <select
              id="driver-select-dropdown"
              value={selectedDriver}
              onChange={(e) => handleDriverChange(e.target.value)}
              className="bg-stone-900 text-teal-300 font-semibold px-2.5 py-1.5 rounded-lg border border-stone-700 focus:outline-none focus:border-teal-500 max-w-[260px] truncate"
            >
              {deliveryDrivers.map((driver) => {
                const stats = getRiderStats(driver);
                return (
                  <option key={driver} value={driver}>
                    {driver} {stats.totalAssigned > 0 ? `(${stats.totalAssigned} ord • ✓${stats.delivered} | ✗${stats.cancelled})` : '(0 orders)'}
                  </option>
                );
              })}
            </select>
          </div>

          {!showAddDriver ? (
            <button
              id="add-new-driver-btn"
              onClick={() => setShowAddDriver(true)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg flex items-center gap-1 font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Driver</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                placeholder="Driver Name"
                className="bg-stone-900 text-white px-2 py-1 rounded border border-stone-700 text-xs w-32 focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={handleAddNewDriver}
                className="px-2 py-1 bg-[#00897b] text-white font-bold rounded hover:bg-[#00796b] cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddDriver(false)}
                className="px-2 py-1 bg-stone-800 text-stone-400 rounded hover:bg-stone-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Printable Driver Thermal Slip */}
        <div className="p-6 bg-stone-950/60 print:bg-white print:p-2">
          <div
            id="driver-thermal-slip"
            className="bg-white text-stone-900 font-mono p-6 rounded-xl shadow-md space-y-4 text-xs border border-stone-300 print:border-none print:shadow-none print:p-0 print:rounded-none"
          >
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-stone-400">
              <div className="inline-block bg-stone-950 text-white font-sans font-black text-xs px-3 py-1 rounded tracking-wider uppercase">
                *** DELIVERY DRIVER SLIP ***
              </div>
              <h2 className="text-base font-black tracking-wider uppercase font-sans text-stone-950 pt-1">White's Castle</h2>
              <p className="text-[10px] text-stone-600">Dispatch UAN: (051) 111-227-853</p>
            </div>

            {/* Prominent Assigned Driver Box */}
            <div className="bg-stone-100 p-2.5 rounded-lg border-2 border-stone-950 text-center">
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Assigned Rider</span>
              <span className="text-base font-black text-stone-950 uppercase tracking-wide">{selectedDriver || 'Unassigned'}</span>
            </div>

            {/* Slip Meta Info */}
            <div className="grid grid-cols-2 text-[11px] pb-2 border-b border-stone-200">
              <div>
                <span className="text-stone-500">Order:</span> <strong className="text-stone-950">{order.orderNumber}</strong>
              </div>
              <div className="text-right">
                <span className="text-stone-500">Time:</span> <strong className="text-stone-950">{formattedDate}</strong>
              </div>
            </div>

            {/* Customer & Address Details (Large & High Contrast) */}
            <div className="bg-amber-50 p-3 rounded-lg border-2 border-amber-300 space-y-2">
              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase block">Customer Name:</span>
                <span className="text-sm font-black text-stone-950">{order.customer?.name || 'Walk-in / Customer'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase block">Customer Phone:</span>
                <span className="text-sm font-black text-stone-950">{order.customer?.phone || 'No Phone Entered'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase block">Delivery Address:</span>
                <p className="text-xs font-bold text-stone-950 bg-white p-2 rounded border border-amber-200 leading-relaxed">
                  {order.customer?.address || 'No Delivery Address Provided'}
                </p>
              </div>

              {((order.customer as any)?.notes || order.notes) && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-amber-900 uppercase block">Delivery Instructions:</span>
                  <p className="text-[11px] font-semibold text-stone-800 italic bg-amber-100/50 p-1.5 rounded">
                    "{(order.customer as any)?.notes || order.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Itemized Bag Checklist */}
            <div className="space-y-1.5 py-2 border-b-2 border-dashed border-stone-400">
              <div className="flex justify-between font-black text-stone-950 text-[11px] pb-1 border-b border-stone-300 uppercase">
                <span>Items in Rider Bag</span>
                <span>Qty</span>
              </div>

              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start text-stone-900 py-0.5">
                  <div className="space-y-0.5 max-w-[260px]">
                    <span className="font-bold">[ ] {item.name}</span>
                    {item.customization && <p className="text-[10px] text-stone-600 pl-4 italic">↳ {item.customization}</p>}
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="text-[10px] text-stone-600 pl-4">
                        {item.selectedOptions.map((opt, i) => (
                          <span key={i} className="mr-2">
                            + {opt.choice}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-sm bg-stone-100 px-2 py-0.5 rounded border border-stone-300">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Amount & Collection Instruction */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-bold text-stone-700">
                <span>Subtotal:</span>
                <span>Rs. {order.subtotal.toFixed(0)}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-xs font-bold text-stone-700">
                  <span>Delivery Charges:</span>
                  <span>Rs. {order.deliveryFee.toFixed(0)}</span>
                </div>
              )}

              {/* Huge Total Amount Box */}
              <div
                className={`p-3 rounded-lg border-2 text-center ${
                  isCashOnDelivery
                    ? 'bg-red-50 border-red-500 text-red-950'
                    : 'bg-emerald-50 border-emerald-500 text-emerald-950'
                }`}
              >
                <span className="text-[10px] uppercase font-black tracking-wider block">
                  {isCashOnDelivery ? '⚠️ COLLECT CASH ON DELIVERY (COD)' : '✅ ORDER IS PRE-PAID (DO NOT COLLECT CASH)'}
                </span>
                <span className="text-xl font-black block mt-0.5">Rs. {order.total.toFixed(0)}</span>
                <span className="text-[10px] font-semibold text-stone-600 block mt-0.5">
                  Payment: {order.paymentMethod.toUpperCase()} • Status: {order.paymentStatus.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Driver Signature Line */}
            <div className="pt-4 text-center space-y-3">
              <div className="border-b border-stone-400 w-3/4 mx-auto mt-4"></div>
              <p className="text-[9px] text-stone-500 uppercase">Customer Receiving Signature</p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions - Hidden in Print */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between print:hidden">
          <button
            id="dismiss-driver-slip-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer transition"
          >
            Close
          </button>
          <button
            id="print-driver-slip-btn"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-900/30 cursor-pointer transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Delivery Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
