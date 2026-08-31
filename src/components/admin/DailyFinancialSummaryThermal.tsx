import React from 'react';

export interface DailyFinancialSummaryThermalProps {
  dateLabel: string;
  grossSales: number;
  netSales: number;
  totalOrders: number;
  cogs: number;
  discounts: number;
  cashSales: number;
  cardSales: number;
  shifts: any[];
}

export const DailyFinancialSummaryThermal: React.FC<DailyFinancialSummaryThermalProps> = (props) => {
  return (
    <>
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
          #thermal-daily-summary, #thermal-daily-summary * {
            visibility: visible !important;
          }
          #thermal-daily-summary {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: auto;
          }
        }
      `}</style>
      <div
        id="thermal-daily-summary"
        className="hidden print:block w-full text-black bg-white"
        style={{ width: '80mm', margin: '0 auto', fontFamily: 'monospace' }}
      >
        <div style={{ padding: '4mm', fontSize: '12px', lineHeight: '1.4' }}>
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="font-bold text-lg m-0 p-0 leading-tight">WHITE'S CASTLE</h1>
            <div className="text-xs">123 Culinary Ave, Food District</div>
            <div className="text-xs">Tel: +1 234 567 890</div>
            <div className="text-xs mt-1 font-bold">DAILY FINANCIAL SUMMARY</div>
            <div className="text-xs">{props.dateLabel}</div>
          </div>

          <div className="border-t border-dashed border-black my-2"></div>
          
          {/* Summary Metrics */}
          <div className="font-bold mb-1 text-sm">SALES OVERVIEW</div>
          <div className="flex justify-between">
            <span>Gross Sales:</span>
            <span>PKR {props.grossSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Discounts/Refunds:</span>
            <span>-PKR {props.discounts.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold mt-1 text-sm">
            <span>Net Sales:</span>
            <span>PKR {props.netSales.toLocaleString()}</span>
          </div>
          
          <div className="border-t border-dashed border-black my-2"></div>
          
          <div className="font-bold mb-1 text-sm">PAYMENT BREAKDOWN</div>
          <div className="flex justify-between">
            <span>Cash Sales:</span>
            <span>PKR {props.cashSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Card/Online:</span>
            <span>PKR {props.cardSales.toLocaleString()}</span>
          </div>

          <div className="border-t border-dashed border-black my-2"></div>

          <div className="font-bold mb-1 text-sm">OPERATIONS</div>
          <div className="flex justify-between">
            <span>Total Orders:</span>
            <span>{props.totalOrders}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Order Value:</span>
            <span>PKR {props.totalOrders > 0 ? Math.round(props.grossSales / props.totalOrders).toLocaleString() : 0}</span>
          </div>

          <div className="border-t border-dashed border-black my-2"></div>

          <div className="font-bold mb-1 text-sm">SHIFT AUDITS ({props.shifts.length})</div>
          {props.shifts.map((s, idx) => (
            <div key={idx} className="mb-3 text-xs">
              <div className="flex justify-between font-bold">
                <span>Shift #{s.shiftNumber}</span>
                <span>{s.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span>{s.status === 'open' ? 'IN PROGRESS' : 'CLOSED'}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Cash:</span>
                <span>PKR {s.expectedCash?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Cash:</span>
                <span>PKR {s.actualCash?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Variance:</span>
                <span>{s.shortageOverage >= 0 ? '+' : ''}PKR {s.shortageOverage?.toLocaleString() || 0}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-dashed border-black my-2"></div>

          {/* Footer */}
          <div className="text-center mt-4 mb-8">
            <div className="text-xs">Generated: {new Date().toLocaleString()}</div>
            <div className="text-xs font-bold mt-1">END OF REPORT</div>
            <div className="text-[10px] mt-2">White's Castle POS System</div>
          </div>
        </div>
      </div>
    </>
  );
};
