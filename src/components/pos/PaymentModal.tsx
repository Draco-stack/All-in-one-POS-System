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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-stone-950/60 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-black text-xs shadow-md border border-emerald-400/20">
              PKR
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Payment & Tender Register</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Select payment method & tender amount</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all font-semibold text-xs cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30 shadow-md'
                  : 'bg-stone-950/80 border-white/5 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <Banknote className="w-5 h-5 text-emerald-400" />
              Cash In Hand
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all font-semibold text-xs cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-gradient-to-b from-blue-950/60 to-blue-900/30 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/30 shadow-md'
                  : 'bg-stone-950/80 border-white/5 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <CreditCard className="w-5 h-5 text-blue-400" />
              Debit / Credit Card
            </button>

            <button
              onClick={() => setPaymentMethod('online')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all font-semibold text-xs cursor-pointer ${
                paymentMethod === 'online'
                  ? 'bg-gradient-to-b from-purple-950/60 to-purple-900/30 border-purple-500/50 text-purple-300 ring-1 ring-purple-500/30 shadow-md'
                  : 'bg-stone-950/80 border-white/5 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
              }`}
            >
              <QrCode className="w-5 h-5 text-purple-400" />
              QR / Digital Pay
            </button>
          </div>

          {/* Amount Due vs Tendered Banner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-stone-950/90 rounded-2xl border border-white/5 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Total Amount Due</span>
              <p className="text-2xl font-black text-white font-mono mt-1">
                PKR {total.toLocaleString()}
              </p>
            </div>

            <div className={`p-4 rounded-2xl border ${changeDue >= 0 ? 'bg-emerald-950/40 border-emerald-500/30 shadow-inner' : 'bg-red-950/40 border-red-500/30 shadow-inner'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Change Due to Customer</span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                PKR {changeDue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Cash Bills & Input Keypad */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setTenderedInput(total.toString())}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-950 to-stone-900 hover:from-emerald-900 hover:to-stone-800 text-xs font-black text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                >
                  Exact (PKR {total})
                </button>
                {quickCashBills.map((bill) => (
                  <button
                    key={bill}
                    onClick={() => setTenderedInput(bill.toString())}
                    className="flex-1 py-2 rounded-xl bg-stone-950/90 hover:bg-stone-800 text-xs font-bold font-mono text-stone-300 border border-white/5 transition-all cursor-pointer"
                  >
                    PKR {bill}
                  </button>
                ))}
              </div>

              {/* Numeric Display & Keypad */}
              <div className="bg-stone-950/90 p-3 rounded-2xl border border-white/5 shadow-inner">
                <div className="text-right px-4 py-2.5 bg-stone-900/90 rounded-xl text-2xl font-black font-mono text-emerald-400 tracking-wider mb-2.5 border border-white/5 shadow-inner">
                  PKR {tenderedNumber.toLocaleString()}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKeypadPress(k)}
                      className="py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 font-bold text-sm font-mono border border-white/5 transition-all active:scale-95 cursor-pointer shadow-sm"
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
        <div className="p-4 border-t border-white/5 bg-stone-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold text-xs border border-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)}
            className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white flex items-center gap-2 transition-all duration-200 shadow-xl cursor-pointer ${
              isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)
                ? 'bg-stone-900 border border-white/5 text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 border border-emerald-400/20'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? 'Processing...' : 'Complete Payment & Print'}
          </button>
        </div>
      </div>
    </div>
  );
};
