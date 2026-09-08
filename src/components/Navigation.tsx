import React, { useState, useEffect } from 'react';
import {
  Store,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Users,
  UserCheck,
  Calculator,
  Moon,
  Sun,
  ShieldCheck,
  Clock,
  Sparkles,
  Truck,
  Search,
  LogOut,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { MasterPOSLogo } from './common/MasterPOSLogo';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenUserSwitch: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenUserSwitch,
}) => {
  const { theme, toggleTheme, currentUser, currentShift, orders, isRestricted, logoutUser, showToast } = useRestaurant();
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pendingKitchenCount = orders.filter(
    (o) => o.status === 'pending' || o.status === 'in_kitchen'
  ).length;

  const activeDeliveriesCount = orders.filter(
    (o) => o.status === 'dispatched' || o.status === 'in_kitchen'
  ).length;

  const navItems = [
    { id: 'delivery', label: 'Delivery Monitoring', icon: Truck, badge: activeDeliveriesCount > 0 ? activeDeliveriesCount : undefined },
    { id: 'pos', label: 'POS Terminal', icon: Store },
    { id: 'kitchen', label: 'Kitchen & Dispatch', icon: ChefHat, badge: pendingKitchenCount > 0 ? pendingKitchenCount : undefined },
    { id: 'all-orders', label: 'All Orders Search', icon: Search },
    { id: 'orders', label: 'Orders & Refunds', icon: Receipt },
    { id: 'menu', label: 'Menu & Stock', icon: UtensilsCrossed },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'shift', label: 'Shift & Float', icon: Calculator },
    { id: 'staff', label: 'Staff & Security', icon: UserCheck, requiredRole: ['owner', 'manager'] },
  ];

  return (
    <header className="bg-white dark:bg-stone-900/95 backdrop-blur border-b border-slate-200 dark:border-stone-800 text-slate-900 dark:text-stone-100 px-3 sm:px-4 py-2 flex items-center justify-between gap-2.5 sm:gap-3.5 sticky top-0 z-40 select-none shadow-md min-h-[52px] h-[52px] sm:h-[56px]">
      {/* Brand & Outlet */}
      <div className="flex items-center gap-2.5 shrink-0 max-w-[140px] sm:max-w-[190px] md:max-w-[220px] lg:max-w-none select-none">
        <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-[#1c1e28] via-[#12131b] to-[#0a0b10] flex items-center justify-center shadow-lg shadow-black/40 border border-emerald-500/30 shrink-0">
          <div className="absolute inset-0 rounded-xl bg-radial from-emerald-500/25 to-transparent opacity-60" />
          <div className="absolute top-0 inset-x-1 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
          <MasterPOSLogo className="w-5 h-5 text-emerald-400 relative z-10" size={22} useColor={true} accent="emerald" />
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <h1 className="font-extrabold text-xs sm:text-base tracking-tight text-white flex items-center gap-1.5 truncate">
              <span>MASTER <span className="text-emerald-400">POS</span></span>
              <span className="hidden sm:inline text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                PRO
              </span>
            </h1>
          </div>
          <p className="text-[10px] sm:text-[10.5px] text-slate-400 font-mono leading-tight mt-0.5 truncate hidden sm:block">
            {currentUser.outlet || 'Main Branch'} • Terminal 01
          </p>
        </div>
      </div>

      {/* Center Navigation Tabs with Horizontal Scroll & Flex-Safe Boundary */}
      <div className="flex-1 min-w-0 flex items-center justify-start md:justify-center overflow-hidden relative">
        <nav className="flex items-center gap-1 bg-stone-950/70 p-1 rounded-xl border border-slate-200 dark:border-stone-800 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x min-w-0 max-w-full">
          {navItems.map((item) => {
            if (item.requiredRole && !item.requiredRole.includes(currentUser.role)) {
              return null;
            }
            if (isRestricted(item.id)) {
              return null;
            }
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 sm:gap-2 h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all relative cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-[#00897b] text-white shadow-md'
                    : 'text-slate-700 dark:text-stone-300 hover:text-white hover:bg-slate-100 dark:hover:bg-stone-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-stone-950 text-[10px] font-black rounded-full animate-pulse leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: Shift, User & Theme with Zero Clipping Protection */}
      <div className="flex items-center gap-2 sm:gap-2.5 font-mono text-xs shrink-0 select-none ml-auto">
        {/* Live Clock (shown on larger screens) */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 dark:bg-stone-950/60 border border-slate-200 dark:border-stone-800 text-slate-700 dark:text-stone-300 shrink-0 h-8">
          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{time}</span>
        </div>

        {/* Shift Badge */}
        <div
          className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 shrink-0 h-8 ${
            currentShift?.status === 'open'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/50 border-amber-500/30 text-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${currentShift?.status === 'open' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="font-semibold text-[11px] sm:text-xs">{currentShift?.status === 'open' ? 'Open' : 'Closed'}</span>
        </div>

        {/* Sign Out Pill */}
        <button
          onClick={() => {
            logoutUser();
            showToast(`✓ Signed out of account (${currentUser.name})`);
          }}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-50 dark:bg-stone-800/90 hover:bg-red-950/60 border border-slate-300 dark:border-stone-700 hover:border-red-500/40 text-stone-200 hover:text-red-300 transition cursor-pointer shadow-sm shrink-0 h-8"
          title={`Sign Out (${currentUser.name})`}
        >
          <div className="w-5 h-5 rounded-md bg-[#00897b]/30 border border-[#00897b]/50 flex items-center justify-center text-[10px] sm:text-xs font-bold text-emerald-300 shrink-0">
            {currentUser.name[0]}
          </div>
          <div className="text-left font-sans">
            <p className="text-xs font-bold leading-tight max-w-[55px] sm:max-w-[80px] md:max-w-[100px] truncate">{currentUser.name.split(' ')[0]}</p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-stone-400 uppercase tracking-wider font-semibold font-mono hidden sm:block">
              {currentUser.role}
            </p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-red-400 ml-0.5 shrink-0 hidden sm:block" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-stone-800/60 hover:bg-stone-700/80 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 transition cursor-pointer shrink-0 flex items-center justify-center active:scale-90"
          title="Toggle Light/Dark Display"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
