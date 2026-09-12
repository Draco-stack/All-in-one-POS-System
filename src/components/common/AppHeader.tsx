import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Truck,
  ChefHat,
  LayoutGrid,
  Calculator,
  ShieldCheck,
  Layers,
  Clock,
  Maximize2,
  Minimize2,
  UserCheck,
  ChevronDown,
  Sparkles,
  Zap,
  LogOut,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Logo } from './Logo';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export interface AppHeaderProps {
  activeView: 'delivery' | 'pos' | 'orders' | 'all-orders' | 'shifts' | 'admin';
  setActiveView: (view: 'delivery' | 'pos' | 'orders' | 'all-orders' | 'shifts' | 'admin') => void;
  orderSubTab?: 'search' | 'kitchen';
  setOrderSubTab?: (tab: 'search' | 'kitchen') => void;
  onOpenUserSwitch?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeView,
  setActiveView,
  orderSubTab,
  setOrderSubTab,
  onOpenUserSwitch,
}) => {
  const {
    theme,
    toggleTheme,
    currentUser,
    logoutUser,
    showToast,
    isRestricted,
    hasPermission,
    orders,
    currentShift,
  } = useRestaurant();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Live Clock Interval
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      showToast('Entered Fullscreen Mode');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        showToast('Exited Fullscreen Mode');
      }
    }
  };

  // Operational Counts
  const activeKitchenCount = (orders || []).filter((o) =>
    ['pending', 'PUNCHED', 'MODIFIED', 'punched', 'modified', 'in_kitchen', 'open'].includes(o.status)
  ).length;

  const activeDeliveryCount = (orders || []).filter(
    (o) =>
      o.type === 'delivery' &&
      ['pending', 'PUNCHED', 'MODIFIED', 'in_kitchen', 'ready', 'dispatched'].includes(o.status)
  ).length;

  // Header Title Config mapping
  const viewTitles: Record<string, { title: string; subtitle: string; iconBg: string }> = {
    pos: {
      title: 'Floor POS Workstation',
      subtitle: 'Fast Counter Billing & Table Management',
      iconBg: 'from-emerald-500 to-teal-700',
    },
    delivery: {
      title: 'Delivery Command Hub',
      subtitle: 'Rider Dispatch & Route Optimization',
      iconBg: 'from-blue-500 to-indigo-700',
    },
    orders: {
      title: orderSubTab === 'kitchen' ? 'Kitchen Display System (KDS)' : 'Orders Search & Audit',
      subtitle:
        orderSubTab === 'kitchen'
          ? 'Live Prep Tickets & Station Workflow'
          : 'Search & Audit Past Transactions',
      iconBg: 'from-amber-500 to-orange-700',
    },
    'all-orders': {
      title: 'All Orders Ledger',
      subtitle: 'Complete Sales & Dispatch History',
      iconBg: 'from-stone-600 to-stone-800',
    },
    shifts: {
      title: 'Shift & Cash Drawer',
      subtitle: 'Register Reconciliation & Till Management',
      iconBg: 'from-purple-500 to-violet-700',
    },
    admin: {
      title: 'Admin & Staff Portal',
      subtitle: 'System Configuration, Users & Permissions',
      iconBg: 'from-rose-500 to-pink-700',
    },
  };

  const currentViewInfo = viewTitles[activeView] || {
    title: 'Tillora',
    subtitle: 'Commercial Restaurant Operating System',
    iconBg: 'from-emerald-500 to-teal-700',
  };

  const isDark = theme === 'dark';

  return (
    <header
      className={`px-2 sm:px-4 py-1.5 sm:py-2 border-b flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 sticky top-0 z-40 min-h-[50px] sm:min-h-[58px] max-w-full overflow-hidden select-none transition-colors duration-200 ${
        isDark
          ? 'bg-[#0f1118]/95 backdrop-blur-xl border-white/10 text-stone-100 shadow-md'
          : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-800 shadow-xs'
      }`}
    >
      {/* 1. BRAND EMBLEM & DYNAMIC VIEW TITLE */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
        <div
          onClick={() => setActiveView('pos')}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group select-none min-w-0"
          title="Tillora Operating System - Floor Terminal"
        >
          {/* Executive Brand Emblem */}
          <Logo className="scale-75 origin-left" iconOnly={true} />

          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1 leading-tight">
              <span className={`font-black text-[11px] sm:text-xs md:text-sm tracking-tight font-sans truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                TILL<span className="text-amber-500 font-extrabold italic">ORA</span>
              </span>
              <span className="hidden md:inline-block px-1 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400 leading-none">
                OS
              </span>
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <p className={`text-[9.5px] sm:text-[10px] font-medium truncate max-w-[100px] sm:max-w-[140px] md:max-w-[200px] ${isDark ? 'text-stone-400' : 'text-slate-500'}`}>
                {currentViewInfo.title}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* VERTICAL DIVIDER */}
      <div
        className={`hidden xl:block h-5 w-px shrink-0 ${
          isDark ? 'bg-white/10' : 'bg-slate-200'
        }`}
      />

      {/* 2. UNIVERSAL NAVIGATION PILL BAR WITH TOUCH-PAN HORIZONTAL SCROLL SAFEGUARD */}
      <div className="flex-1 min-w-0 relative flex items-center justify-start md:justify-center overflow-hidden px-1">
        <nav
          className={`flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x min-w-0 max-w-full ${
            isDark
              ? 'bg-[#090a0f]/80 border-white/10 shadow-inner'
              : 'bg-slate-100/90 border-slate-200/90 shadow-2xs'
          }`}
        >
          {/* FLOOR POS */}
          {!isRestricted('pos') && (
            <button
              onClick={() => setActiveView('pos')}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'pos'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400/30'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <LayoutGrid className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">Floor POS</span>
            </button>
          )}

          {/* DELIVERY HUB */}
          {!isRestricted('delivery') && (
            <button
              onClick={() => setActiveView('delivery')}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'delivery'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-blue-400/30'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Truck className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">Delivery</span>
              {activeDeliveryCount > 0 && (
                <span className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full bg-blue-500 text-white text-[8.5px] sm:text-[9.5px] font-mono font-black leading-none badge-pulse shadow-xs">
                  {activeDeliveryCount}
                </span>
              )}
            </button>
          )}

          {/* KITCHEN QUEUE KDS */}
          {!isRestricted('kitchen') && (
            <button
              onClick={() => {
                setActiveView('orders');
                if (setOrderSubTab) setOrderSubTab('kitchen');
              }}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'orders' && orderSubTab === 'kitchen'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black shadow-md border border-amber-300/40'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <ChefHat className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">Kitchen Queue</span>
              {activeKitchenCount > 0 && (
                <span className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full bg-amber-500 text-stone-950 text-[8.5px] sm:text-[9.5px] font-mono font-black leading-none badge-pulse shadow-xs">
                  {activeKitchenCount}
                </span>
              )}
            </button>
          )}

          {/* ALL ORDERS LEDGER */}
          {!isRestricted('all-orders') && (
            <button
              onClick={() => setActiveView('all-orders')}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'all-orders'
                  ? isDark
                    ? 'bg-stone-700 text-white shadow-md border border-stone-500/30'
                    : 'bg-slate-700 text-white shadow-md'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Layers className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">All Orders</span>
              {orders.length > 0 && (
                <span className={`px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-mono font-bold leading-none border ${
                  isDark ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}>
                  {orders.length}
                </span>
              )}
            </button>
          )}

          {/* SHIFTS & CASH DRAWER */}
          {!isRestricted('shift') && (
            <button
              onClick={() => setActiveView('shifts')}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'shifts'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/30'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Calculator className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">Shifts</span>
            </button>
          )}

          {/* ADMIN & STAFF (Restricted to Authorized Staff: Owner, Admin & Manager users) */}
          {!isRestricted('staff') && (hasPermission('staff.view') || hasPermission('organization.view') || currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <button
              onClick={() => setActiveView('admin')}
              className={`h-7 sm:h-8 px-1.5 sm:px-2.5 lg:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                activeView === 'admin'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md border border-rose-400/30'
                  : isDark
                  ? 'text-stone-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
              title="Admin & Staff Management Console (Admin & Manager Access Only)"
            >
              <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0 text-rose-400" />
              <span className="truncate">Admin</span>
            </button>
          )}
        </nav>
      </div>

      {/* 3. UNIVERSAL SYSTEM UTILITIES & USER PROFILE */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto select-none">
        {/* Real-time Clock Badge */}
        {currentTime && (
          <div
            className={`hidden xl:flex items-center gap-1 px-2 py-1 rounded-xl border font-mono text-[10.5px] font-bold ${
              isDark
                ? 'bg-[#090a0f] border-white/10 text-emerald-400'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Terminal Local Time"
          >
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>{currentTime}</span>
          </div>
        )}

        {/* Shift Status Indicator */}
        {(() => {
          const isShiftActive = Boolean(currentShift && currentShift.status === 'open');
          return (
            <button
              onClick={() => {
                if (!isRestricted('shift')) {
                  setActiveView('shifts');
                }
              }}
              className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-mono font-bold transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                isShiftActive
                  ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-800/60 text-amber-300'
              }`}
              title={
                isShiftActive
                  ? `${currentShift?.shiftNumber || 'Shift'} Active • Cashier: ${currentShift?.cashierName || currentUser.name} (Click to manage)`
                  : 'No active register shift (Click to open shift)'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isShiftActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="truncate max-w-[80px]">
                {isShiftActive
                  ? (currentShift?.shiftNumber || 'Shift Active')
                  : 'Shift Closed'}
              </span>
            </button>
          );
        })()}

        {/* In-App PWA Install Prompt */}
        <PWAInstallButton />

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className={`h-7 sm:h-8 w-7 sm:w-8 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 ${
            isFullscreen
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
              : isDark
              ? 'bg-stone-900 hover:bg-stone-800 text-stone-300 border-white/10'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <Maximize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`h-7 sm:h-8 w-7 sm:w-8 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 ${
            isDark
              ? 'bg-stone-900 hover:bg-stone-800 text-amber-400 border-white/10'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200'
          }`}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <Moon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
        </button>

        {/* Sign Out Button */}
        <button
          onClick={() => {
            logoutUser();
            showToast(`✓ Signed out of account (${currentUser?.name || 'Staff User'})`);
          }}
          className={`h-7 sm:h-8 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition cursor-pointer active:scale-95 shrink-0 ${
            isDark
              ? 'bg-stone-900/90 hover:bg-red-950/60 text-stone-200 hover:text-red-300 border-white/10 hover:border-red-500/40 shadow-sm'
              : 'bg-slate-100 hover:bg-red-50 text-slate-800 hover:text-red-600 border-slate-200 hover:border-red-300 shadow-xs'
          }`}
          title={`Sign Out (${currentUser?.name || 'Staff User'} - ${currentUser?.role?.toUpperCase() || ''})`}
        >
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-gradient-to-br from-emerald-500 to-teal-600 text-stone-950 font-black text-[9px] sm:text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <span className="font-bold max-w-[50px] sm:max-w-[75px] md:max-w-[95px] truncate">
            {currentUser?.name || 'Staff User'}
          </span>
          <LogOut className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-red-400 shrink-0" />
        </button>
      </div>
    </header>
  );
};
