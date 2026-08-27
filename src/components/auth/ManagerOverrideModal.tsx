import React, { useState } from 'react';
import { X, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount } from '../../types';

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actionDescription?: string;
  onAuthorized: (manager: UserAccount, reason: string) => void;
}

export const ManagerOverrideModal: React.FC<ManagerOverrideModalProps> = ({
  isOpen,
  onClose,
  title = 'Manager Security Authorization Required',
  actionDescription = 'Modifying or cancelling punched orders requires Manager or Owner PIN approval.',
  onAuthorized,
}) => {
  const { users } = useRestaurant();
  const [selectedManager, setSelectedManager] = useState<UserAccount | null>(null);
  const [pin, setPin] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter only managers and owners
  const authorizedUsers = users.filter(
    (u) => u.role.toLowerCase() === 'manager' || u.role.toLowerCase() === 'owner' || u.role.toLowerCase() === 'admin'
  );

  React.useEffect(() => {
    if (isOpen) {
      setSelectedManager(authorizedUsers[0] || null);
      setPin('');
      setReason('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    setErrorMsg(null);
    if (val === 'C') {
      setPin('');
    } else if (val === 'BS') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 4) {
      setPin((prev) => prev + val);
    }
  };

  const handleAuthorizeSubmit = () => {
    if (!selectedManager) {
      setErrorMsg('Please select an authorizing Manager/Owner.');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('Please enter a 4-digit PIN.');
      return;
    }
    if (selectedManager.pin !== pin) {
      setErrorMsg('Invalid Manager PIN. Access denied.');
      setPin('');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('A brief reason for audit logging is required.');
      return;
    }

    onAuthorized(selectedManager, reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">{title}</h3>
              <p className="text-xs text-stone-400">{actionDescription}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Manager Selector */}
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">
              Authorizing Manager / Owner:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {authorizedUsers.map((mgr) => {
                const isSelected = selectedManager?.id === mgr.id;
                return (
                  <button
                    key={mgr.id}
                    onClick={() => {
                      setSelectedManager(mgr);
                      setPin('');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 shadow-md'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-800/80 text-stone-400'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-amber-500 text-stone-950 font-black' : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {mgr.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{mgr.name}</p>
                      <p className="text-[10px] text-amber-400 uppercase font-mono">{mgr.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason Input (Audit Log) */}
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
              Reason for Modification / Cancellation <span className="text-red-400">*</span>:
            </label>
            <input
              type="text"
              placeholder="e.g. Customer changed item / Kitchen shortage / Wrong price"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* PIN Input Dots & Keypad */}
          <div className="space-y-3 max-w-xs mx-auto pt-1">
            <div className="text-center">
              <span className="text-xs font-bold text-stone-400 uppercase">Enter Manager 4-Digit PIN:</span>
              <div className="flex justify-center gap-3 my-2">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        filled
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-lg shadow-amber-500/50'
                          : 'bg-stone-950 border-stone-700'
                      }`}
                    />
                  );
                })}
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 font-semibold animate-shake">{errorMsg}</p>
              )}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeypadPress(k)}
                  className="py-2.5 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-200 font-mono font-bold text-base border border-stone-800/80 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  {k === 'BS' ? '⌫' : k}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleAuthorizeSubmit}
              disabled={pin.length !== 4 || !reason.trim()}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-extrabold text-xs shadow-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Authorize & Proceed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
