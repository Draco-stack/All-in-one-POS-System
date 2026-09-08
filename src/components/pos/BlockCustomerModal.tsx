import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, User, Phone, CheckCircle2 } from 'lucide-react';

interface BlockCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  customerName?: string;
  onConfirmBlock: (reason: string) => Promise<void> | void;
}

const PRESET_REASONS = [
  'Fake / Prank Orders',
  'Refused Delivery / COD Payment Default',
  'Abusive to Staff / Rider',
  'Fake / Unreachable Address',
  'Frequent Repeated Cancellations',
  'Payment Fraud / Card Chargeback',
  'Security & Store Policy Violation',
];

export const BlockCustomerModal: React.FC<BlockCustomerModalProps> = ({
  isOpen,
  onClose,
  phone,
  customerName,
  onConfirmBlock,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, phone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required to block this customer number.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirmBlock(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to block customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-red-500/30 ring-1 ring-red-500/20 rounded-2xl w-full max-w-md overflow-hidden text-stone-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-red-950/40 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Block Customer Number</h3>
              <p className="text-[11px] text-red-300/80 font-medium">Prevent order placement and flag blacklist</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Identifier Card */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-stone-950/80 border border-white/5 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-800 text-stone-300 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{customerName || 'Customer Profile'}</span>
                <span className="text-[11px] font-mono text-stone-400 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-red-400" />
                  {phone || 'No phone'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/30">
              Blacklist Target
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 pt-2 space-y-4">
          <div>
            <label className="block text-[11px] uppercase font-bold tracking-wider text-stone-300 mb-1.5 flex items-center justify-between">
              <span>Required Reason for Blocking *</span>
              <span className="text-red-400 text-[10px] lowercase font-normal">(mandatory)</span>
            </label>

            {/* Quick Preset Badges */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {PRESET_REASONS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setReason(preset);
                    setError('');
                  }}
                  className={`text-[10.5px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer text-left ${
                    reason === preset
                      ? 'bg-red-600 text-white border-red-400'
                      : 'bg-stone-950/60 text-stone-300 border-white/10 hover:bg-stone-800 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              required
              placeholder="Provide a specific, detailed explanation for blocking this number..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/40 shadow-inner"
            />
            {error && (
              <p className="text-[11px] text-red-400 font-semibold mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-[11px] text-red-300/90 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              Effect of Blocking:
            </p>
            <p className="text-stone-400 leading-snug">
              When this phone number is searched in POS or added to a ticket, a blocking alert popup will appear and the POS will strictly block order creation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-white/10 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-black transition cursor-pointer shadow-lg shadow-red-950 flex items-center gap-1.5 border border-red-400/30"
            >
              <ShieldAlert className="w-4 h-4" />
              {isSubmitting ? 'Blocking...' : 'Confirm & Block Number'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
