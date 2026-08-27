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
    <div id="cancel-order-modal" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-red-950/40 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">Cancel Order {order.orderNumber}</h3>
          </div>
          <button
            id="close-cancel-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm text-stone-300">
          <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
            <div className="flex justify-between font-bold text-white">
              <span>{order.customer?.name || 'Walk-in Guest'}</span>
              <span className="text-amber-400">${order.total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-stone-400">
              Type: {order.type.toUpperCase()} • Items: {order.items.length} items • Paid via {order.paymentMethod}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
              Select Reason for Cancellation:
            </label>
            <div className="space-y-1.5">
              {COMMON_CANCEL_REASONS.map((reason) => (
                <label
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    selectedReason === reason
                      ? 'bg-red-500/10 border-red-500/50 text-white font-medium'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-red-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other manager override' && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">Specify Reason:</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom cancellation notes..."
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs text-red-300 leading-relaxed">
            ⚠️ <strong>Warning:</strong> Cancelling this order will mark it as cancelled, stop kitchen preparation, and reverse the sales amount from the current shift register.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-end gap-2">
          <button
            id="abort-cancel-order-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer transition"
          >
            Keep Order
          </button>
          <button
            id="confirm-cancel-order-btn"
            disabled={isSubmitting}
            onClick={handleConfirmCancel}
            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-lg shadow-red-600/30"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Cancelling...' : 'Confirm Cancel Order'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
