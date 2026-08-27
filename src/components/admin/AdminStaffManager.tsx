import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Trash2,
  Power,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Building,
  Calendar,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount, UserRole } from '../../types';

export const AdminStaffManager: React.FC = () => {
  const { users, currentUser, addNewUser, updateUserPin, toggleUserActive, deleteUser, showToast, outlets, getRiderStats } = useRestaurant();

  // Role filter tab
  const [roleFilter, setRoleFilter] = useState<'all' | 'operators' | 'riders'>('all');

  // Modal States
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [targetUserForPin, setTargetUserForPin] = useState<UserAccount | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>('');

  // Async Deletion Loader State
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (u: UserAccount) => {
    if (!confirm(`Are you sure you want to permanently remove staff account "${u.name}"?`)) return;
    setDeletingUserId(u.id);
    try {
      await deleteUser(u.id);
    } catch (err: any) {
      showToast(`❌ Error deleting user: ${err.message || 'Server error'}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'operators') return u.role !== 'rider';
    if (roleFilter === 'riders') return u.role === 'rider';
    return true;
  });

  // Form State for Add User
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    pin: string;
    role: UserRole;
    outlet: string;
  }>({
    name: '',
    username: '',
    pin: '',
    role: 'cashier',
    outlet: 'Main Branch',
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim() || !formData.pin.trim()) {
      showToast('All fields including Email Address and PIN / Password are required');
      return;
    }
    if (formData.pin.length < 4) {
      showToast('PIN / Password must be at least 4 digits');
      return;
    }

    // Role Guardrail: Cashier or Manager cannot create Owner unless current user is Owner
    if (formData.role === 'owner' && currentUser.role !== 'owner') {
      showToast('⚠️ Only an existing Owner can provision new Owner accounts.');
      return;
    }

    addNewUser({
      name: formData.name.trim(),
      username: formData.username.trim().toLowerCase(),
      pin: formData.pin.trim(),
      role: formData.role,
      outlet: formData.outlet,
      active: true,
    });

    setIsAddUserOpen(false);
    setFormData({
      name: '',
      username: '',
      pin: '',
      role: 'cashier',
      outlet: 'Main Branch',
    });
  };

  const handleOpenPinReset = (u: UserAccount) => {
    setTargetUserForPin(u);
    setNewPinValue('');
    setIsPinModalOpen(true);
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPin) return;
    if (newPinValue.length !== 4 || !/^\d{4}$/.test(newPinValue)) {
      showToast('PIN must be exactly 4 numerical digits');
      return;
    }
    updateUserPin(targetUserForPin.id, newPinValue);
    setIsPinModalOpen(false);
    setTargetUserForPin(null);
  };

  // Permission Matrix Rows
  const permissionMatrix = [
    { permission: 'Floor POS Cashout & Order Punching', cashier: true, manager: true, owner: true },
    { permission: 'One-Click Order Dispatch & Delivery Assign', cashier: true, manager: true, owner: true },
    { permission: 'Hold / Park & Recall Floor Orders', cashier: true, manager: true, owner: true },
    { permission: 'Cancel Order & Sales Ledger Deduction (PIN Auth)', cashier: false, manager: true, owner: true },
    { permission: 'Modify Punched Order Items & Price Delta', cashier: false, manager: true, owner: true },
    { permission: 'Menu Items & Price Overrides Management', cashier: false, manager: true, owner: true },
    { permission: 'Shift Closing Audit & Cash Reconciliations', cashier: false, manager: true, owner: true },
    { permission: 'Full Admin Dashboard & Staff Provisioning', cashier: false, manager: true, owner: true },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Add */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00897b]" />
            Staff Accounts & Role-Based Access Control (RBAC)
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Manage terminal credentials, enforce strict role boundaries, and instantly revoke staff access
          </p>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-[#00897b]/20 transition cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Provision Staff Member
        </button>
      </div>

      {/* Staff Accounts Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-stone-800 gap-3">
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-950 rounded-xl border border-stone-800">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              All Accounts ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('operators')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'operators'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Register & POS Staff ({users.filter(u => u.role !== 'rider').length})
            </button>
            <button
              onClick={() => setRoleFilter('riders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'riders'
                  ? 'bg-[#00897b]/20 text-[#00897b] border border-[#00897b]/30 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              🛵 Delivery Fleet / Riders ({users.filter(u => u.role === 'rider').length})
            </button>
          </div>

          <div className="text-xs text-stone-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active Terminal / Fleet Sessions</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300 border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Staff Member</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3">Fleet Performance / Outlet</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-sans">
              {filteredUsers.map((u) => {
                const isActive = u.active !== false;
                const isCurrent = u.id === currentUser.id;
                const isRider = u.role === 'rider';
                const riderStats = isRider ? getRiderStats(u.name) : null;

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-stone-800/40 transition ${!isActive ? 'opacity-55 bg-stone-950/40' : ''}`}
                  >
                    {/* Name & Badge */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                            u.role === 'owner'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : u.role === 'manager'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : u.role === 'rider'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isRider ? '🛵' : u.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {u.name}
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 bg-[#00897b]/20 text-[#00897b] border border-[#00897b]/30 rounded text-[9px] font-bold">
                                You
                              </span>
                            )}
                            {isRider && (
                              <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded text-[9px] font-bold">
                                Fleet (No Login)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500">Joined {u.createdAt || '2025-01-01'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-3 px-3 font-mono text-stone-300 font-medium">@{u.username}</td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase font-mono border ${
                          u.role === 'owner'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                            : u.role === 'manager'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                            : u.role === 'rider'
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {u.role === 'rider' ? 'RIDER / FLEET' : u.role}
                      </span>
                    </td>

                    {/* Outlet & Rider Stats */}
                    <td className="py-3 px-3">
                      {isRider && riderStats ? (
                        <div className="space-y-1">
                          <div className="text-stone-300 font-medium text-[11px]">{u.outlet || 'Main Branch'}</div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="bg-stone-950 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-mono">
                              Total: {riderStats.totalAssigned}
                            </span>
                            <span className="bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
                              ✓ {riderStats.delivered} Del
                            </span>
                            <span className="bg-red-950/60 border border-red-800/40 px-1.5 py-0.5 rounded text-red-400 font-mono">
                              ✗ {riderStats.cancelled} Can
                            </span>
                            {riderStats.active > 0 && (
                              <span className="bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded text-amber-400 font-mono">
                                ⏳ {riderStats.active} Active
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-300 font-medium">{u.outlet || 'Main Branch'}</span>
                      )}
                    </td>

                    {/* Active / Inactive Status */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleUserActive(u.id)}
                        disabled={isCurrent && u.role === 'owner'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-stone-800 text-stone-500 border-stone-700 hover:bg-stone-700'
                        }`}
                        title="Click to toggle terminal access immediately"
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-stone-500" /> Revoked
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPinReset(u)}
                          className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-stone-700/60"
                          title="Reset POS 4-Digit PIN"
                        >
                          <KeyRound className="w-3 h-3 text-amber-400" />
                          Reset PIN
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={
                            deletingUserId === u.id ||
                            isCurrent ||
                            (u.role === 'owner' && users.filter((x) => x.role === 'owner').length <= 1)
                          }
                          className="p-1.5 text-stone-400 hover:text-red-400 bg-stone-800 hover:bg-red-950/40 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete Account"
                        >
                          {deletingUserId === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix Breakdown Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="pb-3 border-b border-stone-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Role Privilege Matrix & POS Guardrails
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Enforced backend & workstation route permission limits by role tier
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 font-mono">
            PIN-Gated Operations Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300 border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">System Operation / Action</th>
                <th className="py-2.5 px-3 text-center">Cashier</th>
                <th className="py-2.5 px-3 text-center">Manager</th>
                <th className="py-2.5 px-3 text-center">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-sans">
              {permissionMatrix.map((row, i) => (
                <tr key={i} className="hover:bg-stone-800/30 transition">
                  <td className="py-2 px-3 font-medium text-stone-200">{row.permission}</td>
                  <td className="py-2 px-3 text-center">
                    {row.cashier ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400/80 text-[11px]">
                        <X className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {row.manager ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                        <X className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {row.owner ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Full Access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                        <X className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Staff Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4.5 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#00897b]" />
                <h4 className="text-sm font-bold text-white">Provision New Staff Account</h4>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Email Address (Login Username) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. employee@whitescastle.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">PIN / Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="1234"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#00897b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="cashier">Cashier (POS Operator)</option>
                    <option value="manager">Manager (Shift Supervisor)</option>
                    <option value="rider">Rider (Delivery Fleet)</option>
                    {currentUser.role === 'owner' && <option value="owner">Owner (Full Administrator)</option>}
                  </select>
                </div>
              </div>

              {formData.role === 'rider' && (
                <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl text-cyan-300 text-xs flex items-start gap-2.5">
                  <span className="text-base leading-none">🛵</span>
                  <div>
                    <span className="font-bold text-cyan-200">Delivery Fleet Account:</span> Riders are recorded for order assignment, tracking, and fleet analytics. They do not log in to the POS cashier terminal, but appear in all driver assignment dropdowns with live order counts.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Assigned Outlet</label>
                <select
                  value={formData.outlet}
                  onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="Main Branch">Main Branch</option>
                  {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold transition cursor-pointer shadow-md shadow-[#00897b]/20"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {isPinModalOpen && targetUserForPin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4.5 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Reset Terminal PIN</h4>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPin} className="p-5 space-y-4">
              <div className="text-xs text-stone-300">
                Set a new 4-digit PIN for <span className="text-white font-bold">{targetUserForPin.name}</span> ({targetUserForPin.role.toUpperCase()})
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="••••"
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#00897b]"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  Save New PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
