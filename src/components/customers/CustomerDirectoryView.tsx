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
  ShieldAlert,
  Unlock,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Customer } from '../../types';
import { BlockCustomerModal } from '../pos/BlockCustomerModal';
import { ManagerAuthModal } from '../auth/ManagerAuthModal';

export const CustomerDirectoryView: React.FC = () => {
  const { customers, upsertCustomer, blockCustomer, unblockCustomer, showToast, currentUser } = useRestaurant();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [blockModalTarget, setBlockModalTarget] = useState<Customer | null>(null);
  const [isManagerAuthOpen, setIsManagerAuthOpen] = useState(false);
  const [pendingUnblockPhone, setPendingUnblockPhone] = useState<string | null>(null);

  const isManagerOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'manager' ||
    currentUser?.role === 'admin';
  const [newCust, setNewCust] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    deliveryNotes: '',
  });

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.vipTier && c.vipTier.toLowerCase().includes(q)) ||
      (c.blockReason && c.blockReason.toLowerCase().includes(q))
    );

    if (!matchesSearch) return false;
    if (statusFilter === 'blocked') return Boolean(c.isBlocked);
    if (statusFilter === 'active') return !c.isBlocked;
    return true;
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

  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const totalLifetimeSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalBlockedCount = customers.filter((c) => c.isBlocked).length;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 font-sans space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-[#00897b]" />
              Prisma Customer Directory & Loyalty Registry
            </h2>
            <p className="text-xs text-slate-500 dark:text-stone-400">
              Synchronized customer database with instant phone lookup, VIP tier grading, blacklist blocking, and past order records.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-stone-800">
          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-stone-400 font-medium">Total Registered Profiles</span>
              <p className="text-xl font-black text-white font-mono">{customers.length}</p>
            </div>
          </div>

          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-stone-400 font-medium">Accumulated Loyalty Points</span>
              <p className="text-xl font-black text-amber-300 font-mono">
                {totalLoyaltyPoints.toLocaleString()} <span className="text-xs font-normal">pts</span>
              </p>
            </div>
          </div>

          <div className="bg-stone-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-stone-400 font-medium">Blacklisted / Blocked Numbers</span>
              <p className="text-xl font-black text-red-400 font-mono">
                {totalBlockedCount} <span className="text-xs font-normal text-slate-500 dark:text-stone-400">blocked</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3 rounded-xl border border-slate-200 dark:border-stone-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone number, address, VIP tier, or block reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:text-stone-500 focus:outline-none focus:border-[#00897b]"
          />
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-stone-950 p-1 rounded-xl border border-slate-200 dark:border-stone-800 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#00897b] text-white'
                : 'text-slate-500 dark:text-stone-400 hover:text-white'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 dark:text-stone-400 hover:text-white'
            }`}
          >
            Active ({customers.filter((c) => !c.isBlocked).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              statusFilter === 'blocked'
                ? 'bg-red-600 text-white'
                : 'text-red-400 hover:text-red-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Blocked ({totalBlockedCount})
          </button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-stone-300">
            <thead className="bg-stone-950/80 text-slate-500 dark:text-stone-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200 dark:border-stone-800">
              <tr>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone & Email</th>
                <th className="p-4">Saved Address</th>
                <th className="p-4">Status & VIP</th>
                <th className="p-4">Loyalty Pts</th>
                <th className="p-4">Total Orders</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {filteredCustomers.map((cust) => (
                <tr
                  key={cust.id}
                  className={`transition ${
                    cust.isBlocked
                      ? 'bg-red-950/15 hover:bg-red-950/30'
                      : 'hover:bg-stone-850'
                  }`}
                >
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono text-xs ${
                        cust.isBlocked
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : 'bg-[#00897b]/20 border-[#00897b]/40 text-emerald-300'
                      }`}
                    >
                      {cust.isBlocked ? '✕' : cust.name[0] || 'C'}
                    </div>
                    <div>
                      <span className="block">{cust.name}</span>
                      {cust.isBlocked && (
                        <span className="text-[10px] font-normal text-red-400 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {cust.blockReason || 'Customer is blocked'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono">
                    <div className="text-white flex items-center gap-1.5">
                      <Phone className={`w-3 h-3 ${cust.isBlocked ? 'text-red-400' : 'text-[#00897b]'}`} />
                      {cust.phone}
                    </div>
                    {cust.email && <span className="text-[10px] text-slate-400 dark:text-stone-500">{cust.email}</span>}
                  </td>
                  <td className="p-4 text-slate-500 dark:text-stone-400 max-w-xs truncate">
                    {cust.address || 'Counter / Takeaway'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      {cust.isBlocked ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-600/30 text-red-300 border border-red-500/50">
                          ⛔ BLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                          cust.vipTier === 'Platinum'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : cust.vipTier === 'Gold'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-50 dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-slate-300 dark:border-stone-700'
                        }`}
                      >
                        {cust.vipTier || 'Regular'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-amber-300">
                    {cust.loyaltyPoints || 0}
                  </td>
                  <td className="p-4 font-mono">{cust.totalOrdersCount || cust.totalVisits || 0}</td>
                  <td className="p-4 text-right">
                    {cust.isBlocked ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isManagerOrOwner) {
                            setPendingUnblockPhone(cust.phone);
                            setIsManagerAuthOpen(true);
                            return;
                          }
                          if (window.confirm(`Unblock customer ${cust.phone}?`)) {
                            await unblockCustomer(cust.phone);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 text-[11px] font-bold transition border border-emerald-500/30 cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Unlock className="w-3 h-3" />
                        Unblock
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isManagerOrOwner) {
                            showToast('⚠️ Manager or Owner privilege is required to block a customer.');
                            setPendingUnblockPhone(null);
                            setIsManagerAuthOpen(true);
                            return;
                          }
                          setBlockModalTarget(cust);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 text-[11px] font-bold transition border border-red-500/30 cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-stone-500 text-sm">
                    No customers found. Punch an order or click &quot;Add Customer&quot; to register one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCK CUSTOMER MODAL */}
      <BlockCustomerModal
        isOpen={Boolean(blockModalTarget)}
        onClose={() => setBlockModalTarget(null)}
        phone={blockModalTarget?.phone || ''}
        customerName={blockModalTarget?.name}
        onConfirmBlock={async (reason) => {
          if (blockModalTarget) {
            await blockCustomer(blockModalTarget.phone, reason, currentUser?.name);
            setBlockModalTarget(null);
          }
        }}
      />

      {/* MANAGER AUTH MODAL FOR CASHIERS */}
      <ManagerAuthModal
        isOpen={isManagerAuthOpen}
        onClose={() => {
          setIsManagerAuthOpen(false);
          setPendingUnblockPhone(null);
        }}
        actionTitle="Manager Authorization Required"
        actionDescription="Only Manager or Owner users are allowed to block or unblock customer accounts. Authenticate with a Manager PIN to proceed."
        onAuthorized={async (manager) => {
          setIsManagerAuthOpen(false);
          if (pendingUnblockPhone) {
            await unblockCustomer(pendingUnblockPhone);
            setPendingUnblockPhone(null);
          }
        }}
      />

      {/* ADD NEW CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#00897b]" />
                Register New Customer
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-500 dark:text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 dark:text-stone-300 font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Zeeshan Haider"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-stone-300 font-semibold block mb-1">Phone Number (Prisma Unique) *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 03001234567"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-stone-300 font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-stone-300 font-semibold block mb-1">Delivery Address</label>
                <input
                  type="text"
                  placeholder="e.g. House 42-B, Sector F-7/2, Islamabad"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-stone-300 font-semibold block mb-1">Special Preferences / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ring bell twice, extra garlic dip..."
                  value={newCust.deliveryNotes}
                  onChange={(e) => setNewCust({ ...newCust, deliveryNotes: e.target.value })}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300 text-xs font-semibold"
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
