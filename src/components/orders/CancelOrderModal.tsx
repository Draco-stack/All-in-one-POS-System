import React, { useState } from 'react';
import { Order } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, AlertTriangle, Check } from 'lucide-react';

interface CancelOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onCancelled?: () => void;
}

const COMMON_CANCEL_REASONS = [
  'Customer requested cancellation',
  'Kitchen out of stock / unable to fulfill',
  'Duplicate order punched in error',
  'Customer entered wrong address / unreachable',
  'Payment declined / issue',
  'Other manager override',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({ order, onClose, onCancelled }) => {
  const { cancelOrder } = useRestaurant();
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!order) return null;

  const handleConfirmCancel = async () => {
    setIsSubmitting(true);
    const finalReason = selectedReason === 'Other manager override' && customReason.trim() ? customReason.trim() : selectedReason;
    await cancelOrder(order.id, finalReason);
    setIsSubmitting(false);
    if (onCancelled) onCancelled();
    onClose();
  };

  return (
    <div id="cancel-order-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-rose-950/40 border-b border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-white text-base">Cancel Order {order.orderNumber}</h3>
          </div>
          <button
            id="close-cancel-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-stone-300">
          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-white/5 space-y-1">
            <div className="flex justify-between font-bold text-white text-sm">
              <span>{order.customer?.name || 'Walk-in Guest'}</span>
              <span className="text-amber-400 font-mono">PKR {order.total.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-stone-400">
              Type: {order.type.toUpperCase()} • Items: {order.items.length} items • Paid via {order.paymentMethod}
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Select Reason for Cancellation:
            </label>
            <div className="space-y-1.5">
              {COMMON_CANCEL_REASONS.map((reason) => (
                <label
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 font-bold ring-1 ring-rose-500/30'
                      : 'bg-stone-950/60 border-white/5 text-stone-400 hover:border-white/10 hover:text-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-rose-500 cursor-pointer"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other manager override' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Specify Reason:</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom cancellation notes..."
                className="w-full bg-stone-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500/50"
              />
            </div>
          )}

          <div className="p-3.5 bg-rose-950/20 border border-rose-900/30 rounded-xl text-[11px] text-rose-300 leading-relaxed">
            ⚠️ <strong>Warning:</strong> Cancelling this order will mark it as cancelled, stop kitchen preparation, and reverse the sales amount from the current shift register.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-950/60 border-t border-white/5 flex items-center justify-end gap-2.5">
          <button
            id="abort-cancel-order-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-bold border border-white/5 cursor-pointer transition-all"
          >
            Keep Order
          </button>
          <button
            id="confirm-cancel-order-btn"
            disabled={isSubmitting}
            onClick={handleConfirmCancel}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-lg border border-rose-400/20 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Cancelling...' : 'Confirm Cancel Order'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
