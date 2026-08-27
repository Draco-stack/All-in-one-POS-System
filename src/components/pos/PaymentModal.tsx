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
      await onComplete(tenderedNumber, paymentMethod);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00897b] flex items-center justify-center text-white font-bold">
              PKR
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Payment & Tender Register</h3>
              <p className="text-xs text-stone-400">Select payment method & tender amount</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition font-semibold text-xs cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-[#00897b]/20 border-[#00897b] text-emerald-300'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-800'
              }`}
            >
              <Banknote className="w-5 h-5 text-emerald-400" />
              Cash In Hand
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition font-semibold text-xs cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-800'
              }`}
            >
              <CreditCard className="w-5 h-5 text-blue-400" />
              Debit / Credit Card
            </button>

            <button
              onClick={() => setPaymentMethod('online')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition font-semibold text-xs cursor-pointer ${
                paymentMethod === 'online'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-800'
              }`}
            >
              <QrCode className="w-5 h-5 text-purple-400" />
              QR / Digital Pay
            </button>
          </div>

          {/* Amount Due vs Tendered Banner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-stone-950 rounded-xl border border-stone-800">
              <span className="text-xs text-stone-400">Total Amount Due</span>
              <p className="text-2xl font-black text-white font-mono mt-0.5">
                PKR {total.toLocaleString()}
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border ${changeDue >= 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-red-950/40 border-red-500/30'}`}>
              <span className="text-xs text-stone-400">Change Due to Customer</span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
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
                  className="flex-1 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-bold text-emerald-400 border border-stone-700 transition cursor-pointer"
                >
                  Exact (PKR {total})
                </button>
                {quickCashBills.map((bill) => (
                  <button
                    key={bill}
                    onClick={() => setTenderedInput(bill.toString())}
                    className="flex-1 py-2 rounded-lg bg-stone-950 hover:bg-stone-800 text-xs font-bold text-stone-300 border border-stone-800 transition cursor-pointer"
                  >
                    PKR {bill}
                  </button>
                ))}
              </div>

              {/* Numeric Display & Keypad */}
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                <div className="text-right px-3 py-2 bg-stone-900 rounded-lg text-xl font-black font-mono text-white tracking-wider mb-2 border border-stone-800">
                  PKR {tenderedNumber.toLocaleString()}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleKeypadPress(k)}
                      className="py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-200 font-bold text-sm font-mono border border-stone-800/80 transition active:scale-95 cursor-pointer"
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
        <div className="p-4 border-t border-stone-800 bg-stone-950/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)}
            className={`px-8 py-3 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition shadow-lg cursor-pointer ${
              isSubmitting || (paymentMethod === 'cash' && !isExactOrMore)
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-[#00897b] hover:bg-[#00796b] shadow-emerald-950/50'
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
