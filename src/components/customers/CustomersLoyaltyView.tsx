import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Customer } from '../../types';
import { Users, Search, Phone, MapPin } from 'lucide-react';

export const CustomersLoyaltyView: React.FC = () => {
  const { customers } = useRestaurant();
  const [search, setSearch] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 bg-stone-900 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00897b]/10 border border-[#00897b]/30 flex items-center justify-center text-[#00897b]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Customer Profiles & Loyalty Rewards</h2>
            <p className="text-xs text-stone-400">
              Lookup regular guests, phone directory, delivery addresses, and loyalty point balances
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by phone, name, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500 w-64 font-medium"
          />
        </div>
      </div>

      {/* Customers List Grid */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer) => (
            <div
              key={customer.id}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3 shadow hover:border-teal-500/40 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{customer.name}</h4>
                  <p className="text-xs text-teal-400 flex items-center gap-1.5 mt-0.5 font-mono font-bold">
                    <Phone className="w-3 h-3" />
                    <span>{customer.phone}</span>
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    customer.vipTier === 'Gold'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : customer.vipTier === 'Silver'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {customer.vipTier} Member
                </span>
              </div>

              {customer.address && (
                <p className="text-xs text-stone-300 flex items-start gap-1.5 bg-stone-950 p-2 rounded-xl border border-stone-800">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-400" />
                  <span className="leading-snug">{customer.address}</span>
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-center font-mono">
                <div>
                  <span className="text-[9px] uppercase text-stone-500 block font-bold">Loyalty</span>
                  <span className="text-xs font-bold text-teal-400">{customer.loyaltyPoints} pts</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-stone-500 block font-bold">Visits</span>
                  <span className="text-xs font-bold text-white">{customer.totalOrdersCount}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-stone-500 block font-bold">Spend</span>
                  <span className="text-xs font-bold text-emerald-400">Rs. {customer.totalSpent.toFixed(0)}</span>
                </div>
              </div>

              {customer.favoriteItems && customer.favoriteItems.length > 0 && (
                <div className="text-[11px] text-stone-400">
                  <span className="text-stone-500 text-[10px] uppercase font-bold block">Favorite Dishes:</span>
                  <span className="text-stone-300">{customer.favoriteItems.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
