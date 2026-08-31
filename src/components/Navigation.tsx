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
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';

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
  const { theme, toggleTheme, currentUser, currentShift, orders } = useRestaurant();
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
    { id: 'orders', label: 'Orders & Refunds', icon: Receipt },
    { id: 'menu', label: 'Menu & Stock', icon: UtensilsCrossed },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'shift', label: 'Shift & Float', icon: Calculator },
    { id: 'staff', label: 'Staff & Security', icon: UserCheck, requiredRole: ['owner', 'manager'] },
  ];

  return (
    <header className="bg-stone-900/95 backdrop-blur border-b border-stone-800 text-stone-100 px-4 py-2 flex items-center justify-between gap-4 sticky top-0 z-40 select-none shadow-md">
      {/* Brand & Outlet */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00897b] to-emerald-700 flex items-center justify-center text-white font-black text-xl shadow-inner">
          🍔
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Whites Castle
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO POS
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-stone-400 font-mono">
            {currentUser.outlet || 'Main Branch'} • Terminal 01
          </p>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-stone-950/70 p-1 rounded-xl border border-stone-800">
        {navItems.map((item) => {
          if (item.requiredRole && !item.requiredRole.includes(currentUser.role)) {
            return null;
          }
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative cursor-pointer ${
                isActive
                  ? 'bg-[#00897b] text-white shadow-md'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 text-[10px] font-black rounded-full animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Shift, Clock, User & Theme */}
      <div className="flex items-center gap-3 font-mono text-xs">
        {/* Live Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-950/60 border border-stone-800 text-stone-300">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>{time}</span>
        </div>

        {/* Shift Badge */}
        <div
          className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
            currentShift?.status === 'open'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/50 border-amber-500/30 text-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${currentShift?.status === 'open' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="font-semibold">{currentShift?.status === 'open' ? 'Shift Open' : 'Shift Closed'}</span>
        </div>

        {/* User Switcher Pill */}
        <button
          onClick={onOpenUserSwitch}
          className="flex items-center gap-2 px-3 py-1 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 text-stone-200 transition cursor-pointer shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-[#00897b]/30 border border-[#00897b]/50 flex items-center justify-center text-xs font-bold text-emerald-300">
            {currentUser.name[0]}
          </div>
          <div className="text-left font-sans">
            <p className="text-xs font-bold leading-tight">{currentUser.name.split(' ')[0]}</p>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold font-mono">
              {currentUser.role}
            </p>
          </div>
          <ShieldCheck className="w-3.5 h-3.5 text-stone-400 ml-1" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-stone-800/60 hover:bg-stone-700/80 border border-stone-700 text-stone-300 transition cursor-pointer"
          title="Toggle Light/Dark Display"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
