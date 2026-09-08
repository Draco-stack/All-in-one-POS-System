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
  Pencil,
  Phone,
  Truck,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { UserAccount, UserRole } from '../../types';

export const AVAILABLE_CAPABILITIES = [
  { id: 'pos', label: 'POS Terminal Access', description: 'Access the register and punch orders' },
  { id: 'kitchen', label: 'Kitchen & Dispatch Access', description: 'Monitor incoming kitchen tickets' },
  { id: 'delivery', label: 'Delivery Monitoring Access', description: 'Manage riders and delivery fleet assignments' },
  { id: 'all-orders', label: 'All Orders Search Access', description: 'Search historical orders and issue duplicate receipts' },
  { id: 'orders', label: 'Orders & Refunds View', description: 'Inspect orders, void items, or issue refunds' },
  { id: 'menu', label: 'Menu Catalog Access', description: 'View and manage menu items, categories, and inventory' },
  { id: 'customers', label: 'Customers View Access', description: 'Access and search customer profiles' },
  { id: 'shift', label: 'Shift & Float view', description: 'Start/close shifts and inspect cash registers' },
  { id: 'admin_sales', label: 'Admin: Sales & Revenue Dashboard', description: 'Inspect sales performance and live margins' },
  { id: 'admin_menu', label: 'Admin: Menu Catalog Settings', description: 'Manage menu items and prices in admin dashboard' },
  { id: 'admin_staff', label: 'Admin: Staff & Roles (RBAC)', description: 'Configure staff accounts and granular restrictions' },
  { id: 'admin_reports', label: 'Admin: Reports & Shift Audits', description: 'Review terminal audit logs and reconciliation sheets' },
  { id: 'admin_riders', label: 'Admin: Fleet & Riders Management', description: 'Manage rider records and delivery analytics' },
  { id: 'admin_settings', label: 'Admin: System Configuration', description: 'Update system integrations, printers, and core parameters' },
];

