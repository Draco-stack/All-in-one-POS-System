import React from 'react';
import {
  ShieldAlert,
  X,
  AlertCircle,
  Phone,
  User,
  Calendar,
  History,
  Unlock,
  CheckCircle,
  Ban,
  Trash2,
} from 'lucide-react';
import { Customer } from '../../types';

interface BlockedCustomerAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  phone: string;
  onClearCustomer?: () => void;
  onUnblockCustomer?: (phone: string) => Promise<void> | void;
  onViewHistory?: () => void;
}

export const BlockedCustomerAlertModal: React.FC<BlockedCustomerAlertModalProps> = ({
  isOpen,
  onClose,
  customer,
  phone,
  onClearCustomer,
  onUnblockCustomer,
  onViewHistory,
}) => {
  if (!isOpen) return null;

  const displayPhone = phone || customer?.phone || 'Unknown Phone';
  const displayName = customer?.name && customer.name !== 'Blocked Customer' ? customer.name : 'Registered Blacklisted Profile';
  const blockReason = customer?.blockReason || 'Customer is on store restriction list due to prior order violations.';
  const blockedAt = customer?.blockedAt
    ? new Date(customer.blockedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent Policy Action';
  const blockedBy = customer?.blockedBy || 'Store Management';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 via-[#16161a] to-[#101014] border-2 border-red-500/70 ring-1 ring-red-500/40 rounded-3xl w-full max-w-lg overflow-hidden text-stone-100 shadow-[0_0_50px_rgba(239,68,68,0.35)] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Danger Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Ban className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-black/30 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
                  SYSTEM SECURITY BLOCK
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight mt-0.5">
                Blocked customer can&apos;t place an order
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Main Alert Message */}
          <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 text-red-200 flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-red-300">
                Order Placement & Ticket Creation Disabled
              </h4>
              <p className="text-xs text-red-200/90 leading-relaxed">
                This customer phone number has been officially blacklisted in the system. As per restaurant security policy, the POS workstation will strictly refuse order punching for this record.
              </p>
            </div>
          </div>

          {/* Customer & Reason Dossier */}
          <div className="bg-stone-950/90 border border-white/10 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-300">
                <User className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">{displayName}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-500/20">
                <Phone className="w-3.5 h-3.5" />
                {displayPhone}
              </div>
            </div>

            {/* Block Reason Box */}
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10.5px] uppercase font-black tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Mandatory Block Reason Logged:
              </span>
              <p className="text-xs font-medium text-red-100 bg-black/40 p-2.5 rounded-lg border border-red-500/20 font-sans leading-relaxed">
                &ldquo;{blockReason}&rdquo;
              </p>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>Blocked: <strong className="text-stone-300">{blockedAt}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-500" />
                <span>Logged By: <strong className="text-stone-300">{blockedBy}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {onClearCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    onClearCustomer();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-stone-400" />
                  Clear Customer From Cart
                </button>
              )}

              {onViewHistory && (
                <button
                  type="button"
                  onClick={() => {
                    onViewHistory();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  View Incident & Order History
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              {onUnblockCustomer && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to unblock customer ${displayPhone}?`)) {
                      await onUnblockCustomer(displayPhone);
                      onClose();
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition flex items-center gap-1.5 border border-emerald-500/30 cursor-pointer"
                >
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  Unblock Customer
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition cursor-pointer shadow-lg shadow-red-950 ml-auto border border-red-400/30"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
