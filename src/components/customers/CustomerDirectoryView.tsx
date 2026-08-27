import React, { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Award,
  ShoppingBag,
  TrendingUp,
  X,
  CheckCircle,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Customer } from '../../types';

export const CustomerDirectoryView: React.FC = () => {
  const { customers, upsertCustomer, showToast } = useRestaurant();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    deliveryNotes: '',
  });

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.vipTier && c.vipTier.toLowerCase().includes(q))
    );
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      showToast('Name and phone number are required.');
      return;
    }

    await upsertCustomer(newCust);
    setIsAddModalOpen(false);
    setNewCust({ name: '', phone: '', email: '', address: '', deliveryNotes: '' });
    showToast(`✓ Customer "${newCust.name}" added to Prisma database!`);
  };

  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const totalLifetimeSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-stone-950 text-stone-100 font-sans space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-[#00897b]" />
              Prisma Customer Directory & Loyalty Registry
            </h2>
            <p className="text-xs text-stone-400">
              Synchronized customer database with instant phone lookup, VIP tier grading, and past order records.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer self-start md:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Add New Customer
          </button>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-stone-800">
          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-stone-400 font-medium">Total Registered Profiles</span>
              <p className="text-xl font-black text-white font-mono">{customers.length}</p>
            </div>
          </div>

          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-stone-400 font-medium">Accumulated Loyalty Points</span>
              <p className="text-xl font-black text-amber-300 font-mono">
                {totalLoyaltyPoints.toLocaleString()} <span className="text-xs font-normal">pts</span>
              </p>
            </div>
          </div>

          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-stone-400 font-medium">Total Customer LTV</span>
              <p className="text-xl font-black text-white font-mono">
                PKR {totalLifetimeSpent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex items-center gap-3 bg-stone-900 p-3 rounded-xl border border-stone-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone number (e.g. 0300...), sector or VIP tier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
          />
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 uppercase font-mono text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone & Email</th>
                <th className="p-4">Saved Address</th>
                <th className="p-4">VIP Tier</th>
                <th className="p-4">Loyalty Pts</th>
                <th className="p-4">Total Orders</th>
                <th className="p-4 text-right">Lifetime Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-stone-850 transition">
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#00897b]/20 border border-[#00897b]/40 text-emerald-300 flex items-center justify-center font-mono text-xs">
                      {cust.name[0]}
                    </div>
                    <span>{cust.name}</span>
                  </td>
                  <td className="p-4 font-mono">
                    <div className="text-white flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#00897b]" />
                      {cust.phone}
                    </div>
                    {cust.email && <span className="text-[10px] text-stone-500">{cust.email}</span>}
                  </td>
                  <td className="p-4 text-stone-400 max-w-xs truncate">
                    {cust.address || 'Counter / Takeaway'}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        cust.vipTier === 'Platinum'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : cust.vipTier === 'Gold'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      {cust.vipTier}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-bold text-amber-300">
                    {cust.loyaltyPoints}
                  </td>
                  <td className="p-4 font-mono">{cust.totalOrdersCount}</td>
                  <td className="p-4 font-mono font-bold text-right text-white">
                    PKR {cust.totalSpent.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD NEW CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#00897b]" />
                Register New Customer
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Zeeshan Haider"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Phone Number (Prisma Unique) *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 03001234567"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Delivery Address</label>
                <input
                  type="text"
                  placeholder="e.g. House 42-B, Sector F-7/2, Islamabad"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Special Preferences / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ring bell twice, extra garlic dip..."
                  value={newCust.deliveryNotes}
                  onChange={(e) => setNewCust({ ...newCust, deliveryNotes: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold shadow-md"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
