import React, { useEffect } from 'react';
import { Order } from '../../types';
import QRCode from 'react-qr-code';
import { useRestaurant } from '../../context/RestaurantContext';
import { connectAndKickDrawer } from '../../utils/hardware';

export const ThermalReceipt: React.FC<{ order: Order | null }> = ({ order }) => {
  const { setPrintQueueOrder } = useRestaurant();

  useEffect(() => {
    // Attempt Web Serial API drawer kick concurrently with the print dialog
    if (order) {
      connectAndKickDrawer().catch(() => {});
    }

    const handleAfterPrint = () => {
      setPrintQueueOrder(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [setPrintQueueOrder, order]);

  if (!order) return null;

  const date = new Date(order.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rawType = (order.type || order.orderType || 'dine_in').toLowerCase();
  const isDelivery = rawType === 'delivery';
  const isTakeaway = rawType === 'takeaway';
  const branchName = order.branchName || order.outlet || 'Gulberg Branch';
  const riderName = order.deliveryDriver || (isDelivery ? 'Unassigned Rider' : isTakeaway ? 'Self Pickup / Counter' : 'N/A');

  return (
    <div className="hidden print:block text-black bg-white font-mono" style={{ width: '280px', margin: '0 auto', fontSize: '12px' }}>
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="font-black text-xl uppercase mb-0.5 tracking-wider">WHITE'S CASTLE</h1>
        <div className="font-bold text-xs uppercase bg-black text-white px-2 py-0.5 my-1 inline-block">
          {branchName}
        </div>
        {(isDelivery || isTakeaway) && (
          <div className="font-bold text-xs uppercase border-2 border-black py-0.5 px-2 mt-1">
            *** {isDelivery ? 'DELIVERY BILL' : 'TAKEAWAY BILL'} ***
          </div>
        )}
        <p className="text-[10px] mt-1">UAN: (051) 111-227-853 | NTN: #7391024-1</p>
      </div>

      {/* Order Meta */}
      <div className="mb-3 border-b border-black pb-2 border-dashed text-[11px]">
        <div className="flex justify-between font-bold">
          <span>Order #: {order.orderNumber}</span>
          <span className="uppercase">{rawType.replace('_', ' ')}</span>
        </div>
        <p>Branch: <strong className="uppercase">{branchName}</strong></p>
        <p>Date: {date}</p>
        <p>Cashier: {order.cashierName || 'POS Terminal'}</p>
        {order.tableNumber && <p>Table: {order.tableNumber}</p>}
      </div>

      {/* Rider & Customer Information (Prominent for Delivery / Takeaway) */}
      {(isDelivery || isTakeaway || order.customer?.name || order.deliveryDriver) && (
        <div className="mb-3 border-2 border-black p-2 bg-gray-50 text-[11px] space-y-1">
          {(isDelivery || order.deliveryDriver) && (
            <div className="border-b border-dashed border-black pb-1">
              <span className="font-bold uppercase block text-[10px] text-gray-700">Rider / Delivery Driver:</span>
              <span className="font-black text-sm uppercase block">{riderName}</span>
            </div>
          )}

          <div>
            <span className="font-bold uppercase block text-[10px] text-gray-700">Customer Name:</span>
            <span className="font-black text-xs block">{order.customer?.name || 'Walk-in Customer'}</span>
          </div>

          {order.customer?.phone && (
            <div>
              <span className="font-bold uppercase block text-[10px] text-gray-700">Customer Phone:</span>
              <span className="font-bold text-xs block">{order.customer.phone}</span>
            </div>
          )}

          {(isDelivery || order.customer?.address) && (
            <div>
              <span className="font-bold uppercase block text-[10px] text-gray-700">Delivery Address:</span>
              <p className="font-bold text-xs leading-tight bg-white p-1 border border-black">
                {order.customer?.address || 'No Address Provided'}
              </p>
            </div>
          )}

          {(order.customer?.deliveryNotes || order.notes) && (
            <div>
              <span className="font-bold uppercase block text-[10px] text-gray-700">Order Notes / Instructions:</span>
              <p className="italic text-[10px]">{order.customer?.deliveryNotes || order.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Itemized Order List */}
      <table className="w-full mb-3 border-b border-black pb-2 border-dashed text-[11px]">
        <thead>
          <tr className="text-left font-bold border-b border-black">
            <th className="pb-1 w-6">Qty</th>
            <th className="pb-1">Item Description</th>
            <th className="pb-1 text-right">Price</th>
            <th className="pb-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr>
                <td className="align-top py-1 font-bold">{item.quantity}</td>
                <td className="align-top py-1 pr-1 font-semibold">
                  {item.name}
                  {item.flavor && (
                    <div className="text-[10px] text-gray-800">Flavor: {item.flavor}</div>
                  )}
                  {item.customization && (
                    <div className="text-[10px] italic text-gray-700">↳ {item.customization}</div>
                  )}
                </td>
                <td className="align-top py-1 text-right text-xs">{(item.price).toFixed(0)}</td>
                <td className="align-top py-1 text-right font-bold">{(item.price * item.quantity).toFixed(0)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div className="mb-3 border-b border-black pb-2 border-dashed text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>Rs. {order.subtotal.toFixed(0)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
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
        <div className="flex justify-between font-black text-sm mt-1 pt-1 border-t-2 border-black">
          <span>TOTAL BILL:</span>
          <span>Rs. {order.total.toFixed(0)}</span>
        </div>
      </div>

      {/* Payment Details */}
      <div className="mb-3 text-center border-b border-black pb-2 border-dashed text-[11px]">
        <div className="flex justify-between font-black">
          <span>PAID VIA {(order.paymentMethod || 'cash').replace('_', ' ').toUpperCase()}:</span>
          <span>Rs. {order.total.toFixed(0)}</span>
        </div>
        {order.amountTendered !== undefined && (
          <div className="flex justify-between">
            <span>Cash Received:</span>
            <span>Rs. {order.amountTendered.toFixed(0)}</span>
          </div>
        )}
        {order.changeGiven !== undefined && order.changeGiven > 0 && (
          <div className="flex justify-between font-bold">
            <span>Change Due:</span>
            <span>Rs. {order.changeGiven.toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Footer & Barcode */}
      <div className="text-center mt-3 mb-6">
        <p className="font-bold text-[11px] mb-1">Thank you for ordering with White's Castle!</p>
        <p className="text-[10px] text-gray-600 mb-2">Branch: {branchName}</p>
        <div className="flex justify-center my-1">
          <QRCode value={order.id} size={90} level="L" />
        </div>
        <p className="text-[9px] break-all">{order.id}</p>
      </div>

      {/* 
        ESC/POS Raw Hex Injection
        If using a "Generic / Text Only" Windows printer driver, this invisible span
        will pass the raw hex bytes to the printer to kick the cash drawer.
        Command: ESC p 0 25 250 (\x1B\x70\x00\x19\xFA)
      */}
      <span className="print:block" style={{ visibility: 'hidden', fontSize: 0 }}>
        {'\x1B\x70\x00\x19\xFA'}
      </span>
    </div>
  );
};
