import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Settings,
  Store,
  DollarSign,
  Truck,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRestaurant } from '../../context/RestaurantContext';
import { AdminSalesOverview } from './AdminSalesOverview';
import { AdminMenuManager } from './AdminMenuManager';
import { AdminStaffManager } from './AdminStaffManager';
import { AdminReportsAnalytics } from './AdminReportsAnalytics';
import { AdminSystemSettings } from './AdminSystemSettings';
import { AdminRidersFleet } from './AdminRidersFleet';
import { MasterPOSLogo } from '../common/MasterPOSLogo';

type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS' | 'SETTINGS' | 'RIDERS';

export const AdminDashboard: React.FC = () => {
  const { currentUser, users, setCurrentUser, showToast, currentShift, orders, theme, isRestricted } = useRestaurant();
  const tabs: { id: AdminTab; label: string; icon: React.FC<{ className?: string }>; restrictedToOwner?: boolean }[] = [
    { id: 'SALES', label: 'Sales & Revenue', icon: TrendingUp },
    { id: 'MENU', label: 'Menu Catalog', icon: UtensilsCrossed },
    { id: 'STAFF', label: 'Staff & Roles (RBAC)', icon: Users },
    { id: 'REPORTS', label: 'Shift Audits & Reports', icon: FileSpreadsheet },
    { id: 'RIDERS', label: 'Fleet & Riders', icon: Truck, restrictedToOwner: true },
    { id: 'SETTINGS', label: 'System Settings', icon: Settings, restrictedToOwner: true },
  ];

  const allowedTabs = tabs.filter((tab) => {
    if (tab.restrictedToOwner && currentUser.role !== 'owner') return false;
    const restrictionKey = `admin_${tab.id.toLowerCase()}`;
    return !isRestricted(restrictionKey);
  });

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    return allowedTabs[0]?.id || 'SALES';
  });
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className={`flex-1 min-h-[85vh] flex items-center justify-center p-6 ${
        theme === 'dark' ? 'bg-[#08090d]' : 'bg-slate-100'
      }`}>
        <div className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 ${
          theme === 'dark' ? 'bg-[#12141c] border-white/10 shadow-black/80' : 'bg-white border-slate-200 shadow-xl'
        }`}>
          {/* Brand Crest */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1e2230] to-[#0d0f18] border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <MasterPOSLogo className="w-8 h-8 text-blue-400" size={32} useColor={true} accent="cyan" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400 font-bold">
              Master POS • Security Guard
            </span>
          </div>

          <div className="space-y-2">
            <h2 className={`text-xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Administrative Console Locked
            </h2>
            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-stone-400' : 'text-slate-600'}`}>
              This terminal controls executive sales analytics, catalog prices, and staff permissions. Enter an authorized <span className="text-amber-400 font-semibold">Manager</span> or <span className="text-amber-400 font-semibold">Owner PIN</span> to unlock.
            </p>
          </div>

          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div>
              <input
                type="password"
                autoFocus
                placeholder="Enter Password / PIN"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError('');
                }}
                className={`w-full max-w-xs mx-auto px-4 py-3 border rounded-2xl text-base text-center tracking-widest font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition shadow-inner ${
                  theme === 'dark' ? 'bg-[#08090d] border-white/10 text-white placeholder-stone-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              {pinError && (
                <div className="text-xs text-rose-500 mt-2 font-medium flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {pinError}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!enteredPin.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-blue-600/30 border border-blue-400/30"
            >
              Verify Credentials &amp; Unlock Console
            </button>
          </form>



          <div className={`pt-4 border-t text-[11px] ${theme === 'dark' ? 'border-white/5 text-stone-400' : 'border-slate-200 text-slate-500'}`}>
            Current Session: <span className={`font-medium ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>{currentUser.name}</span> ({currentUser.role.toUpperCase()})
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col h-full overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 antialiased transition-colors duration-200 mobile-admin-viewport ${
      theme === 'dark' ? 'bg-[#0b0c10] text-stone-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Administrative Bar */}
      <header className={`border rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-all shrink-0 mobile-admin-header ${
        theme === 'dark' ? 'bg-gradient-to-b from-[#141622] to-[#0d0e15] border-white/10 shadow-black/60' : 'bg-white border-slate-200/90 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white border border-blue-400/30 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
            <MasterPOSLogo className="w-5 h-5 sm:w-6 sm:h-6 text-white" size={24} useColor={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-base sm:text-lg md:text-xl font-black tracking-tight ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Executive Admin Console
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold font-mono uppercase tracking-wider">
                {currentUser.role} Access
              </span>
              <span className="inline-flex sm:hidden items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9.5px] font-bold uppercase tracking-wider font-mono">
                Mobile Admin
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Shift #{currentShift?.shiftNumber || '101'}
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs mt-0.5 flex items-center gap-1.5 sm:gap-2 font-medium truncate ${
              theme === 'dark' ? 'text-stone-400' : 'text-slate-500'
            }`}>
              <Store className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{currentUser.outlet || 'Master POS Main Branch'}</span>
              <span className={theme === 'dark' ? 'text-stone-600' : 'text-slate-300'}>•</span>
              <span className="font-mono text-[10.5px]">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls: Lock Console & Active User */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
          <div className="text-left sm:text-right">
            <div className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</div>
            <div className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-stone-400' : 'text-slate-500'}`}>{currentUser.role.toUpperCase()} • {currentUser.outlet || 'Main Branch'}</div>
          </div>

          <button
            onClick={() => {
              setIsLockedByPIN(true);
              showToast('🔒 Admin console locked with PIN security');
            }}
            className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border active:scale-95 shadow-sm shrink-0 min-h-[38px] ${
              theme === 'dark' 
                ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border-white/10' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-300'
            }`}
            title="Lock terminal screen when stepping away"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Lock</span>
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs Bar with Mobile Touch Scroll */}
      <nav className={`sticky top-0 z-20 p-1.5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar rounded-2xl border backdrop-blur-md transition-all shrink-0 touch-pan-x overscroll-x-contain mobile-admin-nav-scroll ${
        theme === 'dark' ? 'bg-[#0c0d12]/95 border-white/10 shadow-lg' : 'bg-slate-100/95 border-slate-200 shadow-sm'
      }`}>
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer border active:scale-95 shrink-0 mobile-admin-nav-button ${
                isSelected
                  ? theme === 'dark' 
                    ? 'bg-white text-stone-950 border-white shadow-lg font-black'
                    : 'bg-blue-600 text-white border-blue-600 shadow-md font-black'
                  : theme === 'dark'
                  ? 'bg-[#141620] text-stone-400 hover:text-white hover:bg-[#1c1e2d] border-white/5 hover:border-white/15'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 shadow-xs'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="shrink-0">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Tab View Rendering with Fluid Animations */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {activeTab === 'SALES' && <AdminSalesOverview />}
            {activeTab === 'MENU' && <AdminMenuManager />}
            {activeTab === 'STAFF' && <AdminStaffManager />}
            {activeTab === 'REPORTS' && <AdminReportsAnalytics />}
            {activeTab === 'RIDERS' && <AdminRidersFleet />}
            {activeTab === 'SETTINGS' && <AdminSystemSettings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
