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
  const { currentShift, openShift, closeShift, orders, currentUser, showToast, theme } = useRestaurant();
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('5000');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [actualCashCounted, setActualCashCounted] = useState<string>('');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Check if active shift was opened on a previous day (unclosed overnight shift)
  const isUnclosedPreviousShift = useMemo(() => {
    if (!currentShift || currentShift.status !== 'open' || !currentShift.openedAt) return false;
    const openedDate = new Date(currentShift.openedAt);
    const todayDate = new Date();
    return (
      openedDate.getFullYear() < todayDate.getFullYear() ||
      openedDate.getMonth() < todayDate.getMonth() ||
      openedDate.getDate() < todayDate.getDate()
    );
  }, [currentShift]);

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
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto font-sans space-y-6 transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0f1117] text-slate-900 dark:text-stone-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Header Banner */}
      <div className={`rounded-2xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
        theme === 'dark' ? 'bg-[#151821] border-slate-200 dark:border-stone-800 shadow-lg' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div>
          <h2 className={`text-lg md:text-xl font-black flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            <Calculator className="w-6 h-6 text-emerald-500" />
            Register Shift & Cash Drawer Reconciliation
          </h2>
          <p className={`text-xs mt-0.5 ${
            theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
          }`}>
            Live register cash audit, timestamp transaction verification, and shift close discrepancy tracking.
          </p>
        </div>

        {currentShift && currentShift.status === 'open' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintZReport}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
                theme === 'dark'
                  ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 border-slate-300 dark:border-stone-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              Print Mid-Shift X-Report
            </button>
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20 active:scale-95"
            >
              <Lock className="w-4 h-4" />
              Close Shift Modal
            </button>
          </div>
        )}
      </div>

      {/* Shift State Display */}
      {isUnclosedPreviousShift && currentShift && currentShift.status === 'open' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3 shadow-xl backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-200 flex items-center gap-2">
              <span>Unclosed Register Shift From Previous Day ({new Date(currentShift.openedAt).toLocaleDateString()})</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-mono text-amber-300 font-bold">
                Manual Close Required
              </span>
            </h4>
            <p className="text-xs text-amber-300/90 leading-relaxed font-medium">
              This shift was opened on <strong>{new Date(currentShift.openedAt).toLocaleString()}</strong> and was not closed yesterday. Register shifts are <strong>NEVER automatically closed</strong> by the system. It remains active until explicitly closed by a Cashier, Manager, or Admin user. Please reconcile the cash drawer below and close this shift.
            </p>
          </div>
        </div>
      )}

      {currentShift && currentShift.status === 'open' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shift Financial Overview */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`rounded-2xl p-5 border space-y-4 transition-colors ${
              theme === 'dark' ? 'bg-[#161922] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                theme === 'dark' ? 'border-slate-200 dark:border-stone-800' : 'border-slate-100'
              }`}>
                <div>
                  <span className={`text-xs uppercase font-mono tracking-wider ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>Active Shift Session</span>
                  <h3 className={`text-lg font-bold flex items-center gap-2 mt-0.5 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    {currentShift.shiftNumber || 'SH-101'} • Cashier: {currentShift.cashierName || currentUser.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono block ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>
                    Opened: {currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString() : 'Today'}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                    ● Live Audit Active
                  </span>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3.5 rounded-xl border transition-colors ${
                  theme === 'dark' ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>Opening Float</span>
                  <p className="text-base font-black text-amber-500 font-mono mt-1">
                    PKR {openingFloatVal.toLocaleString()}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border transition-colors ${
                  theme === 'dark' ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>Cash Sales</span>
                  <p className="text-base font-black text-emerald-500 font-mono mt-1">
                    PKR {displayCashSales.toLocaleString()}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border transition-colors ${
                  theme === 'dark' ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>Card & Digital</span>
                  <p className="text-base font-black text-blue-500 font-mono mt-1">
                    PKR {displayCardSales.toLocaleString()}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border transition-colors ${
                  theme === 'dark' ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'
                  }`}>Total Gross</span>
                  <p className="text-base font-black text-purple-500 font-mono mt-1">
                    PKR {displayTotalGross.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Total Expected in Drawer */}
              <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${
                theme === 'dark'
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wider block ${
                    theme === 'dark' ? 'text-emerald-300' : 'text-emerald-800'
                  }`}>
                    Expected Physical Cash in Register Drawer:
                  </span>
                  <p className={`text-xs mt-0.5 ${
                    theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-600'
                  }`}>
                    (Opening Float: PKR {openingFloatVal.toLocaleString()} + Shift Cash Sales: PKR {displayCashSales.toLocaleString()})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-500 font-mono">
                    PKR {expectedCashInDrawer.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Transactions Ledger */}
            <div className={`rounded-2xl p-5 border space-y-3 transition-colors ${
              theme === 'dark' ? 'bg-[#161922] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${
                theme === 'dark' ? 'border-slate-200 dark:border-stone-800' : 'border-slate-100'
              }`}>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-500" />
                  <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Shift Transactions Ledger
                  </h4>
                </div>
                <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                  {currentShiftTransactions.length} orders in this shift
                </span>
              </div>

              {currentShiftTransactions.length === 0 ? (
                <div className={`text-center py-6 text-xs ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`}>
                  No orders punched yet during this active shift session.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                  {currentShiftTransactions.map((order) => {
                    const isCash = (order.paymentMethod || 'cash').toLowerCase().includes('cash');
                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl p-2.5 flex items-center justify-between text-xs border transition-colors ${
                          theme === 'dark'
                            ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800/80 text-slate-700 dark:text-stone-300'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isCash ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                            }`}
                          >
                            {order.paymentMethod || 'cash'}
                          </span>
                          <span className={theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}>
                            {order.customer?.name || order.orderType || 'Order'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`}>
                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          <span className={`font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
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
          <div className={`rounded-2xl p-5 border space-y-4 transition-colors ${
            theme === 'dark' ? 'bg-[#161922] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className={`font-bold text-base flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Lock className="w-5 h-5 text-amber-500" />
              Reconcile & Close Register
            </h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
              Count all physical cash in drawer, check variances against system calculation, and finalize shift audit.
            </p>

            <div className="space-y-3">
              <div>
                <label className={`text-xs font-semibold block mb-1 flex items-center justify-between ${
                  theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'
                }`}>
                  <span>Actual Physical Cash Counted (PKR)</span>
                  <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`}>Optional or Open Modal</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={`Expected: PKR ${expectedCashInDrawer.toLocaleString()}`}
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(e.target.value)}
                  className={`w-full border rounded-xl p-3 text-sm font-mono focus:outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
              </div>

              {actualCashCounted !== '' && !isNaN(enteredCashNum) && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    Math.abs(variance) < 1
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                      : variance > 0
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
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
                <label className={`text-xs font-semibold block mb-1 ${
                  theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'
                }`}>
                  Handover Notes / Variance Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Returned change float to safe, petty cash voucher #42..."
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsCloseModalOpen(true)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Calculator className="w-4 h-4" />
                  Detailed Denomination Counting & Z-Report
                </button>

                <button
                  onClick={handleDirectClose}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold tracking-wide transition cursor-pointer active:scale-95"
                >
                  Quick Close Register (PKR {(enteredCashNum || expectedCashInDrawer).toLocaleString()})
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* OPEN NEW SHIFT PANEL */
        <div className={`max-w-md mx-auto border rounded-2xl p-6 space-y-4 shadow-xl transition-colors ${
          theme === 'dark' ? 'bg-[#161922] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
              <Unlock className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Open Cashier Register Shift
              </h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                Enter morning float / change fund to start billing
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className={`text-xs font-semibold block mb-1 ${
                theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'
              }`}>
                Opening Cash Float (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm font-mono focus:outline-none transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                }`}
              />
            </div>

            {/* Quick Float presets */}
            <div className="flex gap-2">
              {['1000', '2000', '5000', '10000'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOpeningFloatInput(f)}
                  className={`flex-1 py-1.5 border rounded-lg text-xs font-mono font-bold transition cursor-pointer active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-[#0c0e14] hover:bg-slate-100 dark:hover:bg-stone-800 border-slate-200 dark:border-stone-800 text-slate-700 dark:text-stone-300'
                      : 'bg-slate-50 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  PKR {Number(f).toLocaleString()}
                </button>
              ))}
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1 ${
                theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'
              }`}>
                Shift Opening Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Standard morning float assigned by manager"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#0c0e14] border-slate-200 dark:border-stone-800 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                }`}
              />
            </div>

            <button
              onClick={handleOpen}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg cursor-pointer active:scale-95"
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

