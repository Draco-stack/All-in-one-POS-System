import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, Banknote, CreditCard, QrCode, Split, Plus, Trash2, ArrowRight, DollarSign } from 'lucide-react';
import { PaymentMethod, SplitPaymentEntry } from '../../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  tax: number;
  discount: number;
  deliveryFee: number;
  tip: number;
  total: number;
  onComplete: (tendered: number, paymentMethod: PaymentMethod, splitPayments?: SplitPaymentEntry[]) => Promise<void>;
}

interface SplitRow {
  id: string;
  method: 'cash' | 'card' | 'online';
  amount: string;
  reference: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  tax,
  discount,
  deliveryFee,
  tip,
  total,
  onComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tenderedInput, setTenderedInput] = useState<string>(total.toString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Split Tender State
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    { id: '1', method: 'cash', amount: '', reference: '' },
    { id: '2', method: 'card', amount: '', reference: '' },
  ]);

  useEffect(() => {
    if (isOpen) {
      setTenderedInput(total.toString());
      setPaymentMethod('cash');
      setIsSubmitting(false);

      // Default split tender rows initialized to 50/50
      const half = Math.round(total / 2);
      setSplitRows([
        { id: 'split-1', method: 'cash', amount: half.toString(), reference: '' },
        { id: 'split-2', method: 'card', amount: (total - half).toString(), reference: '' },
      ]);
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const tenderedNumber = parseFloat(tenderedInput) || 0;
  const changeDue = Math.max(0, tenderedNumber - total);
  const isExactOrMore = tenderedNumber >= total;

  // Split calculations
  const splitTotalAllocated = splitRows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  const splitRemaining = Math.max(0, total - splitTotalAllocated);
  const splitOverpaid = Math.max(0, splitTotalAllocated - total);
  const isSplitValid = splitTotalAllocated >= total && splitRows.every((r) => (parseFloat(r.amount) || 0) > 0);

  const quickCashBills = [500, 1000, 2000, 5000];

  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setTenderedInput('0');
    } else if (val === 'BS') {
      setTenderedInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else {
      setTenderedInput((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const handleAddSplitRow = () => {
    const nextRemaining = Math.max(0, total - splitTotalAllocated);
    setSplitRows((prev) => [
      ...prev,
      {
        id: `split-${Date.now()}`,
        method: prev.some((r) => r.method === 'cash') ? 'card' : 'cash',
        amount: nextRemaining > 0 ? nextRemaining.toString() : '',
        reference: '',
      },
    ]);
  };

  const handleRemoveSplitRow = (id: string) => {
    if (splitRows.length <= 1) return;
    setSplitRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateSplitRow = (id: string, field: keyof SplitRow, value: string) => {
    setSplitRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleFillRemaining = (id: string) => {
    const otherSum = splitRows
      .filter((r) => r.id !== id)
      .reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    const needed = Math.max(0, total - otherSum);
    handleUpdateSplitRow(id, 'amount', needed.toString());
  };

  const handlePay = async () => {
    if (paymentMethod === 'cash' && !isExactOrMore) return;
    if (paymentMethod === 'split' && !isSplitValid) return;

    setIsSubmitting(true);
    try {
      if (paymentMethod === 'split') {
        const validatedSplits: SplitPaymentEntry[] = splitRows.map((r) => ({
          id: r.id,
          method: r.method,
          amount: parseFloat(r.amount) || 0,
          reference: r.reference.trim() || undefined,
        }));
        await onComplete(splitTotalAllocated, 'split', validatedSplits);
      } else {
        const finalTendered = paymentMethod === 'cash' ? tenderedNumber : (tenderedNumber > 0 ? tenderedNumber : total);
        await onComplete(finalTendered, paymentMethod);
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/60 dark:bg-stone-950/60 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-black text-xs shadow-md border border-emerald-400/20 shrink-0">
              PKR
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base truncate">Payment & Tender Register</h3>
              <p className="text-[9.5px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 truncate">
                Single or Multi-Tender Split Payment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-slate-500 dark:text-stone-400 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center gap-1 transition-all font-semibold text-[10px] sm:text-xs cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate max-w-full">Cash</span>
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center gap-1 transition-all font-semibold text-[10px] sm:text-xs cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-gradient-to-b from-blue-950/60 to-blue-900/30 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate max-w-full">Card</span>
            </button>

            <button
              onClick={() => setPaymentMethod('online')}
              className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center gap-1 transition-all font-semibold text-[10px] sm:text-xs cursor-pointer ${
                paymentMethod === 'online'
                  ? 'bg-gradient-to-b from-purple-950/60 to-purple-900/30 border-purple-500/50 text-purple-300 ring-1 ring-purple-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <QrCode className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="truncate max-w-full">QR/Digital</span>
            </button>

            <button
              onClick={() => setPaymentMethod('split')}
              className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center gap-1 transition-all font-semibold text-[10px] sm:text-xs cursor-pointer ${
                paymentMethod === 'split'
                  ? 'bg-gradient-to-b from-amber-950/60 to-amber-900/30 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <Split className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate max-w-full">Split Tender</span>
            </button>
          </div>

          {/* Amount Due vs Tendered Banner */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 bg-stone-950/90 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block truncate">
                Total Due
              </span>
              <p className="text-lg sm:text-2xl font-black text-white font-mono mt-0.5 sm:mt-1 truncate">
                PKR {total.toLocaleString()}
              </p>
            </div>

            {paymentMethod === 'split' ? (
              <div
                className={`p-3 sm:p-4 rounded-2xl border ${
                  splitRemaining === 0
                    ? 'bg-emerald-950/40 border-emerald-500/30 shadow-inner'
                    : 'bg-amber-950/40 border-amber-500/30 shadow-inner'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block truncate">
                  {splitRemaining > 0 ? 'Remaining Balance' : 'Split Allocated'}
                </span>
                <p
                  className={`text-lg sm:text-2xl font-black font-mono mt-0.5 sm:mt-1 truncate ${
                    splitRemaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  PKR {(splitRemaining > 0 ? splitRemaining : splitTotalAllocated).toLocaleString()}
                </p>
              </div>
            ) : (
              <div
                className={`p-3 sm:p-4 rounded-2xl border ${
                  changeDue >= 0
                    ? 'bg-emerald-950/40 border-emerald-500/30 shadow-inner'
                    : 'bg-red-950/40 border-red-500/30 shadow-inner'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block truncate">
                  Change Due
                </span>
                <p className="text-lg sm:text-2xl font-black text-emerald-400 font-mono mt-0.5 sm:mt-1 truncate">
                  PKR {changeDue.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* SPLIT TENDER UI */}
          {paymentMethod === 'split' && (
            <div className="space-y-3 bg-stone-950/90 p-3 sm:p-4 rounded-2xl border border-white/5 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Payment Allocations ({splitRows.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddSplitRow}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Tender Row
                </button>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {splitRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="p-2.5 rounded-xl bg-stone-900 border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs font-mono font-bold text-stone-400 shrink-0">
                      {index + 1}
                    </div>

                    {/* Tender Method Selector */}
                    <select
                      value={row.method}
                      onChange={(e) => handleUpdateSplitRow(row.id, 'method', e.target.value)}
                      className="bg-stone-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold text-stone-200 shrink-0 focus:border-amber-500 outline-hidden"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="card">💳 Card</option>
                      <option value="online">📱 Digital/QR</option>
                    </select>

                    {/* Amount Input */}
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-500">
                        PKR
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={(e) => handleUpdateSplitRow(row.id, 'amount', e.target.value)}
                        className="w-full bg-stone-950 border border-white/10 rounded-lg pl-10 pr-2 py-1.5 text-xs font-mono font-bold text-white focus:border-amber-500 outline-hidden"
                      />
                    </div>

                    {/* Reference / Notes */}
                    <input
                      type="text"
                      placeholder="Ref / Seat / Note"
                      value={row.reference}
                      onChange={(e) => handleUpdateSplitRow(row.id, 'reference', e.target.value)}
                      className="w-full sm:w-28 bg-stone-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-stone-300 focus:border-amber-500 outline-hidden"
                    />

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFillRemaining(row.id)}
                        title="Auto-fill remaining balance"
                        className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-stone-400 hover:text-amber-300 text-[10px] font-bold border border-white/5 transition-all cursor-pointer"
                      >
                        Fill
                      </button>

                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitRow(row.id)}
                          title="Remove row"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-stone-400 hover:text-red-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {splitRemaining > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-semibold flex items-center justify-between">
                  <span>Remaining unallocated balance:</span>
                  <span className="font-mono font-bold">PKR {splitRemaining.toLocaleString()}</span>
                </div>
              )}
              {splitOverpaid > 0 && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-semibold flex items-center justify-between">
                  <span>Cash change to return:</span>
                  <span className="font-mono font-bold">PKR {splitOverpaid.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Cash Bills & Input Keypad (Cash Method Only) */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  onClick={() => setTenderedInput(total.toString())}
                  className="flex-1 min-w-[100px] py-1.5 sm:py-2 px-2 rounded-xl bg-gradient-to-r from-emerald-950 to-stone-900 hover:from-emerald-900 hover:to-stone-800 text-[11px] sm:text-xs font-black text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm truncate"
                >
                  Exact (PKR {total})
                </button>
                {quickCashBills.map((bill) => (
                  <button
                    key={bill}
                    onClick={() => setTenderedInput(bill.toString())}
                    className="flex-1 min-w-[70px] py-1.5 sm:py-2 px-1.5 rounded-xl bg-stone-950/90 hover:bg-stone-800 text-[11px] sm:text-xs font-bold font-mono text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-white/5 transition-all cursor-pointer truncate"
                  >
                    PKR {bill}
                  </button>
                ))}
              </div>

              {/* Numeric Display & Keypad */}
              <div className="bg-stone-950/90 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
                <div className="text-right px-3 py-2 bg-stone-900/90 rounded-xl text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-wider mb-2 border border-slate-200 dark:border-white/5 shadow-inner truncate">
                  PKR {tenderedNumber.toLocaleString()}
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKeypadPress(k)}
                      className="py-2 sm:py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 font-bold text-xs sm:text-sm font-mono border border-slate-200 dark:border-white/5 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      {k === 'BS' ? '⌫' : k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-white/5 bg-white/60 dark:bg-stone-950/60 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-slate-700 dark:text-stone-300 font-bold text-xs border border-slate-200 dark:border-white/5 transition-all cursor-pointer shrink-0"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={
              isSubmitting ||
              (paymentMethod === 'cash' && !isExactOrMore) ||
              (paymentMethod === 'split' && !isSplitValid)
            }
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider text-white flex items-center gap-1.5 sm:gap-2 transition-all duration-200 shadow-xl cursor-pointer shrink-0 ${
              isSubmitting ||
              (paymentMethod === 'cash' && !isExactOrMore) ||
              (paymentMethod === 'split' && !isSplitValid)
                ? 'bg-stone-900 border border-white/5 text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 border border-emerald-400/20'
            }`}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {isSubmitting
                ? 'Processing...'
                : paymentMethod === 'split'
                ? `Complete Split (PKR ${splitTotalAllocated.toLocaleString()})`
                : 'Complete Payment'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
