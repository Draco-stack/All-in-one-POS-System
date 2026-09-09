import React, { useState } from 'react';
import { X, Printer, ChefHat, Receipt } from 'lucide-react';
import { Order } from '../../types';
import { MasterPOSLogo } from '../common/MasterPOSLogo';

interface ReceiptModalProps {
  isOpen?: boolean;
  onClose: () => void;
  order: Order | null;
  initialMode?: 'receipt' | 'kot';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen = true,
  onClose,
  order,
  initialMode = 'receipt',
}) => {
  const [printMode, setPrintMode] = useState<'receipt' | 'kot'>(initialMode);

  React.useEffect(() => {
    if (isOpen) {
      setPrintMode(initialMode);
    }
  }, [isOpen, initialMode]);

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
        <div className="p-3 bg-white dark:bg-stone-900 text-slate-900 dark:text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {printMode === 'receipt' ? (
              <Receipt className="w-4 h-4 text-emerald-400" />
            ) : (
              <ChefHat className="w-4 h-4 text-amber-400" />
            )}
            <h3 className="font-bold text-sm">
              {printMode === 'receipt' ? 'Customer Receipt' : 'Kitchen Order Ticket (KOT)'} #{order.orderNumber}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="bg-stone-100 border-b border-stone-200 p-1.5 flex gap-1 print:hidden shrink-0">
          <button
            onClick={() => setPrintMode('receipt')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              printMode === 'receipt'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-300'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Customer Receipt
          </button>
          <button
            onClick={() => setPrintMode('kot')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              printMode === 'kot'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-300'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5 text-amber-600" />
            Kitchen Slip (KOT)
          </button>
        </div>

        {/* Printable Slip Area */}
        <div
          id="thermal-receipt-modal-content"
          className="p-6 overflow-y-auto bg-stone-50 text-stone-900 font-mono text-xs space-y-3 print:bg-white print:p-0"
        >
          {/* Custom style to override any system-wide body hidden print styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-receipt-modal-content, #thermal-receipt-modal-content * {
                visibility: visible !important;
              }
              #thermal-receipt-modal-content {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                max-width: 80mm !important;
                padding: 0mm !important;
                margin: 0mm !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `}</style>
          {printMode === 'kot' ? (
            /* Kitchen KOT Slip */
            <div className="space-y-3">
              <div className="text-center space-y-1 border-b-2 border-dashed border-slate-200 dark:border-stone-800 pb-2">
                <h2 className="font-black text-xl tracking-wider uppercase text-black">*** K.O.T. ***</h2>
                <div className="text-sm font-black uppercase bg-black text-white px-2 py-1 inline-block rounded">
                  {rawType.replace('_', ' ').toUpperCase()} {order.tableNumber ? `• TABLE ${order.tableNumber}` : ''}
                </div>
                <p className="text-xs font-bold text-stone-800 pt-1">
                  ORDER #{order.orderNumber}
                </p>
              </div>

              <div className="space-y-1 text-xs border-b border-dashed border-stone-400 pb-2">
                <div className="flex justify-between">
                  <span className="text-stone-600">Time:</span>
                  <span className="font-bold">{new Date(order.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Branch:</span>
                  <span className="font-bold uppercase">{branchName}</span>
                </div>
                {order.serverName && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Server:</span>
                    <span className="font-bold">{order.serverName}</span>
                  </div>
                )}
                {order.customer?.name && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Guest:</span>
                    <span className="font-bold">{order.customer.name}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="py-2 border-b-2 border-dashed border-slate-200 dark:border-stone-800 space-y-2">
                <div className="flex justify-between text-xs font-black uppercase border-b border-stone-300 pb-1">
                  <span>Item & Modifiers</span>
                  <span className="text-right">Qty</span>
                </div>

                {order.items.map((it, idx) => (
                  <div key={idx} className="pt-1">
                    <div className="flex justify-between items-baseline font-bold text-sm text-black">
                      <span className="leading-snug">{it.name}</span>
                      <span className="text-base font-black px-1.5 py-0.5 bg-stone-200 rounded border border-stone-400 shrink-0 ml-2">
                        {it.quantity}x
                      </span>
                    </div>
                    {it.flavor && (
                      <div className="text-xs text-stone-700 pl-2">
                        • Flavor: <strong className="text-black">{it.flavor}</strong>
                      </div>
                    )}
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div className="text-xs text-stone-700 pl-2">
                        {it.modifiers.map((mod, mIdx) => (
                          <div key={mIdx}>
                            + {mod.name} {mod.price > 0 ? `(PKR ${mod.price})` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {it.selectedOptions && it.selectedOptions.length > 0 && (
                      <div className="text-xs text-stone-700 pl-2">
                        {it.selectedOptions.map((opt, oIdx) => (
                          <div key={oIdx}>
                            ↳ {opt.choice || opt.name || opt.label} {opt.extraPrice > 0 ? `(PKR ${opt.extraPrice})` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {it.customization && (
                      <div className="text-xs text-stone-700 pl-2">
                        • {it.customization}
                      </div>
                    )}
                    {(it.itemNote || it.notes) && (
                      <div className="text-xs font-bold text-red-700 italic pl-2">
                        * Special: {it.itemNote || it.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(order.notes || order.customer?.deliveryNotes) && (
                <div className="p-2 border border-black bg-stone-100 rounded text-xs">
                  <span className="font-black uppercase block text-[10px] text-red-700">SPECIAL INSTRUCTIONS:</span>
                  <p className="font-bold text-stone-900 italic mt-0.5">
                    {order.notes || order.customer?.deliveryNotes}
                  </p>
                </div>
              )}

              <div className="text-center pt-2 text-[10px] text-slate-400 dark:text-stone-500 font-bold border-t border-dashed border-stone-300">
                [END OF KITCHEN TICKET]
              </div>
            </div>
          ) : (
            /* Customer Receipt */
            <>
              <div className="text-center space-y-1 border-b border-dashed border-stone-300 pb-3">
                <div className="flex justify-center mb-1">
                  <MasterPOSLogo variant="receipt" size={32} />
                </div>
                <div className="font-bold text-xs uppercase bg-black text-white px-2 py-0.5 inline-block rounded">
                  {branchName}
                </div>
                {(isDelivery || isTakeaway) && (
                  <div className="font-bold text-xs uppercase border border-black py-0.5 px-2 mt-1">
                    *** {isDelivery ? 'DELIVERY BILL' : 'TAKEAWAY BILL'} ***
                  </div>
                )}
                <p className="text-[10px] text-slate-400 dark:text-stone-500 pt-1">UAN: (051) 111-227-853 | NTN: #7391024-1</p>
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
                    <span className="font-bold">{order.tableNumber}</span>
                  </div>
                )}
              </div>

              {/* Customer & Rider Details Box */}
              {(isDelivery || isTakeaway || order.customer?.name || order.deliveryDriver) && (
                <div className="border border-stone-400 p-2 bg-stone-100 rounded text-[11px] space-y-1">
                  {(isDelivery || order.deliveryDriver) && (
                    <div className="border-b border-dashed border-stone-300 pb-1">
                      <span className="font-bold uppercase block text-[9px] text-slate-400 dark:text-stone-500">Rider / Delivery Driver:</span>
                      <span className="font-black text-xs uppercase block text-stone-900">{riderName}</span>
                    </div>
                  )}

                  <div>
                    <span className="font-bold uppercase block text-[9px] text-slate-400 dark:text-stone-500">Customer Name:</span>
                    <span className="font-bold text-xs block text-stone-900">{order.customer?.name || 'Walk-in Customer'}</span>
                  </div>

                  {order.customer?.phone && (
                    <div>
                      <span className="font-bold uppercase block text-[9px] text-slate-400 dark:text-stone-500">Customer Phone:</span>
                      <span className="font-bold text-xs block text-stone-900">{order.customer.phone}</span>
                    </div>
                  )}

                  {(isDelivery || order.customer?.address) && (
                    <div>
                      <span className="font-bold uppercase block text-[9px] text-slate-400 dark:text-stone-500">Delivery Address:</span>
                      <p className="font-semibold text-xs leading-tight bg-white p-1 border border-stone-300 rounded text-stone-900">
                        {order.customer?.address || 'No Address Provided'}
                      </p>
                    </div>
                  )}

                  {(order.customer?.deliveryNotes || order.notes) && (
                    <div>
                      <span className="font-bold uppercase block text-[9px] text-slate-400 dark:text-stone-500">Order Notes:</span>
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
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div className="text-[10px] text-stone-600 pl-2">
                        {it.modifiers.map((mod, mIdx) => (
                          <div key={mIdx}>
                            + {mod.name} {mod.price > 0 ? `(PKR ${mod.price})` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {it.customization && (
                      <p className="text-[10px] text-stone-600 italic pl-2">↳ {it.customization}</p>
                    )}
                    {(it.itemNote || it.notes) && (
                      <p className="text-[10px] text-red-700 font-bold italic pl-2">↳ * Special: {it.itemNote || it.notes}</p>
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

              <div className="text-center pt-3 border-t border-dashed border-stone-300 text-[10px] text-slate-400 dark:text-stone-500">
                <p>*** THANK YOU FOR ORDERING WITH MASTER POS ***</p>
                <p className="text-[9px]">Branch: {branchName}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white border-t border-stone-200 flex justify-end gap-2 shrink-0">
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
            {printMode === 'kot' ? 'Print KOT Slip' : 'Print Customer Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};
