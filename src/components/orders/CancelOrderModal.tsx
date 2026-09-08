import React, { useState } from 'react';
import { Order } from '../../types';
import { useRestaurant } from '../../context/RestaurantContext';
import { X, AlertTriangle, Check } from 'lucide-react';
import { ManagerOverrideModal } from '../auth/ManagerOverrideModal';

interface CancelOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onCancelled?: () => void;
}

const COMMON_CANCEL_REASONS = [
  'Duplicate order one from branch and cc',
  'Customer change of mind',
  'Customer was not responding',
  'Transferred to another branch',
  'Kitchen out of stock / unable to fulfill',
  'Other custom reason',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({ order, onClose, onCancelled }) => {
  const { cancelOrder, currentUser } = useRestaurant();
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState<boolean>(false);

  if (!order) return null;

  const isCashier = currentUser?.role?.toLowerCase() === 'cashier';

  const executeCancel = async (managerPin?: string, overrideReason?: string) => {
    let finalReason = overrideReason;
    if (!finalReason) {
      if (selectedReason === 'Other custom reason' && !customReason.trim()) {
        alert('Please enter a specific cancellation reason in the text box.');
        return;
      }
      if (customReason.trim()) {
        finalReason = selectedReason === 'Other custom reason'
          ? customReason.trim()
          : `${selectedReason} - ${customReason.trim()}`;
      } else {
        finalReason = selectedReason;
      }
    }
    setIsSubmitting(true);
    try {
      await cancelOrder(order.id, finalReason, managerPin || currentUser?.pin);
      if (onCancelled) onCancelled();
      onClose();
    } catch (err) {
      console.error('Cancel order execution error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = () => {
    if (isCashier) {
      setIsManagerModalOpen(true);
    } else {
      executeCancel();
    }
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

          <div>
            <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">
              {selectedReason === 'Other custom reason' ? 'Custom Cancellation Reason (Required):' : 'Additional Details / Notes (Optional):'}
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={selectedReason === 'Other custom reason' ? "Please specify cancellation reason..." : "Enter additional cancellation notes or details..."}
              className="w-full bg-stone-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500/50"
            />
          </div>

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

      <ManagerOverrideModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title={`Manager Authorization - Cancel Order ${order.orderNumber}`}
        actionDescription="Punched orders cannot be cancelled without an authorizing Manager/Owner PIN and logged reason."
        onAuthorized={(manager, reason) => {
          setIsManagerModalOpen(false);
          executeCancel(manager.pin, reason);
        }}
      />
    </div>
  );
};
