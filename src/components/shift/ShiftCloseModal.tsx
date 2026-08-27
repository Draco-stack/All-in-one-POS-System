import React, { useState, useMemo } from 'react';
import {
  Calculator,
  X,
  Lock,
  CheckCircle,
  AlertTriangle,
  Printer,
  Banknote,
  DollarSign,
  TrendingUp,
  Receipt,
  FileCheck,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { DenominationCounts, ShiftAuditRecord } from '../../types';

interface ShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed?: () => void;
}

export const ShiftCloseModal: React.FC<ShiftCloseModalProps> = ({
  isOpen,
  onClose,
  onShiftClosed,
}) => {
  const { currentShift, closeShift, currentUser, orders, showToast, logoutUser } = useRestaurant();

  // Petty Cash / Float Balance input
  const [pettyCash, setPettyCash] = useState<number>(
    currentShift?.startingFloat || currentShift?.openingFloat || 2000
  );

  // Banknotes and Coins Counter Matrix
  const [denomCounts, setDenomCounts] = useState<DenominationCounts>({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });

  const [coinsAmount, setCoinsAmount] = useState<number>(0);
  const [floatRetained, setFloatRetained] = useState<number>(0);
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessZReport, setShowSuccessZReport] = useState(false);
  const [closedAuditData, setClosedAuditData] = useState<ShiftAuditRecord | null>(null);

  // Update individual denomination count
  const handleDenomChange = (denom: keyof DenominationCounts, val: string) => {
    const parsed = parseInt(val, 10);
    setDenomCounts((prev) => ({
      ...prev,
      [denom]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  // Real-time calculation: Total = ∑(Note × Quantity) + Coins
  const totalPhysicalCashCounted = useMemo(() => {
    const notesTotal =
      denomCounts[5000] * 5000 +
      denomCounts[1000] * 1000 +
      denomCounts[500] * 500 +
      denomCounts[100] * 100 +
      denomCounts[50] * 50 +
      denomCounts[20] * 20 +
      denomCounts[10] * 10;
    return notesTotal + (coinsAmount || 0);
  }, [denomCounts, coinsAmount]);

  // Strict User-ID Cashout Accountability (Till Management)
  // Calculate expected cash EXCLUSIVELY from orders created by the logged-in user's account
  const userShiftOrders = useMemo(() => {
    if (!currentShift) return [];
    const shiftStartTime = new Date(currentShift.openedAt || Date.now() - 24 * 60 * 60 * 1000).getTime();
    return orders.filter((o) => {
      if (o.status === 'cancelled' || o.status === 'refunded') return false;
      const orderTime = new Date(o.createdAt).getTime();
      if (orderTime < shiftStartTime) return false;

      // Strict user ID matching - Match against the user who OPENED the shift
      const shiftOwnerId = currentShift.openedBy || currentShift.openedById || currentShift.cashierId || currentUser.id;
      const shiftOwnerName = currentShift.cashierName || currentUser.name;

      const matchesId = o.createdById ? o.createdById === shiftOwnerId : false;
      const matchesCashierId = o.cashierId ? o.cashierId === shiftOwnerId : false;
      const matchesName = o.cashierName && shiftOwnerName ? o.cashierName.toLowerCase() === shiftOwnerName.toLowerCase() : false;

      return matchesId || matchesCashierId || matchesName;
    });
  }, [orders, currentShift, currentUser]);

  const userCashSales = useMemo(() => {
    return userShiftOrders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [userShiftOrders]);

  const userCardSales = useMemo(() => {
    return userShiftOrders
      .filter((o) => o.paymentMethod === 'card' || o.paymentMethod === 'online')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [userShiftOrders]);

  const userTotalSales = useMemo(() => {
    return userShiftOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [userShiftOrders]);

  const openingFloatVal = currentShift?.openingFloat || currentShift?.startingFloat || pettyCash || 0;
  const cashSalesVal = userShiftOrders.length > 0 ? userCashSales : (currentShift?.cashSales || 0);
  const cardSalesVal = userShiftOrders.length > 0 ? userCardSales : (currentShift?.cardSales || 0);
  const totalSalesVal = userShiftOrders.length > 0 ? userTotalSales : (currentShift?.totalGrossSales || cashSalesVal + cardSalesVal);

  // Expected cash in drawer = Opening Float/Petty Cash + User's Own Account Cash Sales
  const expectedCashInDrawer = openingFloatVal + cashSalesVal;

  // Reconciliation Discrepancy: Physical Cash Counted - Expected Cash
  const discrepancy = totalPhysicalCashCounted - expectedCashInDrawer;
  const isBalanced = Math.abs(discrepancy) === 0;
  const isOverage = discrepancy > 0;
  const isShortage = discrepancy < 0;

  if (!isOpen) return null;

  const handleFinalizeShiftClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const auditPayload: ShiftAuditRecord = {
        id: `audit-${Date.now()}`,
        shiftId: currentShift?.id || `shift-${Date.now()}`,
        userId: currentUser.id,
        cashierName: currentUser.name,
        startTime: currentShift?.openedAt || new Date().toISOString(),
        endTime: new Date().toISOString(),
        startingPettyCash: pettyCash,
        totalSales: totalSalesVal,
        cashSales: cashSalesVal,
        cardSales: cardSalesVal,
        expectedCash: expectedCashInDrawer,
        actualCash: totalPhysicalCashCounted,
        shortageOverage: discrepancy,
        floatRetained,
        lockerDeposit: totalPhysicalCashCounted - floatRetained,
        denominationBreakdown: denomCounts,
        notes: shiftNotes,
        status: 'closed',
        createdAt: new Date().toISOString(),
      };

      // Call context closeShift
      closeShift(totalPhysicalCashCounted, shiftNotes);

      // Attempt to save to backend shift audit endpoint if available
      const res = await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditPayload),
      });

      if (!res.ok) {
        throw new Error('Failed to record shift on backend server');
      }

      setClosedAuditData(auditPayload);
      setShowSuccessZReport(true);
      showToast(`✓ Shift session closed & reconciled for ${currentUser.name}`);
      if (onShiftClosed) onShiftClosed();
    } catch (err) {
      console.error('Failed to close shift:', err);
      showToast('❌ Error closing register shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintZReport = () => {
    window.print();
    showToast('🖨️ Z-Report sent to thermal receipt printer.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00897b]/20 border border-[#00897b]/40 text-[#00897b] flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                Register Shift Close & Reconciliation
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {currentShift?.shiftNumber || 'ACTIVE SHIFT'}
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Cashier: <strong className="text-stone-200">{currentUser.name}</strong> • Outlet: {currentUser.outlet || 'Main Branch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showSuccessZReport && closedAuditData ? (
          /* Z-Report Summary Print View */
          <div className="p-6 overflow-y-auto space-y-5 bg-stone-950/80">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black text-white">Shift Closed & Z-Report Generated</h4>
              <p className="text-xs text-stone-400">
                Session closed at {new Date(closedAuditData.endTime).toLocaleTimeString()} on {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Thermal Print Slip Simulation */}
            <div className="bg-white text-stone-950 p-5 rounded-xl font-mono text-xs max-w-md mx-auto shadow-2xl space-y-3 border border-stone-300">
              <div className="text-center border-b border-dashed border-stone-400 pb-2">
                <h5 className="font-black text-sm tracking-wider uppercase">WHITES CASTLE PRO POS</h5>
                <p className="text-[10px] text-stone-600">END OF SHIFT Z-REPORT (AUDIT # {closedAuditData.id.slice(-6)})</p>
                <p className="text-[10px] text-stone-500">Cashier: {closedAuditData.cashierName}</p>
              </div>

              <div className="space-y-1 border-b border-dashed border-stone-400 pb-2">
                <div className="flex justify-between">
                  <span>Starting Petty Cash:</span>
                  <span>PKR {closedAuditData.startingPettyCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span>PKR {closedAuditData.cashSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Card / Online Sales:</span>
                  <span>PKR {closedAuditData.cardSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total Shift Revenue:</span>
                  <span>PKR {closedAuditData.totalSales.toLocaleString()}</span>
                </div>
              </div>

              {/* Denomination Breakdown */}
              <div className="space-y-0.5 border-b border-dashed border-stone-400 pb-2 text-[11px]">
                <span className="font-bold text-[10px] uppercase text-stone-600 block">Banknote Breakdown:</span>
                {([5000, 1000, 500, 100, 50, 20, 10] as const).map((d) => (
                  <div key={d} className="flex justify-between text-stone-700">
                    <span>PKR {d} × {closedAuditData.denominationBreakdown[d] || 0}:</span>
                    <span>PKR {((closedAuditData.denominationBreakdown[d] || 0) * d).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-bold">
                  <span>Expected in Drawer:</span>
                  <span>PKR {closedAuditData.expectedCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm">
                  <span>Actual Cash Counted:</span>
                  <span>PKR {closedAuditData.actualCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-dashed border-stone-400">
                  <span>Variance ({closedAuditData.shortageOverage >= 0 ? 'OVERAGE' : 'SHORTAGE'}):</span>
                  <span className={closedAuditData.shortageOverage >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    {closedAuditData.shortageOverage >= 0 ? '+' : ''}PKR {closedAuditData.shortageOverage.toLocaleString()}
                  </span>
                </div>
              </div>

              {closedAuditData.notes && (
                <div className="pt-2 text-[10px] text-stone-600 border-t border-dashed border-stone-300">
                  <strong>Notes:</strong> {closedAuditData.notes}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handlePrintZReport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Physical Z-Report
              </button>
              <button
                onClick={() => {
                  onClose();
                  logoutUser();
                }}
                className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Done & Exit
              </button>
            </div>
          </div>
        ) : (
          /* Shift Close Reconciliation Form */
          <form onSubmit={handleFinalizeShiftClose} className="p-5 overflow-y-auto space-y-5 no-scrollbar">
            
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Starting Petty Cash</span>
                <p className="text-base font-black text-amber-400 font-mono mt-0.5">
                  PKR {openingFloatVal.toLocaleString()}
                </p>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Shift Cash Sales</span>
                <p className="text-base font-black text-emerald-400 font-mono mt-0.5">
                  PKR {cashSalesVal.toLocaleString()}
                </p>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Card & Online</span>
                <p className="text-base font-black text-blue-400 font-mono mt-0.5">
                  PKR {cardSalesVal.toLocaleString()}
                </p>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">System Expected Cash</span>
                <p className="text-base font-black text-cyan-400 font-mono mt-0.5">
                  PKR {expectedCashInDrawer.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Petty Cash Float Adjustment */}
            <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-amber-400" />
                  Petty Cash Float / Starting Balance (PKR):
                </label>
                <span className="text-[11px] text-stone-500 font-mono">Declared at shift start</span>
              </div>
              <input
                type="number"
                min="0"
                value={pettyCash}
                onChange={(e) => setPettyCash(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#00897b]"
                placeholder="e.g. 2000"
              />
            </div>

            {/* Notes & Bills Counter Matrix */}
            <div className="bg-stone-950/90 p-4 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-[#00897b]" />
                    Banknotes & Currency Denomination Counter Matrix
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    Input individual physical note counts: Total = ∑(Note × Quantity)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-stone-400 font-bold">Sum from Matrix</span>
                  <p className="text-sm font-black text-emerald-400 font-mono">
                    PKR {totalPhysicalCashCounted.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Denomination Matrix Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {([5000, 1000, 500, 100, 50, 20, 10] as const).map((denom) => {
                  const qty = denomCounts[denom] || 0;
                  const lineTotal = qty * denom;
                  return (
                    <div
                      key={denom}
                      className="bg-stone-900 border border-stone-800 rounded-xl p-2.5 flex flex-col justify-between space-y-1.5 focus-within:border-[#00897b] transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white font-mono bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                          Rs. {denom}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          = {lineTotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          id={`denom-input-${denom}`}
                          type="number"
                          min="0"
                          value={qty === 0 ? '' : qty}
                          placeholder="0 pcs"
                          onChange={(e) => handleDenomChange(denom, e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-center text-white placeholder:text-stone-600 focus:outline-none focus:border-[#00897b]"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Loose Coins / Small Change */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-2.5 flex flex-col justify-between space-y-1.5 focus-within:border-[#00897b] transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 font-mono bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                      Coins (PKR)
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">
                      = {coinsAmount.toLocaleString()}
                    </span>
                  </div>

                  <input
                    type="number"
                    min="0"
                    value={coinsAmount === 0 ? '' : coinsAmount}
                    placeholder="Coins sum"
                    onChange={(e) => setCoinsAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-center text-white placeholder:text-stone-600 focus:outline-none focus:border-[#00897b]"
                  />
                </div>
              </div>
            </div>

            {/* Next Shift Float / Locker Deposit Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#00897b]" />
                    Next Shift Float Kept (PKR):
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  value={floatRetained}
                  onChange={(e) => setFloatRetained(parseFloat(e.target.value) || 0)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#00897b]"
                  placeholder="Amount left in drawer"
                />
              </div>

              <div className="bg-[#00897b]/10 p-3.5 rounded-xl border border-[#00897b]/30 space-y-1.5 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-emerald-400">Safe / Locker Deposit</span>
                <p className="text-xl font-black text-emerald-400 font-mono">
                  PKR {(totalPhysicalCashCounted - floatRetained).toLocaleString()}
                </p>
                <p className="text-[10px] text-stone-400">Actual Cash Counted - Next Shift Float Kept</p>
              </div>
            </div>

            {/* Reconciliation Comparison Summary Box */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isBalanced
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : isOverage
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isBalanced
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isOverage
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {isBalanced ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    {isBalanced
                      ? 'Cash Drawer Perfectly Balanced (0 Discrepancy)'
                      : isOverage
                      ? `Cash Overage Detected (+PKR ${discrepancy.toLocaleString()})`
                      : `Cash Shortage Detected (-PKR ${Math.abs(discrepancy).toLocaleString()})`}
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Physical Count: PKR {totalPhysicalCashCounted.toLocaleString()} | System Expected: PKR {expectedCashInDrawer.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                  Variance
                </span>
                <span
                  className={`text-xl font-black font-mono ${
                    isBalanced
                      ? 'text-emerald-400'
                      : isOverage
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {discrepancy >= 0 ? `+PKR ${discrepancy.toLocaleString()}` : `-PKR ${Math.abs(discrepancy).toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Shift Discrepancy & Handover Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">
                Shift Handover / Audit Notes (Optional):
              </label>
              <textarea
                rows={2}
                placeholder="Enter any drawer discrepancy explanations or handover notes for the incoming cashier..."
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-[#00897b]"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl shadow-teal-950/50 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {isSubmitting ? 'Closing Shift...' : 'Reconcile & Close Shift'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
