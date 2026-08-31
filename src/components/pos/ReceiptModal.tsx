import React from 'react';
import { Order } from '../../types';
import { X, Printer, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

import { useRestaurant } from '../../context/RestaurantContext';

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  const { setPrintQueueOrder } = useRestaurant();

  if (!order) return null;

  const handlePrint = () => {
    setPrintQueueOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const formattedDate = new Date(order.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static select-none">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col my-auto print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        {/* Modal Top Bar - Hidden during printing */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-bold text-white">Order Punched Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper Card */}
        <div className="p-6 bg-stone-950/60 print:bg-white print:p-4">
          <div
            id="thermal-receipt"
            className="bg-white text-stone-900 font-mono p-6 rounded-2xl shadow-md space-y-4 text-xs border border-stone-200 print:border-none print:shadow-none print:p-0 print:rounded-none"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-stone-300">
              <h2 className="text-lg font-black tracking-wider uppercase font-sans text-stone-950">White's Castle</h2>
              <p className="text-[11px] font-bold text-stone-700">Pizza, Fast Food & Grill</p>
              <p className="text-[10px] text-stone-500">Main Commercial Hub, Islamabad</p>
              <p className="text-[10px] text-stone-500">UAN: (051) 111-227-853 • NTN: #7391024-1</p>
            </div>

            {/* Receipt Meta */}
            <div className="flex justify-between text-[11px] text-stone-700 pb-2 border-b border-stone-200">
              <div>
                <p className="font-bold text-stone-950">Order: {order.orderNumber}</p>
                <p>Date: {formattedDate}</p>
                <p>Cashier: {order.cashierName || 'Staff'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold uppercase text-stone-950">{order.type.replace('_', ' ')}</p>
                {order.tableNumber && <p className="font-bold">Table: {order.tableNumber}</p>}
                <p>Term: {order.terminalId || 'POS-01'}</p>
              </div>
            </div>

            {/* Customer Details */}
            {order.customer?.name && (
              <div className="text-[11px] bg-stone-50 p-2 rounded border border-stone-200">
                <span className="font-bold block">Customer: {order.customer?.name}</span>
                {order.customer?.phone && <span className="block">Phone: {order.customer?.phone}</span>}
                {order.customer?.address && (
                  <span className="block text-[10px] text-stone-600 truncate mt-0.5">
                    Address: {order.customer?.address}
                  </span>
                )}
                {order.deliveryDriver && (
                  <span className="block text-[10px] font-bold text-stone-800 mt-1 uppercase border-t border-stone-200 pt-1">
                    RIDER: {order.deliveryDriver}
                  </span>
                )}
              </div>
            )}

            {/* Itemized Table */}
            <div className="space-y-2 py-2 border-b-2 border-dashed border-stone-300">
              <div className="flex justify-between font-bold text-stone-950 text-[11px] pb-1 border-b border-stone-200">
                <span>ITEM</span>
                <span>QTY x PRICE</span>
                <span>TOTAL</span>
              </div>

              {order.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between items-start text-stone-800">
                    <span className="font-medium max-w-[170px] truncate">{item.name}</span>
                    <span className="text-stone-600 text-[10px]">
                      {item.quantity} x Rs. {item.price.toFixed(0)}
                    </span>
                    <span className="font-bold">Rs. {(item.quantity * item.price).toFixed(0)}</span>
                  </div>
                  {item.customization && (
                    <p className="text-[9px] text-stone-500 italic pl-2">↳ {item.customization}</p>
                  )}
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="text-[9px] text-stone-500 pl-2">
                      {item.selectedOptions.map((opt, i) => (
                        <span key={i} className="mr-2">
                          + {opt.choice} ({opt.extraPrice > 0 ? `Rs. ${opt.extraPrice}` : 'inc'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Financial Totals */}
            <div className="space-y-1.5 text-stone-700 text-[11px] pt-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {order.subtotal.toFixed(0)}</span>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-Rs. {order.discount.toFixed(0)}</span>
                </div>
              )}

              {order.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Charges:</span>
                  <span>Rs. {order.deliveryFee.toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-stone-950 pt-2 border-t-2 border-stone-950">
                <span>TOTAL AMOUNT:</span>
                <span>Rs. {order.total.toFixed(0)}</span>
              </div>
            </div>

            {/* Payment Tender & Change Breakdown */}
            <div className="bg-stone-100 p-2.5 rounded-lg space-y-1 text-[11px] border border-stone-200">
              <div className="flex justify-between font-bold text-stone-900">
                <span className="uppercase">Paid via {order.paymentMethod.replace('_', ' ')}:</span>
                <span>Rs. {order.total.toFixed(0)}</span>
              </div>

              {order.amountTendered !== undefined && (
                <div className="flex justify-between text-stone-600">
                  <span>Amount Tendered:</span>
                  <span>Rs. {order.amountTendered.toFixed(0)}</span>
                </div>
              )}

              {order.changeGiven !== undefined && order.changeGiven > 0 && (
                <div className="flex justify-between font-bold text-emerald-800 text-xs pt-1 border-t border-stone-200">
                  <span>CHANGE RETURNED:</span>
                  <span>Rs. {order.changeGiven.toFixed(0)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer Thank You */}
            <div className="text-center pt-3 space-y-2 border-t-2 border-dashed border-stone-300">
              <p className="text-[10px] text-stone-600 font-sans">Thank you for dining with White's Castle!</p>
              <div className="font-mono text-xs tracking-widest text-stone-600 bg-stone-100 py-1 rounded">
                * * * {order.orderNumber} * * *
              </div>
              <p className="text-[9px] text-stone-400">Wifi: WhitesCastleGuest • Pass: castlepizza</p>
            </div>
          </div>
        </div>

        {/* Modal Actions - Hidden during printing */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
          >
            Done (Esc)
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-900/30 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
