import React, { useState } from 'react';
import {
  TrendingUp,
  UtensilsCrossed,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  AlertTriangle,
  Building2,
  Clock,
  LogOut,
  Sparkles, Settings,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { AdminSalesOverview } from './AdminSalesOverview';
import { AdminMenuManager } from './AdminMenuManager';
import { AdminStaffManager } from './AdminStaffManager';
import { AdminReportsAnalytics } from './AdminReportsAnalytics';
import { AdminSystemSettings } from './AdminSystemSettings';
import { AdminRidersFleet } from './AdminRidersFleet';

type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS' | 'SETTINGS' | 'RIDERS';

export const AdminDashboard: React.FC = () => {
  const { currentUser, users, setCurrentUser, showToast } = useRestaurant();
  const [activeTab, setActiveTab] = useState<AdminTab>('SALES');

  // Security Lock / PIN Gate State
  const isPrivileged = currentUser.role === 'owner' || currentUser.role === 'manager';
  const [isLockedByPIN, setIsLockedByPIN] = useState<boolean>(!isPrivileged);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const handleUnlockWithPin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    // Check entered PIN against owners and managers
    const match = users.find(
      (u) => (u.role === 'owner' || u.role === 'manager') && u.pin === enteredPin && u.active !== false
    );

    if (match) {
      setCurrentUser(match);
      setIsLockedByPIN(false);
      setEnteredPin('');
      showToast(`Admin Console unlocked by ${match.name} (${match.role.toUpperCase()})`);
    } else {
      setPinError('Invalid Manager or Owner PIN. Access denied.');
      setEnteredPin('');
    }
  };

  // If user is not privileged or manually locked the screen
  if (!isPrivileged || isLockedByPIN) {
    return (
      <div className="flex-1 min-h-[85vh] flex items-center justify-center p-6 bg-gradient-to-b from-stone-950 via-stone-900 to-[#121212]">
        <div className="max-w-md w-full bg-gradient-to-b from-stone-900/95 to-[#141414]/95 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              Administrative Control Locked
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              This workstation contains restricted financial records, staff credentials, and catalog controls. Enter an authorized <span className="text-amber-400 font-semibold">Manager</span> or <span className="text-amber-400 font-semibold">Owner PIN</span> to unlock.
            </p>
          </div>

          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError('');
                }}
                className="w-48 mx-auto px-4 py-3 bg-stone-950/80 border border-white/10 rounded-2xl text-2xl text-center text-white tracking-widest font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
              />
              {pinError && (
                <div className="text-xs text-red-400 mt-2 font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {pinError}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={enteredPin.length !== 4}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 shadow-lg border border-emerald-500/30"
            >
              Verify PIN & Access Dashboard
            </button>
          </form>

          <div className="pt-4 border-t border-white/5 text-[11px] text-stone-500">
            Current Session: <span className="text-stone-300 font-medium">{currentUser.name}</span> ({currentUser.role.toUpperCase()})
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-[#121212] text-stone-100 p-4 md:p-6 space-y-6">
      {/* Top Administrative Bar */}
      <div className="bg-gradient-to-b from-stone-900/90 to-[#161616]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                Executive Admin Console
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono uppercase shadow-xs">
                {currentUser.role} Access
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Live Operations, Sales Reconciliation, Staff Governance & Catalog Control
            </p>
          </div>
        </div>

        {/* Action Controls: Lock Console & Active User */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-white">{currentUser.name}</div>
            <div className="text-[10px] text-stone-400 font-mono">{currentUser.outlet || 'Main Branch'}</div>
          </div>

          <button
            onClick={() => {
              setIsLockedByPIN(true);
              showToast('Admin console secured with PIN lock.');
            }}
            className="px-3.5 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/20 active:scale-95 shadow-sm"
            title="Lock screen when stepping away from counter"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Lock Console
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
            activeTab === 'SALES'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
              : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Sales & Revenue Tracking
        </button>

        <button
          onClick={() => setActiveTab('MENU')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
            activeTab === 'MENU'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
              : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          Menu & Category Catalog
        </button>

        <button
          onClick={() => setActiveTab('STAFF')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
            activeTab === 'STAFF'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
              : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          User & Staff Management (RBAC)
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
            activeTab === 'REPORTS'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
              : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Shift Audits & Reports
        </button>
        {currentUser.role === 'owner' && (
          <>
            <button
              onClick={() => setActiveTab('RIDERS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
                activeTab === 'RIDERS'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                  : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              Rider Fleet
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                  : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800/80 border border-white/5 hover:border-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </>
        )}
      </div>

      {/* Active Tab View Rendering */}
      <div className="flex-1">
        {activeTab === 'SALES' && <AdminSalesOverview />}
        {activeTab === 'MENU' && <AdminMenuManager />}
        {activeTab === 'STAFF' && <AdminStaffManager />}
        {activeTab === 'REPORTS' && <AdminReportsAnalytics />}
        {activeTab === 'RIDERS' && <AdminRidersFleet />}
        {activeTab === 'SETTINGS' && <AdminSystemSettings />}
      </div>
    </div>
  );
};
