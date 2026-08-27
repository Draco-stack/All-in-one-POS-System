import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Key,
  Plus,
  Lock,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount, UserRole } from '../../types';

export const StaffManagementView: React.FC = () => {
  const { users, currentUser, addNewUser, updateUserPin, deleteUser, showToast } = useRestaurant();
  const [showPins, setShowPins] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUserForPin, setSelectedUserForPin] = useState<UserAccount | null>(null);
  const [newPinInput, setNewPinInput] = useState('');

  // New staff form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [outlet, setOutlet] = useState('Main Branch');

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || pin.length !== 4) {
      showToast('Name, username, and a 4-digit PIN are required.');
      return;
    }

    addNewUser({
      name,
      username,
      pin,
      role,
      outlet,
      active: true,
    });

    setIsAddUserModalOpen(false);
    setName('');
    setUsername('');
    setPin('');
  };

  const handleSaveNewPin = () => {
    if (!selectedUserForPin || newPinInput.length !== 4) {
      showToast('PIN must be exactly 4 digits.');
      return;
    }
    updateUserPin(selectedUserForPin.id, newPinInput);
    setSelectedUserForPin(null);
    setNewPinInput('');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-stone-950 text-stone-100 font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00897b]" />
            Staff Accounts, Role Permissions & PIN Security
          </h2>
          <p className="text-xs text-stone-400">
            Audit staff credentials, reset 4-digit switch PINs, and manage Role-Based Access Control (RBAC).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPins(!showPins)}
            className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-stone-700 cursor-pointer"
          >
            {showPins ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-stone-400" />}
            <span>{showPins ? 'Hide PINs' : 'Reveal PINs'}</span>
          </button>

          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {users.map((u) => {
          const isCurrent = u.id === currentUser.id;
          return (
            <div
              key={u.id}
              className={`bg-stone-900 border rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-3 relative ${
                isCurrent ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-stone-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-mono font-bold border ${
                      u.role === 'owner'
                        ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                        : u.role === 'manager'
                        ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                        : 'bg-stone-800 border-stone-700 text-stone-300'
                    }`}
                  >
                    {u.role}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Logged In
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-white mt-2">{u.name}</h3>
                <p className="text-xs text-stone-400 font-mono">@{u.username}</p>
                <p className="text-[11px] text-stone-500 mt-1">{u.outlet}</p>
              </div>

              {/* PIN Box */}
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>PIN:</span>
                  <span className="font-bold text-white tracking-widest text-sm">
                    {showPins ? u.pin : '••••'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedUserForPin(u);
                    setNewPinInput('');
                  }}
                  className="text-[11px] text-[#00897b] hover:underline font-semibold cursor-pointer"
                >
                  Change PIN
                </button>
              </div>

              {currentUser.role === 'owner' && !isCurrent && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to delete ${u.name}?`)) {
                        await deleteUser(u.id);
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Staff</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Credentials Cheatsheet */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          Default Staff Switch Access Reference
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2 bg-stone-950 rounded-lg border border-stone-800">
            <span className="text-purple-400 font-bold block">Owner</span>
            <span className="text-stone-300">PIN: </span>
            <strong className="text-white">1111</strong>
          </div>
          <div className="p-2 bg-stone-950 rounded-lg border border-stone-800">
            <span className="text-blue-400 font-bold block">Manager</span>
            <span className="text-stone-300">PIN: </span>
            <strong className="text-white">2222</strong>
          </div>
          <div className="p-2 bg-stone-950 rounded-lg border border-stone-800">
            <span className="text-emerald-400 font-bold block">Cashier 1</span>
            <span className="text-stone-300">PIN: </span>
            <strong className="text-white">3333</strong>
          </div>
          <div className="p-2 bg-stone-950 rounded-lg border border-stone-800">
            <span className="text-emerald-400 font-bold block">Cashier 2</span>
            <span className="text-stone-300">PIN: </span>
            <strong className="text-white">4444</strong>
          </div>
        </div>
      </div>

      {/* CHANGE PIN MODAL */}
      {selectedUserForPin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">
                Change PIN for {selectedUserForPin.name}
              </h3>
              <button
                onClick={() => setSelectedUserForPin(null)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">
                  New 4-Digit Security PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="e.g. 5555"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedUserForPin(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewPin}
                  disabled={newPinInput.length !== 4}
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] disabled:opacity-50 text-white text-xs font-bold shadow-md"
                >
                  Update PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MEMBER MODAL */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">Add New Staff Member</h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Usman Ghani"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-300 font-semibold block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. usman_cashier"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-300 font-semibold block mb-1">4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs font-mono text-center tracking-widest text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Access Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                >
                  <option value="cashier">Cashier (POS & Billing)</option>
                  <option value="manager">Manager (Discounts, Stock, Kitchen)</option>
                  <option value="owner">Owner (Full Super Admin & PIN resets)</option>
                  <option value="kitchen">Kitchen Line Chef</option>
                  <option value="rider">Dispatch Delivery Rider</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold shadow-md"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
