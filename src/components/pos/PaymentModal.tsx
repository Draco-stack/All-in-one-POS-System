import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Banknote, CreditCard, QrCode, ArrowRight } from 'lucide-react';
import { PaymentMethod } from '../../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  tax: number;
  discount: number;
  deliveryFee: number;
  tip: number;
  total: number;
  onComplete: (tendered: number, paymentMethod: PaymentMethod) => Promise<void>;
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

  useEffect(() => {
    if (isOpen) {
      setTenderedInput(total.toString());
      setPaymentMethod('cash');
      setIsSubmitting(false);
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const tenderedNumber = parseFloat(tenderedInput) || 0;
  const changeDue = Math.max(0, tenderedNumber - total);
  const isExactOrMore = tenderedNumber >= total;

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

  const handlePay = async () => {
    if (paymentMethod === 'cash' && !isExactOrMore) return;
    setIsSubmitting(true);
    try {
      const finalTendered = paymentMethod === 'cash' ? tenderedNumber : (tenderedNumber > 0 ? tenderedNumber : total);
      await onComplete(finalTendered, paymentMethod);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/60 dark:bg-stone-950/60 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-black text-xs shadow-md border border-emerald-400/20 shrink-0">
              PKR
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base truncate">Payment & Tender Register</h3>
              <p className="text-[9.5px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 truncate">Select payment method & tender amount</p>
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
          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all font-semibold text-[11px] sm:text-xs cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-full">Cash In Hand</span>
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all font-semibold text-[11px] sm:text-xs cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-gradient-to-b from-blue-950/60 to-blue-900/30 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
              <span className="truncate max-w-full">Card Pay</span>
            </button>

            <button
              onClick={() => setPaymentMethod('online')}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all font-semibold text-[11px] sm:text-xs cursor-pointer ${
                paymentMethod === 'online'
                  ? 'bg-gradient-to-b from-purple-950/60 to-purple-900/30 border-purple-500/50 text-purple-300 ring-1 ring-purple-500/30 shadow-md'
                  : 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
              <span className="truncate max-w-full">QR / Digital</span>
            </button>
          </div>

          {/* Amount Due vs Tendered Banner */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 bg-stone-950/90 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block truncate">Total Amount Due</span>
              <p className="text-lg sm:text-2xl font-black text-white font-mono mt-0.5 sm:mt-1 truncate">
                PKR {total.toLocaleString()}
              </p>
            </div>

            <div className={`p-3 sm:p-4 rounded-2xl border ${changeDue >= 0 ? 'bg-emerald-950/40 border-emerald-500/30 shadow-inner' : 'bg-red-950/40 border-red-500/30 shadow-inner'}`}>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-stone-400 block truncate">Change Due</span>
              <p className="text-lg sm:text-2xl font-black text-emerald-400 font-mono mt-0.5 sm:mt-1 truncate">
                PKR {changeDue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Cash Bills & Input Keypad */}
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
                    className="flex-1 min-w-[70px] py-1.5 sm:py-2 px-1.5 rounded-xl bg-stone-950/90 hover:bg-slate-100 dark:hover:bg-stone-800 text-[11px] sm:text-xs font-bold font-mono text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-white/5 transition-all cursor-pointer truncate"
                  >
                    PKR {bill}
                  </button>
                ))}
              </div>

              {/* Numeric Display & Keypad */}
              <div className="bg-stone-950/90 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
                <div className="text-right px-3 py-2 bg-white dark:bg-stone-900/90 rounded-xl text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-wider mb-2 border border-slate-200 dark:border-white/5 shadow-inner truncate">
                  PKR {tenderedNumber.toLocaleString()}
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKeypadPress(k)}
                      className="py-2 sm:py-2.5 rounded-xl bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 text-stone-200 font-bold text-xs sm:text-sm font-mono border border-slate-200 dark:border-white/5 transition-all active:scale-95 cursor-pointer shadow-sm"
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
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-300 font-bold text-xs border border-slate-200 dark:border-white/5 transition-all cursor-pointer shrink-0"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider text-white flex items-center gap-1.5 sm:gap-2 transition-all duration-200 shadow-xl cursor-pointer shrink-0 ${
              isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)
                ? 'bg-white dark:bg-stone-900 border border-slate-200 dark:border-white/5 text-slate-400 dark:text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 border border-emerald-400/20'
            }`}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{isSubmitting ? 'Processing...' : 'Complete Payment'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
