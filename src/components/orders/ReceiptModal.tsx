import React from 'react';
import { X, Printer } from 'lucide-react';
import { Order } from '../../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const rawType = (order.type || order.orderType || 'dine_in').toLowerCase();
  const isDelivery = rawType === 'delivery';
  const isTakeaway = rawType === 'takeaway';
  const branchName = order.branchName || order.outlet || 'Gulberg Branch';
  const riderName = order.deliveryDriver || (isDelivery ? 'Unassigned Rider' : isTakeaway ? 'Self Pickup / Counter' : 'N/A');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-300 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="p-3 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">Customer Receipt #{order.orderNumber}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Thermal Slip Area */}
        <div className="p-6 overflow-y-auto bg-stone-50 text-stone-900 font-mono text-xs space-y-3 print:bg-white print:p-0">
          <div className="text-center space-y-1 border-b border-dashed border-stone-300 pb-3">
            <h2 className="font-black text-base tracking-widest text-black uppercase">WHITE'S CASTLE</h2>
            <div className="font-bold text-xs uppercase bg-black text-white px-2 py-0.5 inline-block rounded">
              {branchName}
            </div>
            {(isDelivery || isTakeaway) && (
              <div className="font-bold text-xs uppercase border border-black py-0.5 px-2 mt-1">
                *** {isDelivery ? 'DELIVERY BILL' : 'TAKEAWAY BILL'} ***
              </div>
            )}
            <p className="text-[10px] text-stone-500 pt-1">UAN: (051) 111-227-853 | NTN: #7391024-1</p>
          </div>

          <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-2">
            <div className="flex justify-between">
              <span>Order #:</span>
              <span className="font-bold">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Branch:</span>
              <span className="font-bold uppercase">{branchName}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Order Type:</span>
              <span className="uppercase font-bold">{rawType.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{order.cashierName || 'POS Terminal'}</span>
            </div>
            {order.tableNumber && (
              <div className="flex justify-between">
                <span>Table:</span>
                <span>{order.tableNumber}</span>
              </div>
            )}
          </div>

          {/* Customer & Rider Details Box */}
          {(isDelivery || isTakeaway || order.customer?.name || order.deliveryDriver) && (
            <div className="border border-stone-400 p-2 bg-stone-100 rounded text-[11px] space-y-1">
              {(isDelivery || order.deliveryDriver) && (
                <div className="border-b border-dashed border-stone-300 pb-1">
                  <span className="font-bold uppercase block text-[9px] text-stone-500">Rider / Delivery Driver:</span>
                  <span className="font-black text-xs uppercase block text-stone-900">{riderName}</span>
                </div>
              )}

              <div>
                <span className="font-bold uppercase block text-[9px] text-stone-500">Customer Name:</span>
                <span className="font-bold text-xs block text-stone-900">{order.customer?.name || 'Walk-in Customer'}</span>
              </div>

              {order.customer?.phone && (
                <div>
                  <span className="font-bold uppercase block text-[9px] text-stone-500">Customer Phone:</span>
                  <span className="font-bold text-xs block text-stone-900">{order.customer.phone}</span>
                </div>
              )}

              {(isDelivery || order.customer?.address) && (
                <div>
                  <span className="font-bold uppercase block text-[9px] text-stone-500">Delivery Address:</span>
                  <p className="font-semibold text-xs leading-tight bg-white p-1 border border-stone-300 rounded text-stone-900">
                    {order.customer?.address || 'No Address Provided'}
                  </p>
                </div>
              )}

              {(order.customer?.deliveryNotes || order.notes) && (
                <div>
                  <span className="font-bold uppercase block text-[9px] text-stone-500">Order Notes:</span>
                  <p className="italic text-[10px] text-stone-700">{order.customer?.deliveryNotes || order.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-1.5 border-b border-dashed border-stone-300 pb-3">
            <div className="flex justify-between font-bold text-[11px] border-b border-stone-300 pb-1">
              <span>Item Description</span>
              <span>Qty x Rate</span>
              <span>Total</span>
            </div>
            {order.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-stone-900 truncate max-w-[160px]">{it.name}</span>
                  <span>{it.quantity} x {it.price}</span>
                  <span className="font-bold">Rs. {(it.price * it.quantity).toFixed(0)}</span>
                </div>
                {it.flavor && (
                  <p className="text-[10px] text-stone-600 pl-2">Flavor: {it.flavor}</p>
                )}
                {it.customization && (
                  <p className="text-[10px] text-stone-600 italic pl-2">↳ {it.customization}</p>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-[11px] pt-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rs. {order.subtotal.toFixed(0)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount:</span>
                <span>-Rs. {order.discount.toFixed(0)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between font-bold">
                <span>Delivery Fee:</span>
                <span>Rs. {order.deliveryFee.toFixed(0)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between">
                <span>Sales Tax (16%):</span>
                <span>Rs. {order.tax.toFixed(0)}</span>
              </div>
            )}
            {order.tip && order.tip > 0 ? (
              <div className="flex justify-between">
                <span>Extra Charges:</span>
                <span>Rs. {order.tip.toFixed(0)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-black text-sm text-stone-900 pt-1 border-t-2 border-stone-900">
              <span>TOTAL BILL:</span>
              <span>Rs. {order.total.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-stone-600 pt-1">
              <span>Payment Mode:</span>
              <span className="uppercase font-bold">{order.paymentMethod}</span>
            </div>
          </div>

          <div className="text-center pt-3 border-t border-dashed border-stone-300 text-[10px] text-stone-500">
            <p>*** THANK YOU FOR ORDERING WITH WHITE'S CASTLE ***</p>
            <p className="text-[9px]">Branch: {branchName}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
