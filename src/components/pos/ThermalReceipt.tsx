import React, { useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Order, OrderType } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { connectAndKickDrawer } from '../../utils/hardware';

export type ThermalOrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY' | string;

export interface ItemModifier {
  name: string;
  price?: number;
}

export interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: ItemModifier[];
  customization?: string;
  flavor?: string;
  itemNote?: string;
  selectedOptions?: { name?: string; choice?: string; label?: string; extraPrice?: number; price?: number }[];
}

export interface ThermalReceiptProps {
  order?: Order | any | null;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  taxRegistrationNumber?: string;
  orderType?: ThermalOrderType;
  orderNumber?: string;
  orderId?: string;
  tableNumber?: string;
  waiterName?: string;
  serverName?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  items?: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  deliveryFee?: number;
  total?: number;
  paymentMethod?: string;
  amountTendered?: number;
  changeGiven?: number;
  createdAt?: string;
  cashierName?: string;
  className?: string;
}

/**
 * High-precision 1D Barcode SVG Generator for Thermal Printing
 */
const ThermalBarcodeSVG: React.FC<{ value: string }> = ({ value }) => {
  // Generate a pattern of bar widths based on input string hash
  const getBars = (str: string) => {
    const bars: number[] = [2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1];
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      bars.push((charCode % 3) + 1);
      bars.push(((charCode * 2) % 2) + 1);
    }
    bars.push(2, 1, 2, 3, 1);
    return bars;
  };

  const bars = getBars(value || 'ORD-0000');
  let currentX = 0;
  const barElements: React.ReactNode[] = [];

  bars.forEach((width, index) => {
    const isBlack = index % 2 === 0;
    if (isBlack) {
      barElements.push(
        <rect
          key={index}
          x={currentX}
          y={0}
          width={width}
          height={36}
          fill="#000000"
        />
      );
    }
    currentX += width;
  });

  return (
    <div className="flex flex-col items-center justify-center my-2">
      <svg
        width={Math.min(currentX, 220)}
        height={36}
        viewBox={`0 0 ${currentX} 36`}
        className="block"
      >
        {barElements}
      </svg>
      <span className="text-[10px] tracking-widest font-mono text-black font-bold uppercase mt-0.5">
        *{value}*
      </span>
    </div>
  );
};

