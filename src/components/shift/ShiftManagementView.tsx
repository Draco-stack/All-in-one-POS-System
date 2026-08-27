import React, { useState } from 'react';
import {
  Calculator,
  DollarSign,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Printer,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';

export const ShiftManagementView: React.FC = () => {
  const { currentShift, openShift, closeShift, currentUser, showToast } = useRestaurant();
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('5000');
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');

  const handleOpen = () => {
    const floatVal = parseFloat(openingFloatInput) || 0;
    openShift(floatVal, shiftNotes);
    setShiftNotes('');
  };

  const handleClose = () => {
    const cashVal = parseFloat(actualCashInput) || 0;
    closeShift(cashVal, shiftNotes);
    setShiftNotes('');
  };

  const handlePrintZReport = () => {
    showToast('🖨️ Printing End-of-Day Z-Report to POS thermal printer...');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-stone-950 text-stone-100 font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#00897b]" />
            Register Shift & Cash Drawer Reconciliation
          </h2>
          <p className="text-xs text-stone-400">
            Open shift floats, live register cash audit, and shift close discrepancy tracking.
          </p>
        </div>

        {currentShift && currentShift.status === 'open' && (
          <button
            onClick={handlePrintZReport}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-stone-700 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Print Mid-Shift X-Report
          </button>
        )}
      </div>

      {/* Shift State Display */}
      {currentShift && currentShift.status === 'open' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shift Financial Overview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div>
                  <span className="text-xs text-stone-400 uppercase font-mono tracking-wider">Active Shift</span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    {currentShift.shiftNumber || 'SH-101'} • Cashier: {currentShift.cashierName}
                  </h3>
                </div>
                <span className="text-xs font-mono text-stone-400">
                  Opened: {new Date(currentShift.openedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Opening Float</span>
                  <p className="text-base font-black text-white font-mono mt-1">
                    PKR {currentShift.openingFloat.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Cash Sales</span>
                  <p className="text-base font-black text-emerald-400 font-mono mt-1">
                    PKR {currentShift.cashSales.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Card & Online</span>
                  <p className="text-base font-black text-blue-400 font-mono mt-1">
                    PKR {currentShift.cardSales.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Transactions</span>
                  <p className="text-base font-black text-amber-400 font-mono mt-1">
                    {currentShift.transactionsCount} bills
                  </p>
                </div>
              </div>

              {/* Total Expected in Drawer */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                    Expected Physical Cash in Register Drawer:
                  </span>
                  <p className="text-xs text-stone-400 mt-0.5">
                    (Opening Float: PKR {currentShift.openingFloat.toLocaleString()} + Cash Tender: PKR {currentShift.cashSales.toLocaleString()})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    PKR {currentShift.cashInDrawerExpected.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Close Shift Action Panel */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Reconcile & Close Register
            </h3>
            <p className="text-xs text-stone-400">
              Count all physical cash, coins, and bills in the cash drawer and input the counted sum.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">
                  Actual Physical Cash Counted (PKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={`Expected PKR ${currentShift.cashInDrawerExpected}`}
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">
                  Handover Notes / Variance Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Returned change float to safe, petty cash voucher #42..."
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              {actualCashInput && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    parseFloat(actualCashInput) === currentShift.cashInDrawerExpected
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/30 text-red-300'
                  }`}
                >
                  <span>Drawer Variance:</span>
                  <span className="font-bold">
                    PKR {(parseFloat(actualCashInput) - currentShift.cashInDrawerExpected).toLocaleString()}
                  </span>
                </div>
              )}

              <button
                onClick={handleClose}
                disabled={!actualCashInput}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg cursor-pointer"
              >
                Close Register & Finalize Z-Report
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* OPEN NEW SHIFT PANEL */
        <div className="max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#00897b]/20 border border-[#00897b]/40 text-[#00897b] flex items-center justify-center">
              <Unlock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Open Cashier Register Shift</h3>
              <p className="text-xs text-stone-400">Enter morning float / change fund to start billing</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-stone-300 font-semibold block mb-1">
                Opening Cash Float (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:border-[#00897b]"
              />
            </div>

            <div>
              <label className="text-xs text-stone-300 font-semibold block mb-1">Shift Opening Notes</label>
              <input
                type="text"
                placeholder="e.g. Standard morning float assigned by manager"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpen}
              className="w-full py-3 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg cursor-pointer"
            >
              Start New Register Shift
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
