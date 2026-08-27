import React, { useState } from 'react';
import { X, ShieldCheck, Lock, CheckCircle2, User } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount } from '../../types';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser, setCurrentUser, showToast, logoutUser } = useRestaurant();
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(currentUser);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedUser(currentUser);
      setEnteredPin('');
      setErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    setErrorMsg(null);
    if (val === 'C') {
      setEnteredPin('');
    } else if (val === 'BS') {
      setEnteredPin((prev) => prev.slice(0, -1));
    } else if (enteredPin.length < 4) {
      const nextPin = enteredPin + val;
      setEnteredPin(nextPin);
      if (nextPin.length === 4 && selectedUser) {
        verifyAndSwitch(nextPin, selectedUser);
      }
    }
  };

  const verifyAndSwitch = (pinToTest: string, targetUser: UserAccount) => {
    if (targetUser.pin === pinToTest) {
      setCurrentUser(targetUser);
      showToast(`✓ Switched session to ${targetUser.name} (${targetUser.role.toUpperCase()})`);
      onClose();
    } else {
      setErrorMsg('Incorrect PIN. Please try again.');
      setEnteredPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00897b]/20 border border-[#00897b]/40 text-[#00897b] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Quick Staff User Switch</h3>
              <p className="text-xs text-stone-400">Select employee and enter 4-digit security PIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* User Select Pills */}
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">
              Select Operator / Cashier:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {users.filter(u => u.active !== false && u.role !== 'rider').map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setEnteredPin('');
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#00897b]/20 border-[#00897b] shadow-md'
                        : 'bg-stone-950 border-stone-800 hover:bg-stone-800/80 text-stone-400'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-[#00897b] text-white' : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {u.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{u.name.split(' ')[0]}</p>
                      <p className="text-[10px] text-stone-400 uppercase font-mono">{u.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input Dots & Keypad */}
          <div className="space-y-4 max-w-xs mx-auto">
            <div className="text-center">
              <div className="flex justify-center gap-3 my-2">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = enteredPin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        filled
                          ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                          : 'bg-stone-950 border-stone-700'
                      }`}
                    />
                  );
                })}
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 font-semibold animate-shake mt-1">{errorMsg}</p>
              )}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS'].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeypadPress(k)}
                  className="py-3 rounded-2xl bg-stone-950 hover:bg-stone-800 text-stone-200 font-mono font-bold text-base border border-stone-800/80 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  {k === 'BS' ? '⌫' : k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info & Login Screen fallback button */}
        <div className="p-3 border-t border-stone-800 bg-stone-950 flex items-center justify-end text-[11px] text-stone-400 font-mono">
          <button
            onClick={() => {
              onClose();
              logoutUser();
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold border border-emerald-500/30 transition cursor-pointer"
          >
            Email Login Screen →
          </button>
        </div>
      </div>
    </div>
  );
};