export const ThermalReceipt: React.FC<ThermalReceiptProps> = (props) => {
  // Gracefully attempt context access if rendered inside RestaurantProvider
  let setPrintQueueOrder: ((order: Order | null) => void) | undefined;
  try {
    const restaurantContext = useRestaurant();
    setPrintQueueOrder = restaurantContext?.setPrintQueueOrder;
  } catch (e) {
    // Context unavailable, standalone mode
  }

  const ord = props.order || {};

  useEffect(() => {
    if (props.order) {
      connectAndKickDrawer().catch(() => {});
    }

    const handleAfterPrint = () => {
      if (setPrintQueueOrder) {
        setPrintQueueOrder(null);
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [setPrintQueueOrder, props.order]);

  // If no order object and no items provided, return null
  const hasContent = props.order || (props.items && props.items.length > 0);
  if (!hasContent) return null;

  // 1. Order Type Normalization
  const rawOrderType = (
    props.orderType ||
    ord.orderType ||
    ord.type ||
    'DINE_IN'
  )
    .toString()
    .toUpperCase();

  let normalizedOrderType: 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY' = 'DINE_IN';
  if (rawOrderType.includes('DELIV')) {
    normalizedOrderType = 'DELIVERY';
  } else if (
    rawOrderType.includes('TAKE') ||
    rawOrderType.includes('PICKUP') ||
    rawOrderType.includes('DRIVE')
  ) {
    normalizedOrderType = 'TAKE_AWAY';
  } else {
    normalizedOrderType = 'DINE_IN';
  }

  // 2. Data Extraction with Fallbacks
  const restaurantName =
    props.restaurantName || ord.branchName || ord.outlet || "WHITE'S CASTLE";
  const restaurantAddress =
    props.restaurantAddress || 'Main Commercial Hub, Sector F-7, Islamabad';
  const restaurantPhone =
    props.restaurantPhone || 'UAN: (051) 111-227-853';
  const taxRegistrationNumber =
    props.taxRegistrationNumber || 'NTN/VAT Reg: #7391024-1';

  const orderId =
    props.orderId ||
    props.orderNumber ||
    ord.orderNumber ||
    ord.receiptNumber ||
    ord.id ||
    'ORD-1001';

  const dateObj = props.createdAt || ord.createdAt
    ? new Date(props.createdAt || ord.createdAt)
    : new Date();

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // Routing attributes
  const tableNumber = props.tableNumber || ord.tableNumber || 'T-04';
  const waiterName =
    props.waiterName ||
    props.serverName ||
    props.cashierName ||
    ord.cashierName ||
    'Server Alex M.';

  const queueNumber =
    props.orderNumber ||
    ord.orderNumber ||
    (orderId.length > 6 ? orderId.slice(-4) : orderId);

  const customerName =
    props.customerName || ord.customer?.name || 'Walk-in Guest';
  const customerPhone = props.customerPhone || ord.customer?.phone || '';
  const deliveryAddress =
    props.deliveryAddress || ord.customer?.address || '';
  const deliveryNotes =
    props.deliveryNotes ||
    ord.customer?.deliveryNotes ||
    ord.customer?.notes ||
    ord.notes ||
    '';

  const items: ReceiptItem[] = props.items || ord.items || [];

  const subtotal =
    props.subtotal ??
    ord.subtotal ??
    items.reduce((acc, it) => acc + it.price * it.quantity, 0);

  const tax = props.tax ?? ord.tax ?? 0;
  const discount = props.discount ?? ord.discount ?? 0;
  const deliveryFee = props.deliveryFee ?? ord.deliveryFee ?? 0;
  const total =
    props.total ??
    ord.total ??
    subtotal + tax + (normalizedOrderType === 'DELIVERY' ? deliveryFee : 0) - discount;

  const paymentMethod = (
    props.paymentMethod ||
    ord.paymentMethod ||
    'CASH'
  )
    .toString()
    .toUpperCase();

  const amountTendered =
    props.amountTendered ?? ord.amountTendered ?? ord.tenderedAmount;
  const changeGiven = props.changeGiven ?? ord.changeGiven;

  return (
    <>
      {/* Strict Print CSS for 80mm Thermal Printer */}
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0mm !important;
        }
        @media print {
          html, body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-print, #thermal-receipt-print * {
            visibility: visible !important;
          }
          #thermal-receipt-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 2mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Main Thermal Receipt Container - Locked to 280px-300px for Screen / 80mm Print */}
      <div
        id="thermal-receipt-print"
        className={`hidden print:block text-black bg-white font-mono leading-tight select-none border border-black p-3 mx-auto ${
          props.className || ''
        }`}
        style={{
          width: '290px',
          maxWidth: '290px',
          fontFamily: 'Courier, "Courier New", monospace',
          color: '#000000',
          fontSize: '11px',
        }}
      >
        {/* ========================================== */}
        {/* 1. HEADER SECTION                          */}
        {/* ========================================== */}
        <div className="text-center pb-2 border-b border-black border-dashed mb-2">
          <h1 className="font-black text-lg uppercase tracking-wider text-black m-0 p-0 leading-none">
            {restaurantName}
          </h1>
          <p className="text-[10px] m-0 mt-1 font-bold">{restaurantAddress}</p>
          <p className="text-[10px] m-0">{restaurantPhone}</p>
          <p className="text-[9px] m-0 font-bold">{taxRegistrationNumber}</p>
        </div>

        {/* ========================================== */}
        {/* 2. DYNAMIC ORDER ROUTING LOGIC             */}
        {/* ========================================== */}
        {normalizedOrderType === 'DINE_IN' && (
          <div className="border-2 border-black p-1.5 my-2 text-center bg-white">
            <div className="flex justify-between items-center border-b border-black pb-1 mb-1 font-black text-xs">
              <span>*** DINE-IN ***</span>
              <span>TBL: {tableNumber}</span>
            </div>
            <div className="text-[10px] flex justify-between font-bold">
              <span>SERVER: {waiterName}</span>
              <span>TABLE #{tableNumber}</span>
            </div>
          </div>
        )}

        {normalizedOrderType === 'TAKE_AWAY' && (
          <div className="border-2 border-black p-2 my-2 text-center bg-white">
            <span className="text-[10px] font-black uppercase block tracking-wider">
              *** TAKE-AWAY / PICKUP ***
            </span>
            <div className="text-xl font-black my-1 uppercase tracking-widest border-y border-black py-0.5">
              QUEUE #{queueNumber}
            </div>
            <div className="text-[10px] font-bold text-left mt-1">
              CUSTOMER: <span className="uppercase">{customerName}</span>
            </div>
          </div>
        )}

        {normalizedOrderType === 'DELIVERY' && (
          <div className="border-2 border-black p-1.5 my-2 bg-white">
            <div className="text-center font-black text-xs border-b border-black pb-1 mb-1 tracking-wider uppercase">
              *** DELIVERY ORDER ***
            </div>
            <div className="space-y-1 text-[10px]">
              <div>
                <span className="font-bold">CUSTOMER: </span>
                <span className="font-black uppercase">{customerName}</span>
              </div>
              {customerPhone && (
                <div>
                  <span className="font-bold">PHONE: </span>
                  <span className="font-bold">{customerPhone}</span>
                </div>
              )}
              {deliveryAddress && (
                <div>
                  <span className="font-bold block">DELIVERY ADDRESS:</span>
                  <p className="m-0 font-bold text-[10px] leading-tight border border-black p-1 mt-0.5 bg-white break-words">
                    {deliveryAddress}
                  </p>
                </div>
              )}
              {deliveryNotes && (
                <div>
                  <span className="font-bold block">RIDER NOTES:</span>
                  <p className="m-0 italic text-[9px] leading-tight border border-dashed border-black p-1 mt-0.5 break-words">
                    {deliveryNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 3. ORDER META                              */}
        {/* ========================================== */}
        <div className="pb-1.5 mb-2 border-b border-black border-dashed text-[10px] space-y-0.5">
          <div className="flex justify-between font-bold">
            <span>ORDER ID: #{orderId}</span>
            <span>TYPE: {normalizedOrderType}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>DATE: {formattedDate}</span>
            <span>TIME: {formattedTime}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span>CASHIER: {waiterName}</span>
            <span>TERMINAL: POS-01</span>
          </div>
        </div>

        {/* ========================================== */}
        {/* 4. ITEMIZED LEDGER                         */}
        {/* ========================================== */}
        <div className="pb-2 mb-2 border-b border-black border-dashed">
          <table className="w-full text-[10px] border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b-2 border-black text-left font-black">
                <th style={{ width: '28px' }} className="pb-1 text-left">QTY</th>
                <th className="pb-1 text-left">ITEM DESCRIPTION</th>
                <th style={{ width: '60px' }} className="pb-1 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <React.Fragment key={item.id || idx}>
                    <tr className="align-top border-b border-gray-200">
                      <td className="py-1 font-bold text-left align-top">{item.quantity}</td>
                      <td className="py-1 pr-1 font-bold align-top text-left break-words">
                        {item.name}
                        {item.flavor && (
                          <div className="text-[9px] font-normal italic">
                            Flavor: {item.flavor}
                          </div>
                        )}
                      </td>
                      <td className="py-1 text-right font-bold align-top">
                        {itemTotal.toFixed(0)}
                      </td>
                    </tr>

                    {/* Indented Item Modifiers & Options */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      item.modifiers.map((mod, mIdx) => (
                        <tr key={`mod-${idx}-${mIdx}`} className="text-[9px]">
                          <td></td>
                          <td colSpan={2} className="pl-2 pb-0.5 text-left italic font-normal">
                            + {mod.name} {mod.price ? `(+$${mod.price.toFixed(0)})` : ''}
                          </td>
                        </tr>
                      ))
                    )}

                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      item.selectedOptions.map((opt, oIdx) => (
                        <tr key={`opt-${idx}-${oIdx}`} className="text-[9px]">
                          <td></td>
                          <td colSpan={2} className="pl-2 pb-0.5 text-left italic font-normal">
                            ↳ {opt.choice || opt.name || opt.label} {opt.extraPrice ? `(+${opt.extraPrice.toFixed(0)})` : ''}
                          </td>
                        </tr>
                      ))
                    )}

                    {item.customization && (
                      <tr className="text-[9px]">
                        <td></td>
                        <td colSpan={2} className="pl-2 pb-0.5 text-left italic">
                          ↳ Note: {item.customization}
                        </td>
                      </tr>
                    )}

                    {item.itemNote && (
                      <tr className="text-[9px]">
                        <td></td>
                        <td colSpan={2} className="pl-2 pb-0.5 text-left italic">
                          ↳ Note: {item.itemNote}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ========================================== */}
        {/* 5. FINANCIAL SUMMARY                       */}
        {/* ========================================== */}
        <div className="pb-2 mb-2 border-b border-black border-dashed text-[10px] space-y-0.5 text-right">
          <div className="flex justify-between">
            <span className="font-bold">SUBTOTAL:</span>
            <span>Rs. {subtotal.toFixed(0)}</span>
          </div>

          {tax > 0 && (
            <div className="flex justify-between">
              <span>TAX / SERVICE:</span>
              <span>Rs. {tax.toFixed(0)}</span>
            </div>
          )}

          {discount > 0 && (
            <div className="flex justify-between font-bold">
              <span>DISCOUNT APPLIED:</span>
              <span>-Rs. {discount.toFixed(0)}</span>
            </div>
          )}

          {/* Conditionally rendered Delivery Fee */}
          {(normalizedOrderType === 'DELIVERY' || deliveryFee > 0) && (
            <div className="flex justify-between font-bold">
              <span>DELIVERY FEE:</span>
              <span>Rs. {deliveryFee.toFixed(0)}</span>
            </div>
          )}

          <div className="flex justify-between font-black text-sm pt-1 border-t-2 border-black mt-1">
            <span>GRAND TOTAL:</span>
            <span>Rs. {total.toFixed(0)}</span>
          </div>
        </div>

        {/* ========================================== */}
        {/* 6. PAYMENT BREAKDOWN                       */}
        {/* ========================================== */}
        <div className="pb-2 mb-2 border-b border-black border-dashed text-[10px] space-y-0.5">
          <div className="flex justify-between font-black">
            <span>PAYMENT METHOD:</span>
            <span>{paymentMethod}</span>
          </div>

          {amountTendered !== undefined && amountTendered > 0 && (
            <div className="flex justify-between">
              <span>AMOUNT TENDERED:</span>
              <span>Rs. {amountTendered.toFixed(0)}</span>
            </div>
          )}

          {changeGiven !== undefined && changeGiven >= 0 && (
            <div className="flex justify-between font-bold">
              <span>CHANGE DUE:</span>
              <span>Rs. {changeGiven.toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* 7. FOOTER & BARCODE / QR CODE              */}
        {/* ========================================== */}
        <div className="text-center pt-1">
          <p className="font-bold text-[10px] m-0 mb-1 uppercase tracking-tight">
            THANK YOU FOR YOUR VISIT!
          </p>
          <p className="text-[9px] m-0 mb-2 italic">Please retain receipt for return/exchange</p>

          {/* Centered QR Code */}
          <div className="flex justify-center items-center my-2 p-1 bg-white inline-block mx-auto border border-black">
            <QRCode value={orderId} size={84} level="M" />
          </div>

          {/* 1D Barcode Placeholder */}
          <ThermalBarcodeSVG value={orderId} />
        </div>

        {/* Hardware ESC/POS pulse command trigger for cash drawer */}
        <span className="print:block" style={{ visibility: 'hidden', fontSize: 0 }}>
          {'\x1B\x70\x00\x19\xFA'}
        </span>
      </div>
    </>
  );
};

export default ThermalReceipt;
