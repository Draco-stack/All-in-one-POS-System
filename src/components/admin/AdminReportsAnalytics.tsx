import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  UserCheck,
  TrendingUp,
  DollarSign,
  Award,
  AlertCircle,
  CheckCircle,
  Filter,
  Printer,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRestaurant } from '../../context/RestaurantContext';
import { HistoricalShiftRecord } from '../../data/mockData';
import { DailyFinancialSummaryThermal } from './DailyFinancialSummaryThermal';

export const AdminReportsAnalytics: React.FC = () => {
  const { historicalShifts, currentShift, menuItems, orders, showToast } = useRestaurant();
  const [selectedReportTab, setSelectedReportTab] = useState<'SHIFTS' | 'MONTHLY' | 'TOP_ITEMS'>('SHIFTS');
  const [shiftSearchQuery, setShiftSearchQuery] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);

  // Top Selling Items Calculation (Dynamically aggregated from real Prisma orders and menu items)
  const topSellingItems = useMemo(() => {
    const itemStats: { [name: string]: { name: string; category: string; soldCount: number; revenue: number } } = {};

    orders.forEach((o) => {
      if ((o.status || '').toLowerCase() !== 'cancelled' && (o.status || '').toLowerCase() !== 'refunded') {
        (o.items || []).forEach((i) => {
          const qty = i.quantity || 1;
          const rev = (i.price || 0) * qty;
          const name = i.name;

          if (!itemStats[name]) {
            // Find category from menuItems
            const catalogItem = menuItems.find((m) => m.name.toLowerCase() === name.toLowerCase());
            const category = catalogItem?.category || 'general';

            itemStats[name] = {
              name,
              category,
              soldCount: 0,
              revenue: 0,
            };
          }
          itemStats[name].soldCount += qty;
          itemStats[name].revenue += rev;
        });
      }
    });

    const sorted = Object.values(itemStats).sort((a, b) => b.soldCount - a.soldCount);

    return sorted.map((it) => ({
      ...it,
      margin: it.revenue > 0 ? '68%' : '0%',
    }));
  }, [orders, menuItems]);

  // Filtered Shifts
  const allShifts = useMemo(() => {
    const list: (HistoricalShiftRecord | any)[] = [...historicalShifts];
    if (currentShift && currentShift.status === 'open') {
      list.unshift({
        id: currentShift.id,
        shiftNumber: currentShift.shiftNumber,
        cashierName: currentShift.cashierName,
        role: 'Active Register',
        outlet: 'Main Branch',
        openedAt: currentShift.openedAt,
        closedAt: 'In Progress (Active)',
        startingPettyCash: currentShift.openingFloat,
        totalGrossSales: currentShift.totalGrossSales,
        cashSales: currentShift.cashSales,
        cardSales: currentShift.cardSales,
        expectedCash: currentShift.cashInDrawerExpected,
        actualCash: currentShift.cashInDrawerExpected,
        shortageOverage: 0,
        transactionsCount: currentShift.transactionsCount,
        status: 'open',
        notes: 'Active register floor shift currently accepting orders.',
      });
    }
    return list;
  }, [historicalShifts, currentShift]);

  const filteredShifts = useMemo(() => {
    return allShifts.filter((s) => {
      const q = shiftSearchQuery.toLowerCase();
      return (
        s.shiftNumber.toLowerCase().includes(q) ||
        s.cashierName.toLowerCase().includes(q) ||
        s.outlet.toLowerCase().includes(q)
      );
    });
  }, [allShifts, shiftSearchQuery]);

  // Daily Summary Calculations
  const dailySummaryData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let grossSales = 0;
    let discounts = 0;
    let cashSales = 0;
    let cardSales = 0;
    let totalOrders = 0;

    orders.forEach(o => {
      const oDate = new Date(o.createdAt);
      if (oDate.getTime() >= today.getTime()) {
        if (o.status === 'cancelled' || o.status === 'refunded') {
          discounts += (o.total || o.subtotal || 0);
        } else {
          const amt = (o.total || o.subtotal || 0);
          grossSales += amt;
          totalOrders++;
          
          const pm = (o.paymentMethod || 'cash').toLowerCase();
          if (pm === 'cash' || pm === 'cod' || pm === 'cash_on_delivery' || (!pm.includes('card') && !pm.includes('online') && !pm.includes('pos') && !pm.includes('bank') && !pm.includes('digital'))) {
            cashSales += amt;
          } else {
            cardSales += amt;
          }
        }
      }
    });

    const netSales = grossSales - discounts;
    
    return {
      dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      grossSales,
      netSales,
      totalOrders,
      cogs: Math.round(grossSales * 0.32),
      discounts,
      cashSales,
      cardSales,
      shifts: allShifts.filter(s => new Date(s.openedAt).getTime() >= today.getTime() || s.status === 'open')
    };
  }, [orders, allShifts]);

  // Monthly Executive P&L (Dynamically aggregated from real Prisma database transaction history)
  const monthlySummaries = useMemo(() => {
    const monthsMap: {
      [key: string]: {
        month: string;
        grossSales: number;
        cogs: number;
        discountsAndRefunds: number;
        operatingExpenses: number;
        netProfit: number;
        ordersCount: number;
        aov: number;
        status: string;
      };
    } = {};

    // If no orders exist yet, initialize current month with zero
    const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    monthsMap[currentMonthKey] = {
      month: `${currentMonthLabel} (MTD)`,
      grossSales: 0,
      cogs: 0,
      discountsAndRefunds: 0,
      operatingExpenses: 0,
      netProfit: 0,
      ordersCount: 0,
      aov: 0,
      status: 'Current Month',
    };

    // Process all orders
    orders.forEach((o) => {
      const d = new Date(o.createdAt || Date.now());
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!monthsMap[monthKey]) {
        const isCurrentMonth = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
        monthsMap[monthKey] = {
          month: isCurrentMonth ? `${monthLabel} (MTD)` : monthLabel,
          grossSales: 0,
          cogs: 0,
          discountsAndRefunds: 0,
          operatingExpenses: 0,
          netProfit: 0,
          ordersCount: 0,
          aov: 0,
          status: isCurrentMonth ? 'Current Month' : 'Closed & Audited',
        };
      }

      const amt = o.total || o.subtotal || 0;
      if (o.status === 'cancelled' || o.status === 'refunded') {
        monthsMap[monthKey].discountsAndRefunds += amt;
      } else {
        monthsMap[monthKey].grossSales += amt;
        monthsMap[monthKey].ordersCount += 1;
      }
    });

    const list = Object.values(monthsMap).map((m) => {
      const cogs = Math.round(m.grossSales * 0.32);
      const operatingExpenses = Math.round(m.grossSales * 0.15);
      const netProfit = Math.max(0, m.grossSales - cogs - m.discountsAndRefunds - operatingExpenses);
      const aov = m.ordersCount > 0 ? Math.round(m.grossSales / m.ordersCount) : 0;
      return {
        ...m,
        cogs,
        operatingExpenses,
        netProfit,
        aov,
      };
    });

    return list;
  }, [orders]);

  const handleExportData = () => {
    if (selectedReportTab === 'SHIFTS') {
      if (filteredShifts.length === 0) {
        showToast('No shift audits to export.');
        return;
      }
      const headers = ['Shift #', 'Cashier', 'Outlet', 'Opened At', 'Closed At', 'Float (PKR)', 'Gross Sales (PKR)', 'Cash (PKR)', 'Card (PKR)', 'Expected (PKR)', 'Actual (PKR)', 'Variance (PKR)', 'Status'];
      const rows = filteredShifts.map((s) => [
        s.shiftNumber,
        s.cashierName,
        s.outlet,
        new Date(s.openedAt).toLocaleString(),
        s.closedAt === 'In Progress (Active)' ? s.closedAt : new Date(s.closedAt).toLocaleString(),
        s.startingPettyCash,
        s.totalGrossSales,
        s.cashSales,
        s.cardSales,
        s.expectedCash,
        s.actualCash,
        s.shortageOverage,
        s.status,
      ]);
      const orderHeaders = ['Order #', 'Date Time', 'Shift #', 'Cashier', 'Status', 'Payment Status', 'Payment Method', 'Order Type', 'Items Summary', 'Subtotal (PKR)', 'Tax (PKR)', 'Discount (PKR)', 'Total (PKR)'];
      const orderRows: any[] = [];

      orders.forEach(o => {
        const orderTime = new Date(o.createdAt).getTime();
        let shiftNum = 'Unknown';
        for (const s of filteredShifts) {
          const start = new Date(s.openedAt).getTime();
          const end = s.closedAt === 'In Progress (Active)' ? Date.now() : new Date(s.closedAt).getTime();
          if (orderTime >= start && orderTime <= end) {
            shiftNum = s.shiftNumber;
            break;
          }
        }
        
        const itemsSummary = o.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
        orderRows.push([
          o.orderNumber,
          new Date(o.createdAt).toLocaleString(),
          shiftNum,
          o.cashierName || 'System',
          o.status,
          o.paymentStatus,
          o.paymentMethod,
          o.orderType,
          itemsSummary,
          o.subtotal,
          o.tax,
          o.discount,
          o.total
        ]);
      });

      const wb = XLSX.utils.book_new();
      const wsShifts = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, wsShifts, 'Shifts Summary');
      
      const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'All Orders');

      XLSX.writeFile(wb, `Shifts_And_Orders_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('✓ Shift audit and orders report downloaded as Excel');
    } else if (selectedReportTab === 'TOP_ITEMS') {
      if (topSellingItems.length === 0) {
        showToast('No sales data to export.');
        return;
      }
      const headers = ['Item Name', 'Category', 'Units Sold', 'Total Revenue (PKR)', 'Est. Margin'];
      const rows = topSellingItems.map((i) => [
        `"${i.name.replace(/"/g, '""')}"`,
        i.category,
        i.soldCount,
        i.revenue,
        i.margin,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Top_Items_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Top selling items report downloaded as CSV');
    } else {
      const headers = ['Month', 'Gross Sales (PKR)', 'COGS (PKR)', 'Refunds & Discounts (PKR)', 'OpEx (PKR)', 'Net Profit (PKR)', 'Orders Count', 'AOV (PKR)', 'Status'];
      const rows = monthlySummaries.map((m) => [
        `"${m.month}"`,
        m.grossSales,
        m.cogs,
        m.discountsAndRefunds,
        m.operatingExpenses,
        m.netProfit,
        m.ordersCount,
        m.aov,
        m.status,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Executive_PL_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Executive P&L statement downloaded as CSV');
    }
  };

  const handlePrintReport = () => {
    setIsPrintingThermal(true);
    showToast('🖨️ Generating daily thermal summary PDF...');
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintingThermal(false), 500);
    }, 200);
  };

  return (
    <>
      {isPrintingThermal && <DailyFinancialSummaryThermal {...dailySummaryData} />}
      <div className="space-y-6">
      {/* Top Tabs */}
      <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-stone-950/80 p-1 rounded-xl border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setSelectedReportTab('SHIFTS')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              selectedReportTab === 'SHIFTS'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Shift Closing Audits ({allShifts.length})
          </button>
          <button
            onClick={() => setSelectedReportTab('MONTHLY')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              selectedReportTab === 'MONTHLY'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Monthly Executive P&L
          </button>
          <button
            onClick={() => setSelectedReportTab('TOP_ITEMS')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              selectedReportTab === 'TOP_ITEMS'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            Top-Selling Menu Items
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportData}
            className="px-3.5 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/20 active:scale-95 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-95 border border-emerald-500/30"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* TAB 1: Shift Closing Audits */}
      {selectedReportTab === 'SHIFTS' && (
        <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                Shift Reconciliation & Cash Discrepancy Audits
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Starting petty cash float, expected cash in drawer, actual closing counts, and shortage/overage logs
              </p>
            </div>

            <input
              type="text"
              placeholder="Filter by shift # or cashier..."
              value={shiftSearchQuery}
              onChange={(e) => setShiftSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-stone-500 w-full sm:w-60 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Shift #</th>
                  <th className="py-2.5 px-3">Cashier / Staff</th>
                  <th className="py-2.5 px-3">Outlet</th>
                  <th className="py-2.5 px-3 text-right">Petty Float</th>
                  <th className="py-2.5 px-3 text-right">Gross Sales</th>
                  <th className="py-2.5 px-3 text-right">Expected Cash</th>
                  <th className="py-2.5 px-3 text-right">Actual Count</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Auditor Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredShifts.map((sh) => {
                  const variance = sh.shortageOverage || (sh.actualCash - sh.expectedCash) || 0;
                  const isShortage = variance < 0;
                  const isOverage = variance > 0;
                  const isMatch = variance === 0;

                  return (
                    <tr key={sh.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                        {sh.shiftNumber}
                      </td>
                      <td className="py-3 px-3 font-medium text-stone-200">
                        {sh.cashierName}
                        <span className="block text-[10px] text-stone-500 font-mono">{sh.role}</span>
                      </td>
                      <td className="py-3 px-3 text-stone-300 whitespace-nowrap">{sh.outlet}</td>
                      <td className="py-3 px-3 text-right font-mono text-stone-400">
                        PKR {sh.startingPettyCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                        PKR {sh.totalGrossSales.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-300">
                        PKR {sh.expectedCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        PKR {sh.actualCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-0.5 ${
                            isShortage
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isOverage
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {isShortage ? '-' : isOverage ? '+' : ''}PKR {Math.abs(variance).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                            sh.status === 'open'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                              : 'bg-stone-800 text-stone-400 border border-stone-700'
                          }`}
                        >
                          {sh.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-400 italic text-[11px] max-w-xs truncate" title={sh.notes}>
                        {sh.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Monthly Executive P&L */}
      {selectedReportTab === 'MONTHLY' && (
        <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="pb-3 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                Monthly Revenue & Profitability (P&L Ledger)
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Comprehensive accounting metrics across cost of goods sold (COGS), discounts, and operating margins
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">Base Currency: PKR</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {monthlySummaries.map((m, idx) => (
              <div key={idx} className="p-4 bg-stone-950/80 rounded-xl border border-white/5 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{m.month}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono border border-white/5">
                    {m.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs border-y border-white/5 py-2 font-mono">
                  <div className="flex justify-between text-stone-400">
                    <span>Gross Sales:</span>
                    <span className="text-white font-semibold">PKR {m.grossSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>COGS (Food Cost):</span>
                    <span className="text-red-400">-PKR {m.cogs.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Discounts / Mod Delta:</span>
                    <span className="text-amber-400">-PKR {m.discountsAndRefunds.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Operating Expenses:</span>
                    <span className="text-stone-400">-PKR {m.operatingExpenses.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400 uppercase tracking-wider font-semibold text-[10px]">Net Operating Profit:</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    PKR {m.netProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Top-Selling Menu Items */}
      {selectedReportTab === 'TOP_ITEMS' && (
        <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="pb-3 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Top-Selling Menu Items & Category Velocity
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Product popularity ranked by volume sold, gross contribution, and estimated profit margin
              </p>
            </div>
            <span className="text-xs text-stone-400">All Outlets Combined</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center">Rank</th>
                  <th className="py-2.5 px-3">Item Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                  <th className="py-2.5 px-3 text-right">Gross Margin</th>
                  <th className="py-2.5 px-3 text-center">Performance Indicator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {topSellingItems.map((it, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs font-mono ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-stone-700 text-stone-200'
                            : idx === 2
                            ? 'bg-amber-700/30 text-amber-400'
                            : 'text-stone-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-white">{it.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-stone-800/80 text-stone-300 text-[10px] uppercase font-mono border border-white/5">
                        {it.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                      {it.soldCount.toLocaleString()} units
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      PKR {it.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-stone-300 font-semibold">{it.margin}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <TrendingUp className="w-3.5 h-3.5" /> High Velocity
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
