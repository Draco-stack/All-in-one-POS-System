import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  X,
  CheckCircle,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount } from '../../types';

interface ManagerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle: string;
  actionDescription?: string;
  onAuthorized: (manager: UserAccount, reason: string) => void;
}

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({
  isOpen,
  onClose,
  actionTitle,
  actionDescription,
  onAuthorized,
}) => {
  const { users, currentUser } = useRestaurant();
  const [selectedManager, setSelectedManager] = useState<UserAccount | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Eligible managers / owners
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'owner' || u.role === 'admin');

  React.useEffect(() => {
    if (isOpen) {
      // If current user is already manager or owner, auto-select
      if (currentUser.role === 'manager' || currentUser.role === 'owner' || currentUser.role === 'admin') {
        setSelectedManager(currentUser);
      } else {
        setSelectedManager(managers[0] || null);
      }
      setEnteredPin('');
      setReason('');
      setErrorMessage(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    setErrorMessage(null);
    if (val === 'C') {
      setEnteredPin('');
    } else if (val === 'BS') {
      setEnteredPin((prev) => prev.slice(0, -1));
    } else if (enteredPin.length < 4) {
      const nextPin = enteredPin + val;
      setEnteredPin(nextPin);
      if (nextPin.length === 4 && selectedManager) {
        verifyPin(nextPin, selectedManager);
      }
    }
  };

  const verifyPin = (pin: string, manager: UserAccount) => {
    if (manager.pin === pin) {
      if (!reason.trim()) {
        setErrorMessage('Please provide a mandatory reason for this managerial override.');
        return;
      }
      onAuthorized(manager, reason.trim());
      onClose();
    } else {
      setErrorMessage('Invalid Manager Security PIN. Authorization denied.');
      setEnteredPin('');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) {
      setErrorMessage('Please select an authorized Manager or Owner.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Please enter a mandatory audit reason.');
      return;
    }
    verifyPin(enteredPin, selectedManager);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-stone-950/60 backdrop-blur-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Manager PIN Authorization</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">{actionTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
          {actionDescription && (
            <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 shadow-inner">
              {actionDescription}
            </div>
          )}

          {/* Manager Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-1.5">
              Select Authorizing Manager / Owner:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {managers.map((mgr) => {
                const isSelected = selectedManager?.id === mgr.id;
                return (
                  <button
                    key={mgr.id}
                    type="button"
                    onClick={() => {
                      setSelectedManager(mgr);
                      setEnteredPin('');
                      setErrorMessage(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 text-white ring-1 ring-emerald-500/30 shadow-md'
                        : 'bg-stone-950/80 border-white/5 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-bold text-xs block text-stone-200">{mgr.name}</span>
                      <span className="text-[9px] uppercase font-mono font-bold text-stone-400">
                        {mgr.role}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-1">
              Audit Reason (Mandatory) *:
            </label>
            <input
              type="text"
              placeholder="e.g. Customer changed item / Kitchen mistake / Void ticket"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorMessage(null);
              }}
              required
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          {/* PIN Input Indicator */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-1.5 text-center">
              Enter 4-Digit Security PIN:
            </label>
            <div className="flex justify-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-12 rounded-xl border flex items-center justify-center text-lg font-black transition-all shadow-inner ${
                      isFilled
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400 scale-105 shadow-emerald-950/30'
                        : 'bg-stone-950/90 border-white/10 text-stone-600'
                    }`}
                  >
                    {isFilled ? '●' : '—'}
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <p className="text-xs text-red-400 text-center font-semibold mt-1">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Fast On-Screen Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className={`h-11 rounded-xl font-mono font-bold text-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-sm ${
                  k === 'C'
                    ? 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40'
                    : k === 'BS'
                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-white/5'
                    : 'bg-stone-900 hover:bg-stone-800 text-stone-100 border border-white/5'
                }`}
              >
                {k === 'BS' ? '⌫' : k}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enteredPin.length !== 4 || !reason.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-lg border border-emerald-400/20"
            >
              Authorize Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
