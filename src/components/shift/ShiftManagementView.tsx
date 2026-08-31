import React, { useState, useMemo } from 'react';
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
  Receipt,
  TrendingUp,
  CreditCard,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ShiftCloseModal } from './ShiftCloseModal';

export const ShiftManagementView: React.FC = () => {
  const { currentShift, openShift, closeShift, orders, currentUser, showToast } = useRestaurant();
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('5000');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [actualCashCounted, setActualCashCounted] = useState<string>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Filter transactions belonging to the current shift's start and end timestamps
  const currentShiftTransactions = useMemo(() => {
    if (!currentShift) return [];
    const shiftStartTime = currentShift.openedAt ? new Date(currentShift.openedAt).getTime() : 0;
    const shiftEndTime = currentShift.closedAt ? new Date(currentShift.closedAt).getTime() : null;

    let validOrders = orders.filter((o) => {
      if (o.status === 'cancelled' || o.status === 'refunded' || o.paymentStatus === 'refunded') return false;
      const orderTime = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
      // Allow 2-minute clock skew buffer
      if (shiftStartTime > 0 && orderTime < (shiftStartTime - 120000)) return false;
      if (shiftEndTime && orderTime > (shiftEndTime + 120000)) return false;
      return true;
    });

    // Fallback if timestamp window was tight and shift is open
    if (validOrders.length === 0 && orders.length > 0 && !shiftEndTime) {
      validOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded' && o.paymentStatus !== 'refunded');
    }

    return validOrders;
  }, [orders, currentShift]);

  // Aggregate totals
  const aggregatedCashSales = useMemo(() => {
    return currentShiftTransactions
      .filter((o) => {
        const pm = (o.paymentMethod || 'cash').toLowerCase();
        return pm === 'cash' || pm === 'cod' || pm === 'cash_on_delivery' || (!pm.includes('card') && !pm.includes('online') && !pm.includes('pos'));
      })
      .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
  }, [currentShiftTransactions]);

  const aggregatedCardSales = useMemo(() => {
    return currentShiftTransactions
      .filter((o) => {
        const pm = (o.paymentMethod || '').toLowerCase();
        return pm.includes('card') || pm.includes('online') || pm.includes('pos') || pm.includes('bank') || pm.includes('digital');
      })
      .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
  }, [currentShiftTransactions]);

  const aggregatedTotalGross = useMemo(() => {
    return currentShiftTransactions.reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
  }, [currentShiftTransactions]);

  const openingFloatVal = currentShift?.openingFloat || currentShift?.startingFloat || 0;
  const displayCashSales = aggregatedCashSales || (currentShift?.cashSales || 0);
  const displayCardSales = aggregatedCardSales || (currentShift?.cardSales || 0);
  const displayTotalGross = aggregatedTotalGross || (currentShift?.totalGrossSales || (displayCashSales + displayCardSales));
  const expectedCashInDrawer = openingFloatVal + displayCashSales;

  const enteredCashNum = parseFloat(actualCashCounted);
  const variance = !isNaN(enteredCashNum) ? enteredCashNum - expectedCashInDrawer : 0;

  const handleOpen = () => {
    const floatVal = parseFloat(openingFloatInput) || 0;
    openShift(floatVal, shiftNotes);
    setShiftNotes('');
  };

  const handleDirectClose = () => {
    const cashVal = !isNaN(enteredCashNum) ? enteredCashNum : expectedCashInDrawer;
    closeShift(cashVal, shiftNotes);
    setShiftNotes('');
    setActualCashCounted('');
  };

  const handlePrintZReport = () => {
    window.print();
    showToast('🖨️ Printing Mid-Shift X-Report to POS printer...');
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
            Live register cash audit, timestamp transaction verification, and shift close discrepancy tracking.
          </p>
        </div>

        {currentShift && currentShift.status === 'open' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintZReport}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-stone-700 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              Print Mid-Shift X-Report
            </button>
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <Lock className="w-4 h-4" />
              Close Shift Modal
            </button>
          </div>
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
                  <span className="text-xs text-stone-400 uppercase font-mono tracking-wider">Active Shift Session</span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    {currentShift.shiftNumber || 'SH-101'} • Cashier: {currentShift.cashierName || currentUser.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-stone-400 block">
                    Opened: {currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString() : 'Today'}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    ● Live Audit Active
                  </span>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Opening Float</span>
                  <p className="text-base font-black text-amber-400 font-mono mt-1">
                    PKR {openingFloatVal.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Cash Sales</span>
                  <p className="text-base font-black text-emerald-400 font-mono mt-1">
                    PKR {displayCashSales.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Card & Digital</span>
                  <p className="text-base font-black text-sky-400 font-mono mt-1">
                    PKR {displayCardSales.toLocaleString()}
                  </p>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Total Gross</span>
                  <p className="text-base font-black text-purple-400 font-mono mt-1">
                    PKR {displayTotalGross.toLocaleString()}
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
                    (Opening Float: PKR {openingFloatVal.toLocaleString()} + Shift Cash Sales: PKR {displayCashSales.toLocaleString()})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    PKR {expectedCashInDrawer.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Transactions Ledger */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#00897b]" />
                  <h4 className="text-sm font-bold text-white">Shift Transactions Ledger</h4>
                </div>
                <span className="text-xs font-mono text-stone-400">
                  {currentShiftTransactions.length} orders in this shift
                </span>
              </div>

              {currentShiftTransactions.length === 0 ? (
                <div className="text-center py-6 text-stone-500 text-xs">
                  No orders punched yet during this active shift session.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {currentShiftTransactions.map((order) => {
                    const isCash = (order.paymentMethod || 'cash').toLowerCase().includes('cash');
                    return (
                      <div
                        key={order.id}
                        className="bg-stone-950 border border-stone-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-stone-300">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isCash ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {order.paymentMethod || 'cash'}
                          </span>
                          <span className="text-stone-400">
                            {order.customer?.name || order.orderType || 'Order'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-400 font-mono">
                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          <span className="font-mono font-bold text-white">
                            PKR {(order.total || order.subtotal || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Close Shift Action Panel */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Reconcile & Close Register
            </h3>
            <p className="text-xs text-stone-400">
              Count all physical cash in drawer, check variances against system calculation, and finalize shift audit.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1 flex items-center justify-between">
                  <span>Actual Physical Cash Counted (PKR)</span>
                  <span className="text-[10px] text-stone-500">Optional or Open Modal</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={`Expected: PKR ${expectedCashInDrawer.toLocaleString()}`}
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              {actualCashCounted !== '' && !isNaN(enteredCashNum) && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    Math.abs(variance) < 1
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : variance > 0
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {Math.abs(variance) < 1 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{Math.abs(variance) < 1 ? 'Balanced' : variance > 0 ? 'Cash Surplus' : 'Cash Shortage'}</span>
                  </div>
                  <span className="font-mono font-black">
                    {variance >= 0 ? `+PKR ${variance.toLocaleString()}` : `-PKR ${Math.abs(variance).toLocaleString()}`}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">
                  Handover Notes / Variance Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Returned change float to safe, petty cash voucher #42..."
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  className="w-full py-3 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  Detailed Denomination Counting & Z-Report
                </button>

                <button
                  onClick={handleDirectClose}
                  className="w-full py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold tracking-wide transition cursor-pointer"
                >
                  Quick Close Register (PKR {(enteredCashNum || expectedCashInDrawer).toLocaleString()})
                </button>
              </div>
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

            {/* Quick Float presets */}
            <div className="flex gap-2">
              {['1000', '2000', '5000', '10000'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOpeningFloatInput(f)}
                  className="flex-1 py-1.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-lg text-xs font-mono font-bold text-stone-300 transition cursor-pointer"
                >
                  PKR {Number(f).toLocaleString()}
                </button>
              ))}
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

      {/* Full Shift Close & Reconciliation Modal */}
      {isCloseModalOpen && (
        <ShiftCloseModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          onShiftClosed={() => {
            setIsCloseModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

