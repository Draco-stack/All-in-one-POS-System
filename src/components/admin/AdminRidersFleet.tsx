import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  UserCheck,
  Package,
  X,
  AlertCircle,
} from 'lucide-react';
import { UserRole } from '../../types';

export const AdminRidersFleet: React.FC = () => {
  const { users, orders, addNewUser, outlets, showToast } = useRestaurant();
  const [searchFilter, setSearchFilter] = useState('');
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderOutlet, setNewRiderOutlet] = useState('Main Branch');

  // Filter riders from registered users
  const riders = useMemo(() => users.filter((u) => u.role === 'rider'), [users]);

  // Calculate detailed live stats strictly from raw order records
  const riderStats = useMemo(() => {
    return riders.map((rider) => {
      const riderName = rider.name.trim().toLowerCase();
      const riderId = rider.id.trim().toLowerCase();
      const riderUsername = (rider.username || '').trim().toLowerCase();

      const assignedOrders = orders.filter((o) => {
        const d = (o.deliveryDriver || '').trim().toLowerCase();
        const oRiderId = (o as any).assignedRiderId ? String((o as any).assignedRiderId).trim().toLowerCase() : '';
        return (
          d === riderName ||
          d === riderId ||
          (riderUsername && d === riderUsername) ||
          (oRiderId && (oRiderId === riderId || oRiderId === riderName))
        );
      });

      const deliveredOrders = assignedOrders.filter(
        (o) => o.status === 'completed' || o.status === 'delivered'
      );
      const cancelledOrders = assignedOrders.filter(
        (o) => o.status === 'cancelled' || o.status === 'refunded'
      );
      const inProgressOrders = assignedOrders.filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled' &&
          o.status !== 'refunded'
      );

      const deliveredRevenue = deliveredOrders.reduce(
        (sum, o) => sum + (o.total || o.subtotal || 0),
        0
      );

      const totalFinished = deliveredOrders.length + cancelledOrders.length;
      const successRate =
        totalFinished > 0
          ? Math.round((deliveredOrders.length / totalFinished) * 100)
          : deliveredOrders.length > 0
          ? 100
          : 0;

      return {
        ...rider,
        assignedOrders,
        stats: {
          total: assignedOrders.length,
          delivered: deliveredOrders.length,
          cancelled: cancelledOrders.length,
          inProgress: inProgressOrders.length,
          deliveredRevenue,
          successRate,
        },
      };
    });
  }, [riders, orders]);

  // Fleet Overview Summary Metrics
  const fleetTotals = useMemo(() => {
    const totalAssigned = riderStats.reduce((sum, r) => sum + r.stats.total, 0);
    const totalDelivered = riderStats.reduce((sum, r) => sum + r.stats.delivered, 0);
    const totalCancelled = riderStats.reduce((sum, r) => sum + r.stats.cancelled, 0);
    const totalActive = riderStats.reduce((sum, r) => sum + r.stats.inProgress, 0);
    const totalRevenue = riderStats.reduce((sum, r) => sum + r.stats.deliveredRevenue, 0);
    const overallSuccessRate =
      totalDelivered + totalCancelled > 0
        ? Math.round((totalDelivered / (totalDelivered + totalCancelled)) * 100)
        : totalDelivered > 0
        ? 100
        : 0;

    return {
      activeRidersCount: riders.filter((r) => r.active !== false).length,
      totalAssigned,
      totalDelivered,
      totalCancelled,
      totalActive,
      totalRevenue,
      overallSuccessRate,
    };
  }, [riderStats, riders]);

  // Filtered riders for display
  const displayedRiders = useMemo(() => {
    if (!searchFilter.trim()) return riderStats;
    const query = searchFilter.toLowerCase();
    return riderStats.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        (r.username && r.username.toLowerCase().includes(query)) ||
        (r.outlet && r.outlet.toLowerCase().includes(query))
    );
  }, [riderStats, searchFilter]);

  const handleCreateRider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName.trim()) return;

    const cleanUsername = `rider_${newRiderName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    addNewUser({
      name: newRiderName.trim(),
      username: cleanUsername,
      pin: '0000',
      role: 'rider' as UserRole,
      outlet: newRiderOutlet || 'Main Branch',
      active: true,
    });

    setNewRiderName('');
    setIsAddRiderOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#00897b]" />
            <h2 className="text-xl font-black text-white uppercase tracking-wider">
              Rider Fleet & Delivery Performance
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Real-time delivery statistics, fulfillment tracking, and fleet logs calculated purely from raw order records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rider..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#00897b]"
            />
          </div>

          <button
            onClick={() => setIsAddRiderOpen(true)}
            className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-[#00897b]/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Rider
          </button>
        </div>
      </div>

      {/* Fleet KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>Active Fleet</span>
            <UserCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{fleetTotals.activeRidersCount}</div>
          <div className="text-[10px] text-stone-500 mt-1">Registered delivery riders</div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>Total Assigned</span>
            <Package className="w-4 h-4 text-stone-300" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{fleetTotals.totalAssigned}</div>
          <div className="text-[10px] text-stone-500 mt-1">All time dispatches</div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>In Transit</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">{fleetTotals.totalActive}</div>
          <div className="text-[10px] text-stone-500 mt-1">Currently on delivery</div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>Delivered</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{fleetTotals.totalDelivered}</div>
          <div className="text-[10px] text-stone-500 mt-1">Fulfilled successfully</div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>Cancelled / Void</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-bold text-red-400 font-mono">{fleetTotals.totalCancelled}</div>
          <div className="text-[10px] text-stone-500 mt-1">Unfulfilled runs</div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-[11px] font-semibold mb-1">
            <span>Delivered Cash</span>
            <DollarSign className="w-4 h-4 text-[#00897b]" />
          </div>
          <div className="text-lg font-bold text-[#00897b] font-mono truncate">
            PKR {fleetTotals.totalRevenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-500 mt-1">{fleetTotals.overallSuccessRate}% success rate</div>
        </div>
      </div>

      {/* Rider Performance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedRiders.map((rider) => (
          <div
            key={rider.id}
            className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-stone-700 transition"
          >
            <div>
              {/* Rider Header */}
              <div className="flex items-start justify-between border-b border-stone-800/80 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-lg">
                    🛵
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
                      {rider.name}
                      {rider.active === false && (
                        <span className="px-1.5 py-0.2 bg-red-950 text-red-400 border border-red-800/40 rounded text-[9px] font-bold">
                          Inactive
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono">
                      <span>@{rider.username}</span>
                      <span>•</span>
                      <span>{rider.outlet || 'Main Branch'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 bg-stone-950 border border-stone-800 text-stone-300 text-xs font-mono font-bold rounded-lg block">
                    {rider.stats.total} Orders
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">
                    {rider.stats.successRate}% Success
                  </span>
                </div>
              </div>

              {/* Success Rate Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-stone-950 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${
                        rider.stats.total > 0
                          ? (rider.stats.delivered / rider.stats.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${
                        rider.stats.total > 0
                          ? (rider.stats.inProgress / rider.stats.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="bg-red-500 h-full transition-all"
                    style={{
                      width: `${
                        rider.stats.total > 0
                          ? (rider.stats.cancelled / rider.stats.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Metrics Breakdown */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-stone-950 rounded-xl p-2.5 text-center border border-stone-800/80">
                  <div className="text-[10px] text-stone-400 font-semibold mb-0.5 uppercase tracking-wider">
                    In Transit
                  </div>
                  <div className="text-amber-400 font-mono font-bold text-sm">
                    {rider.stats.inProgress}
                  </div>
                </div>
                <div className="bg-stone-950 rounded-xl p-2.5 text-center border border-stone-800/80">
                  <div className="text-[10px] text-emerald-400 font-semibold mb-0.5 uppercase tracking-wider">
                    Delivered
                  </div>
                  <div className="text-emerald-400 font-mono font-bold text-sm">
                    {rider.stats.delivered}
                  </div>
                </div>
                <div className="bg-stone-950 rounded-xl p-2.5 text-center border border-stone-800/80">
                  <div className="text-[10px] text-red-400 font-semibold mb-0.5 uppercase tracking-wider">
                    Cancelled
                  </div>
                  <div className="text-red-400 font-mono font-bold text-sm">
                    {rider.stats.cancelled}
                  </div>
                </div>
              </div>

              {/* Delivered Revenue */}
              <div className="flex items-center justify-between px-3 py-2 bg-stone-950/60 rounded-xl border border-stone-800/60 text-xs mb-3">
                <span className="text-stone-400">Total Delivered Revenue:</span>
                <span className="font-bold text-[#00897b] font-mono">
                  PKR {rider.stats.deliveredRevenue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Recent Assigned Deliveries */}
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Recent Deliveries:</span>
                <span className="text-stone-500 font-normal">
                  {rider.assignedOrders.length} assigned
                </span>
              </div>
              <div className="overflow-y-auto max-h-36 space-y-1.5 pr-1 no-scrollbar">
                {rider.assignedOrders.length === 0 ? (
                  <div className="text-stone-500 text-xs italic text-center py-4 bg-stone-950/40 rounded-xl border border-stone-800/40">
                    No delivery dispatches assigned yet.
                  </div>
                ) : (
                  rider.assignedOrders.slice(0, 5).map((ord) => (
                    <div
                      key={ord.id}
                      className="flex justify-between items-center bg-stone-950 rounded-xl p-2 border border-stone-800/80 text-xs"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-mono text-white font-bold text-[11px]">
                          #{ord.orderNumber.replace('ORD-', '')}
                        </span>
                        <span className="text-[10px] text-stone-400 truncate max-w-[140px]">
                          {ord.customer?.address || ord.customer?.name || 'Walk-in Delivery'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[11px] font-bold text-stone-200 font-mono">
                          PKR {(ord.total || ord.subtotal || 0).toLocaleString()}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold mt-0.5 uppercase ${
                            ord.status === 'completed' || ord.status === 'delivered'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                              : ord.status === 'cancelled' || ord.status === 'refunded'
                              ? 'bg-red-950/80 text-red-400 border border-red-800/40'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}

        {displayedRiders.length === 0 && (
          <div className="col-span-full py-16 text-center border border-stone-800 border-dashed rounded-2xl bg-stone-900/40">
            <Truck className="w-10 h-10 text-stone-600 mx-auto mb-3" />
            <div className="text-stone-300 font-bold text-sm">No Riders Found</div>
            <div className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Add a rider to your delivery fleet to start assigning and tracking orders with live raw statistics.
            </div>
            <button
              onClick={() => setIsAddRiderOpen(true)}
              className="mt-4 px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-[#00897b]/20"
            >
              <Plus className="w-4 h-4" />
              Add First Rider
            </button>
          </div>
        )}
      </div>

      {/* Add Rider Modal */}
      {isAddRiderOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#00897b]" />
                <h4 className="text-sm font-bold text-white">Register New Delivery Rider</h4>
              </div>
              <button
                onClick={() => setIsAddRiderOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRider} className="p-5 space-y-4">
              <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl text-cyan-300 text-xs flex items-start gap-2.5">
                <span className="text-base leading-none">🛵</span>
                <div>
                  <span className="font-bold text-cyan-200">Non-Login Fleet Account:</span> Riders are recorded for dispatching orders and tracking delivery performance. They do not have access to POS cashier operations.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Rider Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bilal Ahmed"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Assigned Branch / Outlet
                </label>
                <select
                  value={newRiderOutlet}
                  onChange={(e) => setNewRiderOutlet(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="Main Branch">Main Branch</option>
                  {outlets.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddRiderOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold transition cursor-pointer shadow-md shadow-[#00897b]/20"
                >
                  Register Rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

