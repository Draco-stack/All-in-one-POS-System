import React, { useState } from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Calendar,
  Building2,
  User,
  Layers,
  Truck,
  Store,
  DollarSign,
  ArrowUpDown,
  X,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface OrderFilterPanelProps {
  selectedOutlet: string;
  setSelectedOutlet: (val: string) => void;
  selectedSource: string;
  setSelectedSource: (val: string) => void;
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  selectedUser: string;
  setSelectedUser: (val: string) => void;
  selectedDate: string;
  setSelectedDate: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  orderTypeFilter: string;
  setOrderTypeFilter: (val: string) => void;
  minAmount: string;
  setMinAmount: (val: string) => void;
  maxAmount: string;
  setMaxAmount: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  availableOutlets: string[];
  availableSources: string[];
  availableUsers: string[];
  onResetFilters: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeFiltersCount: number;
  isOpen: boolean;
  onToggle: () => void;
  theme?: 'dark' | 'light';
  totalFiltered: number;
  totalAll: number;
}

export const OrderFilterPanel: React.FC<OrderFilterPanelProps> = ({
  selectedOutlet,
  setSelectedOutlet,
  selectedSource,
  setSelectedSource,
  selectedStatus,
  setSelectedStatus,
  selectedUser,
  setSelectedUser,
  selectedDate,
  setSelectedDate,
  searchQuery,
  setSearchQuery,
  orderTypeFilter,
  setOrderTypeFilter,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  sortBy,
  setSortBy,
  availableOutlets,
  availableSources,
  availableUsers,
  onResetFilters,
  onRefresh,
  isRefreshing,
  activeFiltersCount,
  isOpen,
  onToggle,
  theme = 'dark',
  totalFiltered,
  totalAll,
}) => {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState<boolean>(true);

  // Quick Preset Helper for Dates
  const setDatePreset = (preset: 'today' | 'yesterday' | 'all') => {
    const today = new Date();
    if (preset === 'all') {
      setSelectedDate('');
    } else if (preset === 'today') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    }
  };

  const isDark = theme === 'dark';

  return (
    <aside
      aria-label="Order Filter Console"
      className={`transition-all duration-300 ease-in-out shrink-0 border-r flex flex-col z-20 ${
        isOpen ? 'w-80 sm:w-88' : 'w-0 overflow-hidden border-none'
      } ${
        isDark
          ? 'bg-[#12141c] border-stone-800 text-stone-200'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      {/* PANEL HEADER */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-[#161924] border-stone-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Filter Console</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-stone-950 text-[10px] font-mono font-black">
                  {activeFiltersCount}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-stone-400 font-mono">
              {totalFiltered} of {totalAll} matches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg border transition cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'bg-stone-800/80 hover:bg-stone-700 text-stone-300 border-stone-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title="Refresh Order Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={onResetFilters}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isDark
                ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border-rose-800/40'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
            }`}
            title="Reset All Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg border transition cursor-pointer lg:hidden ${
              isDark
                ? 'bg-stone-800 hover:bg-stone-700 text-stone-400 border-stone-700'
                : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-300'
            }`}
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* FILTER SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs no-scrollbar">
        {/* 1. KEYWORD & CUSTOMER SEARCH BOX */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              Direct Search
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer lowercase"
              >
                clear
              </button>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search Name, Phone, #ID, Address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none transition border ${
                isDark
                  ? 'bg-[#090a0f] border-stone-800 text-stone-100 placeholder-stone-500 focus:border-emerald-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
              }`}
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-stone-500 pointer-events-none" />
          </div>
        </div>

        {/* 2. ORDER TYPE PILLS (Dine-In / Delivery / Takeaway) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Order Channel / Type
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'dine_in', label: 'Dine-In' },
              { id: 'delivery', label: 'Delivery' },
              { id: 'takeaway', label: 'Takeaway' },
            ].map((t) => {
              const isSelected = orderTypeFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setOrderTypeFilter(t.id)}
                  className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold transition text-center truncate cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark
                      ? 'bg-[#090a0f] text-stone-400 hover:text-stone-200 border border-stone-800'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. STATUS SELECTOR */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Order Lifecycle Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer border transition ${
              isDark
                ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="all">All Lifecycle Statuses</option>
            <option value="active">Active In-Progress Only</option>
            <option value="in_kitchen">In Kitchen / Preparing</option>
            <option value="ready">Ready for Dispatch</option>
            <option value="dispatched">Dispatched / On the Way</option>
            <option value="delivered">Delivered / Completed</option>
            <option value="cancelled_all">Cancelled & Refunded</option>
          </select>
        </div>

        {/* 4. DATE RANGE & PRESETS */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Timeline & Date
            </label>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer lowercase"
              >
                clear date
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 mb-1.5">
            <button
              onClick={() => setDatePreset('today')}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                selectedDate &&
                new Date(selectedDate).toDateString() === new Date().toDateString()
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isDark
                  ? 'bg-stone-900 text-stone-400 hover:text-white border-stone-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDatePreset('yesterday')}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                isDark
                  ? 'bg-stone-900 text-stone-400 hover:text-white border-stone-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDatePreset('all')}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                !selectedDate
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isDark
                  ? 'bg-stone-900 text-stone-400 hover:text-white border-stone-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              All Time
            </button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`w-full rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none cursor-pointer border transition ${
              isDark
                ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
          />
        </div>

        {/* 5. OUTLET / BRANCH SELECTOR */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            Branch / Outlet
          </label>
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer border transition ${
              isDark
                ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="all">All Outlets & Terminals</option>
            {availableOutlets.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* 6. ORDER SOURCE CHANNEL */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            Lead / Source Channel
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer border transition ${
              isDark
                ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="all">All Sources (Call, App, Branch, Web)</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* 7. CASHIER / STAFF USER */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-400" />
            Punched By / Staff
          </label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer border transition ${
              isDark
                ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="all">All Staff Members</option>
            {availableUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* ADVANCED FILTER SECTION: AMOUNT RANGE & SORTING */}
        <div className="pt-2 border-t border-stone-800">
          <button
            type="button"
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-stone-400 hover:text-stone-200 py-1 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Amount Range & Sorting
            </span>
            {isAdvancedExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isAdvancedExpanded && (
            <div className="space-y-3 pt-2">
              {/* Min - Max Amount */}
              <div className="space-y-1">
                <label className="text-[10px] text-stone-400 font-medium">Order Total Range (PKR):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className={`w-1/2 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none border ${
                      isDark
                        ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                  <span className="text-stone-500 text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className={`w-1/2 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none border ${
                      isDark
                        ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Sort By Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  Sort Sequence:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none cursor-pointer border ${
                    isDark
                      ? 'bg-[#090a0f] border-stone-800 text-stone-200 focus:border-emerald-500'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="time_desc">Time Created (Newest First)</option>
                  <option value="time_asc">Time Created (Oldest First)</option>
                  <option value="total_desc">Order Amount (Highest First)</option>
                  <option value="total_asc">Order Amount (Lowest First)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTION BUTTONS */}
      <div
        className={`p-3 border-t shrink-0 flex items-center gap-2 ${
          isDark ? 'bg-[#161924] border-stone-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          onClick={onResetFilters}
          className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-stone-700 active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All</span>
        </button>
        <button
          onClick={onRefresh}
          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Apply Filters</span>
        </button>
      </div>
    </aside>
  );
};
