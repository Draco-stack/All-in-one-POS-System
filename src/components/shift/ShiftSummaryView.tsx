import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserSwitchModal } from '../auth/UserSwitchModal';
import {
  Wallet,
  Printer,
  TrendingUp,
  CreditCard,
  Banknote,
  CheckCircle,
  AlertTriangle,
  Lock,
  Clock,
  User,
  Calculator,
  Shield,
  Play,
  RotateCcw,
  Receipt,
  Sparkles,
  X,
} from 'lucide-react';

export const ShiftSummaryView: React.FC = () => {
  const { currentShift, openShift, closeShift, orders, currentUser } = useRestaurant();
  const [actualCashCounted, setActualCashCounted] = useState<string>('');
  const [isShiftClosing, setIsShiftClosing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOpenNewShiftModal, setIsOpenNewShiftModal] = useState(false);
  const [newShiftFloat, setNewShiftFloat] = useState('2000');
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [showZReportModal, setShowZReportModal] = useState(false);

  // Denominations calculator for PKR currency
  const [counts, setCounts] = useState<{ [denom: string]: number }>({
    '5000': 0,
    '1000': 0,
    '500': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    'coins': 0,
  });

  const isManagerOrOwner = currentUser.role === 'owner' || currentUser.role === 'manager';
  const isShiftClosed = currentShift?.status === 'closed';

  const calculatedFromDenoms =
    (counts['5000'] || 0) * 5000 +
    (counts['1000'] || 0) * 1000 +
    (counts['500'] || 0) * 500 +
    (counts['100'] || 0) * 100 +
    (counts['50'] || 0) * 50 +
    (counts['20'] || 0) * 20 +
    (counts['10'] || 0) * 10 +
    (counts['coins'] || 0);

  const handleCountChange = (denom: string, val: number) => {
    const next = { ...counts, [denom]: Math.max(0, val) };
    setCounts(next);
    const sum =
      (next['5000'] || 0) * 5000 +
      (next['1000'] || 0) * 1000 +
      (next['500'] || 0) * 500 +
      (next['100'] || 0) * 100 +
      (next['50'] || 0) * 50 +
      (next['20'] || 0) * 20 +
      (next['10'] || 0) * 10 +
      (next['coins'] || 0);
    setActualCashCounted(sum.toString());
  };

  const openingFloat = currentShift?.openingFloat || 0;
  const cashSales = currentShift?.cashSales || 0;
  const cardSales = currentShift?.cardSales || 0;
  const otherSales = currentShift?.otherSales || 0;
  const totalGrossSales = currentShift?.totalGrossSales || cashSales + cardSales + otherSales;
  const expectedCashInDrawer = currentShift?.cashInDrawerExpected || openingFloat + cashSales;
  const userEnteredCash = parseFloat(actualCashCounted) || 0;
  const cashVariance = userEnteredCash - expectedCashInDrawer;

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(userEnteredCash) || actualCashCounted === '') return;

    setIsShiftClosing(true);
    await closeShift(userEnteredCash);
    setIsShiftClosing(false);
    setShowZReportModal(true);
  };

  const handleStartNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const floatVal = parseFloat(newShiftFloat) || 2000;
    setIsStartingShift(true);
    await openShift(floatVal, `Opened by ${currentUser.name}`);
    setIsStartingShift(false);
    setIsOpenNewShiftModal(false);
    setActualCashCounted('');
    setCounts({
      '5000': 0,
      '1000': 0,
      '500': 0,
      '100': 0,
      '50': 0,
      '20': 0,
      '10': 0,
      'coins': 0,
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-950 text-stone-100 overflow-y-auto select-none p-4 md:p-6 space-y-6">
      {/* Shift Header Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#00897b]/10 border border-[#00897b]/30 flex items-center justify-center text-[#00897b]">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Register Shift & Cash Drawer (Z-Report)</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  isShiftClosed
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isShiftClosed ? '● Shift Closed & Reconciled' : '● Register Shift Active'}
              </span>
              {isManagerOrOwner && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                  Manager Audit
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Terminal: <span className="text-stone-200 font-mono font-bold">{currentShift?.terminalId || 'POS-01'}</span> • Cashier: <span className="text-stone-200 font-bold">{currentShift?.cashierName || currentUser.name}</span> • Shift Opened:{' '}
              <span className="text-stone-200 font-mono">{currentShift?.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}</span>
              {currentShift?.closedAt && (
                <span> • Closed: <span className="text-stone-200 font-mono">{new Date(currentShift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isShiftClosed ? (
            <button
              onClick={() => setIsOpenNewShiftModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start New Shift</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpenNewShiftModal(true)}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-stone-700"
              title="Re-open or Start Next Shift"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset / New Shift</span>
            </button>
          )}

          <button
            onClick={() => setShowZReportModal(true)}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-stone-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print Z-Report</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Total Gross Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            Rs. {totalGrossSales.toFixed(0)}
          </div>
          <p className="text-[11px] text-stone-500">{currentShift?.transactionsCount || orders.length} total orders recorded</p>
        </div>

        {/* Cash Sales */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Cash Sales</span>
            <Banknote className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            Rs. {cashSales.toFixed(0)}
          </div>
          <p className="text-[11px] text-stone-500">Opening float: Rs. {openingFloat.toFixed(0)}</p>
        </div>

        {/* Card Sales */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Card Volume</span>
            <CreditCard className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            Rs. {cardSales.toFixed(0)}
          </div>
          <p className="text-[11px] text-stone-500">Card & Digital POS settlements</p>
        </div>

        {/* Expected Cash in Drawer */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Expected in Drawer</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            Rs. {expectedCashInDrawer.toFixed(0)}
          </div>
          <p className="text-[11px] text-stone-500">Opening float + Cash sales</p>
        </div>
      </div>

      {/* Cash Drawer Counting Section & Shift Close Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Denomination Counter Pad */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">PKR Cash Denomination Counter</h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
              Counted: Rs. {calculatedFromDenoms.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {[
              { id: '5000', label: 'Rs. 5,000' },
              { id: '1000', label: 'Rs. 1,000' },
              { id: '500', label: 'Rs. 500' },
              { id: '100', label: 'Rs. 100' },
              { id: '50', label: 'Rs. 50' },
              { id: '20', label: 'Rs. 20' },
              { id: '10', label: 'Rs. 10' },
              { id: 'coins', label: 'Coins Sum' },
            ].map((d) => (
              <div key={d.id} className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">{d.label}</label>
                <input
                  type="number"
                  min="0"
                  value={counts[d.id] || ''}
                  placeholder="0"
                  onChange={(e) => handleCountChange(d.id, parseFloat(e.target.value) || 0)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>

          <p className="text-[11px] text-stone-400 italic">
            Tip: Enter the quantity of physical banknotes counted in the register. The total automatically updates the Actual Cash field.
          </p>
        </div>

        {/* Right: Close Shift & Reconciliation Box */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-stone-800 pb-3 mb-4">
              <Lock className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Shift Cash Out & Finalize Z-Report</h3>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-stone-300">
                  Actual Physical Cash in Drawer (Rs.)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="Enter counted cash in Rs."
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(e.target.value)}
                  className="w-full bg-stone-950 border-2 border-stone-700 rounded-xl px-4 py-3 text-xl font-black text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Variance Display */}
              {actualCashCounted !== '' && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    Math.abs(cashVariance) < 0.01
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : cashVariance > 0
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {Math.abs(cashVariance) < 0.01 ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span>
                      {Math.abs(cashVariance) < 0.01
                        ? 'Drawer Balanced Perfectly'
                        : cashVariance > 0
                        ? 'Drawer Over (Surplus)'
                        : 'Drawer Short'}
                    </span>
                  </div>
                  <span className="font-mono font-black text-base">
                    {cashVariance >= 0 ? `+Rs. ${cashVariance.toFixed(0)}` : `-Rs. ${Math.abs(cashVariance).toFixed(0)}`}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isShiftClosing || !actualCashCounted}
                className="w-full py-3.5 rounded-2xl bg-[#00897b] hover:bg-[#00796b] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-900/30 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{isShiftClosing ? 'Closing Shift & Finalizing...' : 'Close Shift & Finalize Z-Report'}</span>
              </button>
            </form>
          </div>

          {isShiftClosed && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
              <div className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>Shift closed & archived. Ready for next shift.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenNewShiftModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Open Next Shift
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Start New Shift Modal */}
      {isOpenNewShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Play className="w-4 h-4 fill-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Start New Register Shift</h3>
                  <p className="text-xs text-stone-400">Initialize drawer float for cashier</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenNewShiftModal(false)}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewShift} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                  Cashier Name
                </label>
                <input
                  type="text"
                  disabled
                  value={`${currentUser.name} (${currentUser.role.toUpperCase()})`}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-300 block mb-1">
                  Opening Cash Float (Rs.)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-stone-400 font-mono font-bold text-sm">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={newShiftFloat}
                    onChange={(e) => setNewShiftFloat(e.target.value)}
                    className="w-full bg-stone-950 border-2 border-stone-700 rounded-xl pl-12 pr-3 py-2.5 text-lg font-black text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Float presets */}
              <div className="flex gap-2">
                {['1000', '2000', '5000', '10000'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNewShiftFloat(f)}
                    className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-xs font-mono font-bold text-stone-200 transition cursor-pointer"
                  >
                    Rs. {Number(f).toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenNewShiftModal(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStartingShift}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{isStartingShift ? 'Starting...' : 'Open Register'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Printable Z-Report Modal */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            {/* Printable Z-Report Slip */}
            <div className="text-center border-b border-dashed border-stone-400 pb-3 space-y-1">
              <h3 className="font-black text-sm uppercase tracking-wider">WHITE'S CASTLE POS</h3>
              <p className="text-[11px] text-stone-600">OFFICIAL END-OF-SHIFT Z-REPORT</p>
              <p className="text-[10px] text-stone-500">Terminal: {currentShift?.terminalId || 'POS-01'}</p>
              <p className="text-[10px] text-stone-500">Cashier: {currentShift?.cashierName || currentUser.name}</p>
              <p className="text-[10px] text-stone-500">
                Printed: {new Date().toLocaleString()}
              </p>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-stone-400 pb-3">
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span className="font-bold">Rs. {openingFloat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span className="font-bold">Rs. {cashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card Sales:</span>
                <span className="font-bold">Rs. {cardSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-300 pt-1 font-black text-sm">
                <span>TOTAL GROSS SALES:</span>
                <span>Rs. {totalGrossSales.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-stone-400 pb-3">
              <div className="flex justify-between font-bold">
                <span>Expected in Drawer:</span>
                <span>Rs. {expectedCashInDrawer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Actual Cash Counted:</span>
                <span>Rs. {(currentShift?.cashInDrawerActual || userEnteredCash).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-stone-300">
                <span>CASH VARIANCE:</span>
                <span className={cashVariance < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                  {cashVariance >= 0 ? `+Rs. ${cashVariance.toFixed(2)}` : `-Rs. ${Math.abs(cashVariance).toFixed(2)}`}
                </span>
              </div>
            </div>

            <div className="text-center text-[10px] text-stone-500 pt-1">
              *** END OF Z-REPORT AUDIT ***
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowZReportModal(false)}
                className="flex-1 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <UserSwitchModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};