export const AdminStaffManager: React.FC = () => {
  const { users, currentUser, addNewUser, updateUser, updateUserPin, toggleUserActive, deleteUser, showToast, outlets, getRiderStats, theme } = useRestaurant();

  // Role filter tab
  const [roleFilter, setRoleFilter] = useState<'all' | 'operators' | 'riders'>('all');

  // Modal States
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [targetUserForPin, setTargetUserForPin] = useState<UserAccount | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>('');

  // Edit Staff Modal States
  const [isEditUserOpen, setIsEditUserOpen] = useState<boolean>(false);
  const [targetUserForEdit, setTargetUserForEdit] = useState<UserAccount | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    role: UserRole;
    phone: string;
    restrictions: string[];
  }>({
    name: '',
    role: 'cashier',
    phone: '',
    restrictions: [],
  });
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

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
    phone: string;
    outlet: string;
    restrictions: string[];
  }>({
    name: '',
    username: '',
    pin: '',
    role: 'cashier',
    phone: '',
    outlet: 'Main Branch',
    restrictions: [],
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim() || !formData.pin.trim()) {
      showToast('All fields including Username and Password / PIN are required');
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
      phone: formData.phone.trim(),
      outlet: formData.outlet,
      active: true,
      restrictions: JSON.stringify(formData.restrictions),
    });

    setIsAddUserOpen(false);
    setFormData({
      name: '',
      username: '',
      pin: '',
      role: 'cashier',
      phone: '',
      outlet: 'Main Branch',
      restrictions: [],
    });
  };

  const handleOpenEdit = (u: UserAccount) => {
    setTargetUserForEdit(u);
    let initialRestrictions: string[] = [];
    try {
      if (u.restrictions) {
        initialRestrictions = JSON.parse(u.restrictions);
      }
    } catch (e) {
      console.error(e);
    }
    setEditFormData({
      name: u.name,
      role: u.role,
      phone: u.phone || '',
      restrictions: initialRestrictions,
    });
    setIsEditUserOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForEdit) return;
    if (!editFormData.name.trim()) {
      showToast('⚠️ Name is required.');
      return;
    }

    // Role Guardrail: Only Owner can assign/edit Owner roles
    if (editFormData.role === 'owner' && currentUser.role !== 'owner') {
      showToast('⚠️ Only an Owner can assign the Owner role.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const success = await updateUser(targetUserForEdit.id, {
        name: editFormData.name.trim(),
        role: editFormData.role,
        phone: editFormData.phone.trim(),
        restrictions: JSON.stringify(editFormData.restrictions || []),
      });
      if (success) {
        setIsEditUserOpen(false);
        setTargetUserForEdit(null);
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Server error'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenPinReset = (u: UserAccount) => {
    setTargetUserForPin(u);
    setNewPinValue('');
    setIsPinModalOpen(true);
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPin) return;
    if (!newPinValue.trim()) {
      showToast('Password cannot be empty');
      return;
    }
    updateUserPin(targetUserForPin.id, newPinValue.trim());
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
      <div className={`rounded-2xl p-5 border transition-colors ${
        theme === 'dark' 
          ? 'bg-[#0f1117] border-white/10 shadow-lg' 
          : 'bg-white border-slate-200/80 shadow-sm'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
            Staff Accounts & Role-Based Access Control (RBAC)
          </h3>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
            Manage terminal credentials, enforce strict role boundaries, and instantly revoke staff access
          </p>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-150 cursor-pointer self-start sm:self-auto border border-emerald-500/30"
        >
          <UserPlus className="w-4 h-4" />
          Provision Staff Member
        </button>
      </div>

      {/* Staff Accounts Table */}
      <div className={`rounded-2xl p-5 border transition-colors ${
        theme === 'dark' 
          ? 'bg-[#0f1117] border-white/10 shadow-lg' 
          : 'bg-white border-slate-200/80 shadow-sm'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b gap-3 ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          {/* Role Filter Tabs */}
          <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
            theme === 'dark' ? 'bg-[#090a0f] border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                roleFilter === 'all'
                  ? (theme === 'dark' ? 'bg-stone-800 text-white border border-white/10 shadow-sm' : 'bg-white text-slate-900 shadow-xs border-slate-300 border')
                  : (theme === 'dark' ? 'text-stone-400 hover:text-stone-200' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              All Accounts ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('operators')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                roleFilter === 'operators'
                  ? (theme === 'dark' ? 'bg-stone-800 text-white border border-white/10 shadow-sm' : 'bg-white text-slate-900 shadow-xs border-slate-300 border')
                  : (theme === 'dark' ? 'text-stone-400 hover:text-stone-200' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              Register & POS Staff ({users.filter(u => u.role !== 'rider').length})
            </button>
            <button
              onClick={() => setRoleFilter('riders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                roleFilter === 'riders'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                  : (theme === 'dark' ? 'text-stone-400 hover:text-stone-200' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery Fleet / Riders ({users.filter(u => u.role === 'rider').length})</span>
            </button>
          </div>

          <div className={`text-xs flex items-center gap-2 ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span>Active Terminal / Fleet Sessions</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs border-collapse ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>
            <thead>
              <tr className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                theme === 'dark' ? 'border-white/10 text-stone-400 bg-[#090a0f]' : 'border-slate-200 text-slate-500 bg-slate-50/80'
              }`}>
                <th className="py-2.5 px-3">Staff Member</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3">Fleet Performance / Outlet</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-sans ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
              {filteredUsers.map((u) => {
                const isActive = u.active !== false;
                const isCurrent = u.id === currentUser.id;
                const isRider = u.role === 'rider';
                const riderStats = isRider ? getRiderStats(u.name) : null;

                return (
                  <tr
                    key={u.id}
                    className={`transition ${
                      !isActive 
                        ? (theme === 'dark' ? 'opacity-55 bg-white/40 dark:bg-stone-950/40' : 'opacity-65 bg-slate-50') 
                        : (theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50')
                    }`}
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
                              : u.role === 'server'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isRider ? <Truck className="w-4 h-4 text-cyan-400" /> : u.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className={`font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                            {u.name}
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold">
                                You
                              </span>
                            )}
                            {isRider && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                theme === 'dark' ? 'bg-cyan-950 text-cyan-400 border-cyan-800/50' : 'bg-cyan-50 text-cyan-600 border-cyan-200'
                              }`}>
                                Fleet (No Login)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-stone-500 flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                            <span>Joined {u.createdAt || '2025-01-01'}</span>
                            {u.phone && (
                              <>
                                <span className="text-stone-700">•</span>
                                <span className="text-slate-500 dark:text-stone-400 font-mono flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-500 dark:text-stone-400" />
                                  <span>{u.phone}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className={`py-3 px-3 font-mono font-medium ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>@{u.username}</td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase font-mono border ${
                          u.role === 'owner'
                            ? (theme === 'dark' ? 'bg-amber-950/60 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200')
                            : u.role === 'manager'
                            ? (theme === 'dark' ? 'bg-purple-950/60 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-200')
                            : u.role === 'rider'
                            ? (theme === 'dark' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border-cyan-200')
                            : u.role === 'server'
                            ? (theme === 'dark' ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200')
                            : (theme === 'dark' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200')
                        }`}
                      >
                        {u.role === 'rider' ? 'RIDER / FLEET' : u.role}
                      </span>
                    </td>

                    {/* Outlet & Rider Stats */}
                    <td className="py-3 px-3">
                      {isRider && riderStats ? (
                        <div className="space-y-1">
                          <div className={`font-medium text-[11px] ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>{u.outlet || 'Main Branch'}</div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className={`border px-1.5 py-0.5 rounded font-mono ${
                              theme === 'dark' ? 'bg-stone-950/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-stone-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
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
                        <span className={`font-medium ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>{u.outlet || 'Main Branch'}</span>
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
                            : (theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-400 dark:text-stone-500 border-slate-300 dark:border-stone-700 hover:bg-stone-700' : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200 hover:text-slate-600')
                        }`}
                        title="Click to toggle terminal access immediately"
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400 dark:text-stone-500" /> Revoked
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className={`px-2 py-1 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border rounded-lg ${
                            theme === 'dark' 
                              ? 'bg-slate-50 dark:bg-stone-800/80 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white border-slate-300 dark:border-white/10' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-950 border-slate-200'
                          }`}
                          title="Edit Staff Information"
                        >
                          <Pencil className="w-3 h-3 text-indigo-400" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenPinReset(u)}
                          className={`px-2 py-1 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border rounded-lg ${
                            theme === 'dark' 
                              ? 'bg-slate-50 dark:bg-stone-800/80 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white border-slate-300 dark:border-white/10' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-950 border-slate-200'
                          }`}
                          title="Change User Password"
                        >
                          <KeyRound className="w-3 h-3 text-amber-400" />
                          Password
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={
                            deletingUserId === u.id ||
                            isCurrent ||
                            (u.role === 'owner' && users.filter((x) => x.role === 'owner').length <= 1)
                          }
                          className={`p-1.5 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border rounded-lg ${
                            theme === 'dark' 
                              ? 'text-slate-500 dark:text-stone-400 hover:text-red-400 bg-slate-50 dark:bg-stone-800/80 hover:bg-red-950/40 border-slate-200 dark:border-white/5' 
                              : 'text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 border-slate-200'
                          }`}
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
      <div className={`rounded-2xl p-5 border transition-colors space-y-3 ${
        theme === 'dark' 
          ? 'bg-[#0f1117] border-white/10 shadow-lg' 
          : 'bg-white border-slate-200/80 shadow-sm'
      }`}>
        <div className={`pb-3.5 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h4 className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Role Privilege Matrix & POS Guardrails
            </h4>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
              Enforced backend & workstation route permission limits by role tier
            </p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono ${
            theme === 'dark' ? 'bg-[#090a0f] border-white/10 text-stone-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            PIN-Gated Operations Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs border-collapse ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>
            <thead>
              <tr className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                theme === 'dark' ? 'border-white/10 text-stone-400 bg-[#090a0f]' : 'border-slate-200 text-slate-500 bg-slate-50/80'
              }`}>
                <th className="py-2.5 px-3">System Operation / Action</th>
                <th className="py-2.5 px-3 text-center">Cashier</th>
                <th className="py-2.5 px-3 text-center">Manager</th>
                <th className="py-2.5 px-3 text-center">Owner</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-sans ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
              {permissionMatrix.map((row, i) => (
                <tr key={i} className={`transition ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                  <td className={`py-2.5 px-3 font-medium ${theme === 'dark' ? 'text-stone-200' : 'text-slate-700'}`}>{row.permission}</td>
                  <td className="py-2.5 px-3 text-center">
                    {row.cashier ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                        <X className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.manager ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                        <X className="w-3.5 h-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.owner ? (
                      <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5" /> Full Access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 ${
            theme === 'dark' ? 'bg-[#12141c] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`p-4.5 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-white/10 bg-[#0c0d12]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Provision New Staff Account</h4>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'dark' ? 'text-stone-400 hover:text-white hover:bg-stone-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Email Address (Login Username) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. employee@whitescastle.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +92 300 1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>PIN / Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="1234"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-mono tracking-widest text-center focus:outline-none focus:border-emerald-500 transition border ${
                      theme === 'dark'
                        ? 'bg-[#08090d] border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                      theme === 'dark'
                        ? 'bg-[#08090d] border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="cashier" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Cashier (POS Operator)</option>
                    <option value="manager" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Manager (Shift Supervisor)</option>
                    <option value="server" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Server / Waiter (Dine-In)</option>
                    <option value="rider" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Rider (Delivery Fleet)</option>
                    {currentUser.role === 'owner' && <option value="owner" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Owner (Full Administrator)</option>}
                  </select>
                </div>
              </div>

              {formData.role === 'rider' && (
                <div className={`p-3 border rounded-xl text-xs flex items-start gap-2.5 ${
                  theme === 'dark' ? 'bg-cyan-950/40 border-cyan-800/40 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-800'
                }`}>
                  <Truck className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Delivery Fleet Account:</span> Riders are recorded for order assignment, tracking, and fleet analytics. They do not log in to the POS cashier terminal, but appear in all driver assignment dropdowns with live order counts.
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Assigned Outlet</label>
                <select
                  value={formData.outlet}
                  onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Main Branch" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Main Branch</option>
                  {outlets.map(o => (
                    <option key={o} value={o} className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer border active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-stone-800/80 hover:bg-stone-700 text-stone-300 border-white/10'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-95 border border-emerald-500/30"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isPinModalOpen && targetUserForPin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 ${
            theme === 'dark' ? 'bg-[#12141c] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`p-4.5 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-white/10 bg-[#0c0d12]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Change User Password</h4>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'dark' ? 'text-stone-400 hover:text-white hover:bg-stone-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPin} className="p-5 space-y-4">
              <div className={`text-xs ${theme === 'dark' ? 'text-stone-300' : 'text-slate-600'}`}>
                Set a new password for <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{targetUserForPin.name}</span> ({targetUserForPin.role.toUpperCase()}). Password can contain letters, numbers, or special characters.
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>New Password</label>
                <input
                  type="text"
                  required
                  placeholder="Enter new password (e.g. Pass#123)"
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-amber-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  autoFocus
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer border active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-stone-800/80 hover:bg-stone-700 text-stone-300 border-white/10'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-95 border border-amber-500/30"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Info Modal */}
      {isEditUserOpen && targetUserForEdit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 ${
            theme === 'dark' ? 'bg-[#12141c] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`p-4.5 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-white/10 bg-[#0c0d12]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Pencil className="w-4 h-4" />
                </div>
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Edit Staff Account Info</h4>
              </div>
              <button
                onClick={() => {
                  setIsEditUserOpen(false);
                  setTargetUserForEdit(null);
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'dark' ? 'text-stone-400 hover:text-white hover:bg-stone-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +92 300 1234567"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>Assigned Role *</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition border ${
                    theme === 'dark'
                      ? 'bg-[#08090d] border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="cashier" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Cashier (POS Operator)</option>
                  <option value="manager" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Manager (Shift Supervisor)</option>
                  <option value="server" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Server / Waiter (Dine-In)</option>
                  <option value="rider" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Rider (Delivery Fleet)</option>
                  {currentUser.role === 'owner' && <option value="owner" className={theme === 'dark' ? 'bg-[#08090d] text-white' : 'bg-white text-slate-900'}>Owner (Full Administrator)</option>}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-stone-300' : 'text-slate-700'}`}>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  Capability Restrictions
                </label>
                <p className={`text-[10px] mb-2 leading-relaxed ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>
                  Toggle checkboxes to <span className="text-rose-500 font-bold">Restrict / Block</span> this staff member's access to specific views, dashboards, or system modules.
                </p>
                <div className={`border rounded-xl p-3 max-h-40 overflow-y-auto space-y-2.5 scrollbar-thin ${
                  theme === 'dark' ? 'bg-[#08090d] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  {AVAILABLE_CAPABILITIES.map((cap) => {
                    const isChecked = editFormData.restrictions.includes(cap.id);
                    return (
                      <label key={cap.id} className="flex items-start gap-2.5 cursor-pointer text-xs group select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData({
                                ...editFormData,
                                restrictions: [...editFormData.restrictions, cap.id],
                              });
                            } else {
                              setEditFormData({
                                ...editFormData,
                                restrictions: editFormData.restrictions.filter((r) => r !== cap.id),
                              });
                            }
                          }}
                          className="mt-0.5 rounded border-slate-300 text-rose-500 focus:ring-rose-500/30 w-3.5 h-3.5 accent-rose-500"
                        />
                        <div>
                          <div className={`font-semibold text-[11px] ${
                            isChecked 
                              ? 'text-rose-500 font-bold' 
                              : (theme === 'dark' ? 'text-stone-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900')
                          }`}>
                            {cap.label}
                          </div>
                          <div className={`text-[9.5px] leading-snug ${theme === 'dark' ? 'text-stone-500' : 'text-slate-400'}`}>
                            {cap.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditUserOpen(false);
                    setTargetUserForEdit(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer border active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-stone-800/80 hover:bg-stone-700 text-stone-300 border-white/10'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-95 border border-emerald-500/30 flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
