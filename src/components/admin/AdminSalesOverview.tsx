import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  AlertOctagon,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  CheckCircle,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useRestaurant } from '../../context/RestaurantContext';

export const AdminSalesOverview: React.FC = () => {
  const { orders, currentShift, salesAdjustments, users } = useRestaurant();
  const [timeRange, setTimeRange] = useState<'hourly' | 'daily' | 'weekly'>('hourly');
  const [adjustmentFilter, setAdjustmentFilter] = useState<'ALL' | 'CANCELLATION' | 'MODIFICATION'>('ALL');

  const isToday = (dateStr?: string) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  // Real-time calculation of Today's sales and adjustments
  const todayAllOrders = useMemo(() => {
    return orders.filter((o) => isToday(o.createdAt));
  }, [orders]);

  const todayValidOrders = useMemo(() => {
    return todayAllOrders.filter(
      (o) =>
        (o.status || '').toLowerCase() !== 'cancelled' &&
        (o.status || '').toLowerCase() !== 'refunded'
    );
  }, [todayAllOrders]);

  const todayCancelledOrders = useMemo(() => {
    return todayAllOrders.filter(
      (o) =>
        (o.status || '').toLowerCase() === 'cancelled' ||
        (o.status || '').toLowerCase() === 'refunded'
    );
  }, [todayAllOrders]);

  const todayCompletedOrders = useMemo(() => {
    return todayValidOrders.filter(
      (o) =>
        (o.status || '').toLowerCase() === 'completed' ||
        (o.status || '').toLowerCase() === 'delivered'
    );
  }, [todayValidOrders]);

  const todayActiveOrders = useMemo(() => {
    return todayValidOrders.filter(
      (o) =>
        (o.status || '').toLowerCase() !== 'completed' &&
        (o.status || '').toLowerCase() !== 'delivered'
    );
  }, [todayValidOrders]);

  const todayGrossSales = useMemo(() => {
    return todayValidOrders.reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0);
  }, [todayValidOrders]);

  const totalCancelledAmount = useMemo(() => {
    return todayCancelledOrders.reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0);
  }, [todayCancelledOrders]);

  const totalDeltasFromModifications = useMemo(() => {
    return salesAdjustments
      .filter((a) => a.type === 'MODIFICATION')
      .reduce((sum, a) => sum + a.netDelta, 0);
  }, [salesAdjustments]);

  const todayNetSales = todayGrossSales;
  const totalOrdersProcessed = todayValidOrders.length;
  const averageOrderValue = totalOrdersProcessed > 0 ? Math.round(todayNetSales / totalOrdersProcessed) : 0;
  const activeCashiersCount = users.filter((u) => u.active !== false && (u.role === 'cashier' || u.role === 'manager')).length;

  // Dynamic Chart Data: Hourly Breakdown (Calculated from real Prisma orders)
  const hourlyData = useMemo(() => {
    const hours = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'];
    const buckets: { [key: string]: { sales: number; orders: number; net: number } } = {
      '10:00': { sales: 0, orders: 0, net: 0 },
      '12:00': { sales: 0, orders: 0, net: 0 },
      '14:00': { sales: 0, orders: 0, net: 0 },
      '16:00': { sales: 0, orders: 0, net: 0 },
      '18:00': { sales: 0, orders: 0, net: 0 },
      '20:00': { sales: 0, orders: 0, net: 0 },
      '22:00': { sales: 0, orders: 0, net: 0 },
      '00:00': { sales: 0, orders: 0, net: 0 },
    };

    todayValidOrders.forEach((o) => {
      const orderDate = new Date(o.createdAt || Date.now());
      const h = orderDate.getHours();
      let slot = '10:00';
      if (h >= 23 || h < 1) slot = '00:00';
      else if (h >= 21) slot = '22:00';
      else if (h >= 19) slot = '20:00';
      else if (h >= 17) slot = '18:00';
      else if (h >= 15) slot = '16:00';
      else if (h >= 13) slot = '14:00';
      else if (h >= 11) slot = '12:00';

      const amt = o.total || o.subtotal || 0;
      buckets[slot].sales += amt;
      buckets[slot].net += amt;
      buckets[slot].orders += 1;
    });

    return hours.map((hour) => ({
      hour,
      sales: buckets[hour].sales,
      orders: buckets[hour].orders,
      net: buckets[hour].net,
    }));
  }, [todayValidOrders]);

  // Dynamic Chart Data: Daily Breakdown (Past 7 Days calculated from real Prisma orders)
  const dailyData = useMemo(() => {
    const days: { date: string; gross: number; net: number; orders: number; deductions: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

      let gross = 0;
      let deductions = 0;
      let orderCnt = 0;

      orders.forEach((o) => {
        const orderDateStr = new Date(o.createdAt || Date.now()).toISOString().split('T')[0];
        if (orderDateStr === dateStr) {
          const amt = o.total || o.subtotal || 0;
          if (o.status === 'cancelled' || o.status === 'refunded') {
            deductions += amt;
          } else {
            gross += amt;
            orderCnt += 1;
          }
        }
      });

      days.push({
        date: dayName,
        gross,
        deductions,
        net: gross,
        orders: orderCnt,
      });
    }

    return days;
  }, [orders]);

  // Dynamic Chart Data: Weekly Breakdown (Past 4 Weeks)
  const weeklyData = useMemo(() => {
    const weeks = [
      { week: 'Week 1', revenue: 0, net: 0, orders: 0 },
      { week: 'Week 2', revenue: 0, net: 0, orders: 0 },
      { week: 'Week 3', revenue: 0, net: 0, orders: 0 },
      { week: 'Week 4 (Current)', revenue: 0, net: 0, orders: 0 },
    ];

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    orders.forEach((o) => {
      const orderTime = new Date(o.createdAt || Date.now()).getTime();
      const diffDays = (now - orderTime) / DAY_MS;
      const amt = o.total || o.subtotal || 0;

      let idx = 3; // Current Week
      if (diffDays > 21) idx = 0;
      else if (diffDays > 14) idx = 1;
      else if (diffDays > 7) idx = 2;

      if (o.status !== 'cancelled' && o.status !== 'refunded') {
        weeks[idx].revenue += amt;
        weeks[idx].net += amt;
        weeks[idx].orders += 1;
      }
    });

    return weeks;
  }, [orders]);

  // Dynamic Payment Method Breakdown (Calculated from real transaction data)
  const paymentMethodData = useMemo(() => {
    let cash = 0;
    let card = 0;
    let online = 0;
    let total = 0;

    const sourceOrders = todayValidOrders.length > 0 ? todayValidOrders : orders.filter(o => o.status !== 'cancelled' && o.status !== 'refunded');

    sourceOrders.forEach((o) => {
      total++;
      const pm = (o.paymentMethod || o.type || '').toLowerCase();
      if (pm.includes('card')) card++;
      else if (pm.includes('online') || pm.includes('bank') || pm.includes('qr')) online++;
      else cash++;
    });

    if (total === 0) {
      return [
        { name: 'Cash at Counter', value: 0, color: '#00897b' },
        { name: 'Credit/Debit Card', value: 0, color: '#3b82f6' },
        { name: 'Online / Bank QR', value: 0, color: '#a855f7' },
      ];
    }

    const cashPct = Math.round((cash / total) * 100);
    const cardPct = Math.round((card / total) * 100);
    const onlinePct = Math.max(0, 100 - cashPct - cardPct);

    return [
      { name: 'Cash at Counter', value: cashPct, color: '#00897b' },
      { name: 'Credit/Debit Card', value: cardPct, color: '#3b82f6' },
      { name: 'Online / Bank QR', value: onlinePct, color: '#a855f7' },
    ];
  }, [todayValidOrders, orders]);

  const filteredAdjustments = useMemo(() => {
    if (adjustmentFilter === 'ALL') return salesAdjustments;
    return salesAdjustments.filter((a) => a.type === adjustmentFilter);
  }, [salesAdjustments, adjustmentFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Real-Time Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Net Sales */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Today's Net Sales</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              PKR {todayNetSales.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-time reconciled sales</span>
              <span className="text-stone-500 ml-1 font-mono">Gross: {todayGrossSales.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Orders Processed */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {totalOrdersProcessed} <span className="text-sm font-normal text-stone-400">tickets</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{orders.filter(o => o.status === 'completed').length} completed this session</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Order Value (AOV) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Average Ticket (AOV)</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              PKR {averageOrderValue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-purple-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Calculated from active shift tickets</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Active Cashiers & Adjustments */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Active Staff & Dels</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight flex items-center justify-between">
              <span>{activeCashiersCount} Cashiers</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-mono">
                -{salesAdjustments.length} Adjustments
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-stone-400">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift #{currentShift?.shiftNumber || '101'} active in terminal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Revenue Trajectory Chart */}
        <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00897b]" />
                Sales & Revenue Dynamics
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Dynamic visual tracking of floor sales and net revenues after cancellations
              </p>
            </div>

            {/* Time Toggle */}
            <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-semibold">
              <button
                onClick={() => setTimeRange('hourly')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeRange === 'hourly' ? 'bg-[#00897b] text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Hourly Peak
              </button>
              <button
                onClick={() => setTimeRange('daily')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeRange === 'daily' ? 'bg-[#00897b] text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimeRange('weekly')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeRange === 'weekly' ? 'bg-[#00897b] text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Weekly Trend
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {timeRange === 'hourly' ? (
                <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00897b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00897b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis dataKey="hour" stroke="#78716c" fontSize={11} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', borderColor: '#44403c', borderRadius: '0.75rem', color: '#f5f5f4' }}
                    formatter={(val: any) => [`PKR ${Number(val).toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#00897b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              ) : timeRange === 'daily' ? (
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis dataKey="date" stroke="#78716c" fontSize={11} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', borderColor: '#44403c', borderRadius: '0.75rem', color: '#f5f5f4' }}
                    formatter={(val: any, name: string) => [`PKR ${Number(val).toLocaleString()}`, name === 'gross' ? 'Gross Sales' : 'Net Sales']}
                  />
                  <Bar dataKey="gross" fill="#00897b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeek" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis dataKey="week" stroke="#78716c" fontSize={11} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', borderColor: '#44403c', borderRadius: '0.75rem', color: '#f5f5f4' }}
                    formatter={(val: any) => [`PKR ${Number(val).toLocaleString()}`, 'Net Revenue']}
                  />
                  <Area type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorWeek)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Col: Payment Breakdown & Settlement distribution */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="pb-3 border-b border-stone-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Settlement Channels
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">Tender breakdown by payment method</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1917', borderColor: '#44403c', borderRadius: '0.75rem', color: '#f5f5f4' }}
                  formatter={(val: any) => [`${val}% of total volume`, 'Share']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-stone-800">
            {paymentMethodData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-stone-300 font-medium">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Sales Ledger Adjustments Stream */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              Live Sales Ledger Adjustments & Audit Trail
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Live tracking of order cancellations, item modifications, and manager ledger override deductions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium">Filter Type:</span>
            <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-semibold">
              <button
                onClick={() => setAdjustmentFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  adjustmentFilter === 'ALL' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                All ({salesAdjustments.length})
              </button>
              <button
                onClick={() => setAdjustmentFilter('CANCELLATION')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  adjustmentFilter === 'CANCELLATION' ? 'bg-red-500/30 text-red-300 border border-red-500/40' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Cancellations
              </button>
              <button
                onClick={() => setAdjustmentFilter('MODIFICATION')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  adjustmentFilter === 'MODIFICATION' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Modifications
              </button>
            </div>
          </div>
        </div>

        {/* Adjustments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300 border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Authorizer</th>
                <th className="py-2.5 px-3">Item Changes</th>
                <th className="py-2.5 px-3 text-right">Old Total</th>
                <th className="py-2.5 px-3 text-right">New Total</th>
                <th className="py-2.5 px-3 text-right">Net Ledger Delta</th>
                <th className="py-2.5 px-3">Reason Code</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-sans">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500 italic">
                    No sales adjustments found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const isNegative = adj.netDelta < 0;
                  const isPositive = adj.netDelta > 0;
                  return (
                    <tr key={adj.id} className="hover:bg-stone-800/40 transition">
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                            adj.type === 'CANCELLATION'
                              ? 'bg-red-950/60 text-red-400 border-red-500/30'
                              : 'bg-blue-950/60 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {adj.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-white">{adj.orderNumber}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-stone-200">{adj.authorizerName}</span>
                        <span className="text-[10px] text-stone-400 block uppercase font-mono">{adj.authorizerRole}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-stone-300" title={adj.itemsSummary}>
                        {adj.itemsSummary}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-400">PKR {adj.originalAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">PKR {adj.newAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs ${
                            isNegative
                              ? 'bg-red-500/20 text-red-400'
                              : isPositive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {isNegative ? '-' : isPositive ? '+' : ''}PKR {Math.abs(adj.netDelta).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-stone-400 italic max-w-xs truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-stone-400 whitespace-nowrap">
                        {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
