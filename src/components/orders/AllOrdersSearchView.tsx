import React, { useState, useMemo, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Eye,
  Copy,
  Printer,
  ChevronLeft,
  ChevronRight,
  Truck,
  Store,
  Phone,
  Calendar,
  User,
  Building2,
  Receipt,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Layers,
  SlidersHorizontal,
  Zap,
  Sliders,
  X,
  ArrowUpDown,
  DollarSign,
  ListFilter,
  ChevronDown,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderStatus } from '../../types';
import { DeliveryOrderDetailsModal } from '../delivery/DeliveryOrderDetailsModal';
import { OrderFilterPanel } from './OrderFilterPanel';
import { exportToStyledExcel } from '../../utils/excelExporter';
import { getWhatsAppDispatchData } from '../../utils/whatsapp';

export const AllOrdersSearchView: React.FC = () => {
  const {
    orders,
    users,
    theme,
    updateOrderStatus,
    cancelOrder,
    assignDeliveryDriver,
    setActiveReceiptOrder,
    setPrintQueueOrder,
    showToast,
    syncFromServer,
  } = useRestaurant();

  // Filter Panel Visibility
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Filters State
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('time_desc');
  const [quickTab, setQuickTab] = useState<'ALL' | 'DELIVERED' | 'CANCELLED' | 'DISPATCHED' | 'KITCHEN'>('ALL');

  // View Mode: Virtual Infinite Scroll vs Paginated
  const [viewMode, setViewMode] = useState<'virtual' | 'paginated'>('virtual');

  // Real-time Sync & Polling State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString());

  // Pagination State (used in paginated mode)
  const [entriesPerPage, setEntriesPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Inspect Order Modal State
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Multi-Select Batch Actions State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  // Scroll Container Ref for Virtualizer
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Real-time socket listener and background polling worker (5s interval)
  useEffect(() => {
    let isMounted = true;
    const socket = io();

    const handleRealtimeStatusChange = () => {
      if (!isMounted) return;
      syncFromServer().then(() => {
        if (isMounted) setLastSyncedAt(new Date().toLocaleTimeString());
      });
    };

    socket.on('orderCreated', handleRealtimeStatusChange);
    socket.on('orderUpdated', handleRealtimeStatusChange);
    socket.on('orderStatusChanged', handleRealtimeStatusChange);

    const pollTimer = setInterval(() => {
      if (isMounted) {
        syncFromServer().then(() => {
          if (isMounted) setLastSyncedAt(new Date().toLocaleTimeString());
        });
      }
    }, 5000);

    return () => {
      isMounted = false;
      socket.disconnect();
      clearInterval(pollTimer);
    };
  }, [syncFromServer]);

  // Keep inspected order modal automatically updated when its status changes in background
  useEffect(() => {
    if (inspectOrder) {
      const updated = orders.find(
        (o) => o.id === inspectOrder.id || (inspectOrder.orderNumber && o.orderNumber === inspectOrder.orderNumber)
      );
      if (
        updated &&
        (updated.status !== inspectOrder.status ||
          updated.cancelReason !== inspectOrder.cancelReason ||
          updated.notes !== inspectOrder.notes)
      ) {
        setInspectOrder(updated);
      }
    }
  }, [orders, inspectOrder]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncFromServer();
    setLastSyncedAt(new Date().toLocaleTimeString());
    setIsRefreshing(false);
    showToast('🔄 Refreshed live orders list.');
  };

  // Multi-Select Batch Helper Functions
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllVisible = (targetOrders: Order[]) => {
    const targetIds = targetOrders.map((o) => o.id);
    const allSelected = targetIds.length > 0 && targetIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !targetIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  const selectAllFiltered = (filtered: Order[]) => {
    setSelectedOrderIds(filtered.map((o) => o.id));
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const handleBatchStatusUpdate = async (targetStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;

    let cancelReason = '';
    if (targetStatus === 'cancelled') {
      const reasonInput = window.prompt(
        `Batch Cancelling ${selectedOrderIds.length} orders.\nPlease enter a mandatory cancellation reason:`,
        'Batch cancellation by administrator'
      );
      if (reasonInput === null) return;
      cancelReason = reasonInput.trim() || 'Batch cancellation by administrator';
    } else {
      const confirmUpdate = window.confirm(
        `Are you sure you want to change the status of ${selectedOrderIds.length} selected orders to '${targetStatus.toUpperCase()}'?`
      );
      if (!confirmUpdate) return;
    }

    setIsBatchProcessing(true);
    let successCount = 0;

    for (const orderId of selectedOrderIds) {
      try {
        if (targetStatus === 'cancelled') {
          await cancelOrder(orderId, cancelReason);
        } else {
          await updateOrderStatus(orderId, targetStatus);
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to update order ${orderId}:`, err);
      }
    }

    setIsBatchProcessing(false);
    setSelectedOrderIds([]);
    showToast(`✓ Batch updated ${successCount} orders to ${targetStatus.toUpperCase()}`);
  };

  const handleBatchWhatsAppDispatch = () => {
    if (selectedOrderIds.length === 0) return;

    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

    const confirmDispatch = window.confirm(
      `Are you sure you want to open WhatsApp dispatch for ${selectedOrders.length} selected orders?\n\nNote: Please ensure popup blockers are disabled, as this will open multiple tabs.`
    );
    if (!confirmDispatch) return;

    selectedOrders.forEach((order, index) => {
      setTimeout(() => {
        const waData = getWhatsAppDispatchData(order);
        if (waData.url) {
          window.open(waData.url, '_blank');
        }
      }, index * 300);
    });

    showToast(`✓ Processing WhatsApp dispatch for ${selectedOrders.length} orders`);
  };

  // Extract unique Outlets & Users for filter dropdowns
  const availableOutlets = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const b = o.branchName || o.outlet;
      if (b) set.add(b);
    });
    return Array.from(set);
  }, [orders]);

  const availableUsers = useMemo(() => {
    const staffNames = new Set<string>();
    users.forEach((u) => staffNames.add(u.name));
    orders.forEach((o) => {
      if (o.punchedBy) staffNames.add(o.punchedBy);
      if (o.cashierName) staffNames.add(o.cashierName);
    });
    return Array.from(staffNames);
  }, [orders, users]);

  const availableSources = useMemo(() => {
    const sources = new Set<string>(['Call', 'App', 'Branch', 'Walk-in', 'Takeaway', 'Website', 'No Source']);
    orders.forEach((o) => {
      if (o.source) sources.add(o.source);
      if (o.sourceChannel) sources.add(o.sourceChannel);
    });
    return Array.from(sources);
  }, [orders]);

  // Compute Quick Tab Counts
  const counts = useMemo(() => {
    let delivered = 0;
    let cancelled = 0;
    let dispatched = 0;
    let kitchen = 0;

    orders.forEach((o) => {
      const st = (o.status || '').toLowerCase();
      if (st === 'delivered' || st === 'completed') delivered++;
      else if (st === 'cancelled' || st === 'refunded') cancelled++;
      else if (st === 'dispatched') dispatched++;
      else if (st === 'in_kitchen' || st === 'pending' || st === 'open' || st === 'punched') kitchen++;
    });

    return {
      all: orders.length,
      delivered,
      cancelled,
      dispatched,
      kitchen,
    };
  }, [orders]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedOutlet !== 'all') count++;
    if (selectedSource !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedUser !== 'all') count++;
    if (selectedDate !== '') count++;
    if (searchQuery.trim() !== '') count++;
    if (orderTypeFilter !== 'all') count++;
    if (minAmount !== '' || maxAmount !== '') count++;
    return count;
  }, [
    selectedOutlet,
    selectedSource,
    selectedStatus,
    selectedUser,
    selectedDate,
    searchQuery,
    orderTypeFilter,
    minAmount,
    maxAmount,
  ]);

  // Filter & Sort Orders Logic
  const filteredOrders = useMemo(() => {
    let result = orders.filter((order) => {
      // 1. Quick Tab Filter
      const st = (order.status || '').toLowerCase();
      if (quickTab === 'DELIVERED' && st !== 'delivered' && st !== 'completed') return false;
      if (quickTab === 'CANCELLED' && st !== 'cancelled' && st !== 'refunded') return false;
      if (quickTab === 'DISPATCHED' && st !== 'dispatched') return false;
      if (quickTab === 'KITCHEN' && st !== 'in_kitchen' && st !== 'pending' && st !== 'open' && st !== 'punched')
        return false;

      // 2. Outlet Filter
      if (selectedOutlet !== 'all') {
        const orderOutlet = (order.branchName || order.outlet || '').toLowerCase();
        if (!orderOutlet.includes(selectedOutlet.toLowerCase())) return false;
      }

      // 3. Source Filter
      if (selectedSource !== 'all') {
        const orderSrc = (order.source || order.sourceChannel || 'No Source').toLowerCase();
        if (!orderSrc.includes(selectedSource.toLowerCase())) return false;
      }

      // 4. Status Filter Dropdown
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'cancelled_all') {
          if (st !== 'cancelled' && st !== 'refunded') return false;
        } else if (selectedStatus === 'active') {
          if (st === 'delivered' || st === 'completed' || st === 'cancelled' || st === 'refunded') return false;
        } else {
          if (st !== selectedStatus.toLowerCase()) return false;
        }
      }

      // 5. User / Cashier Filter
      if (selectedUser !== 'all') {
        const orderUser = (order.punchedBy || order.cashierName || order.serverName || '').toLowerCase();
        if (!orderUser.includes(selectedUser.toLowerCase())) return false;
      }

      // 6. Date Filter
      if (selectedDate) {
        const d = new Date(order.createdAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${day}`;
        const isoDateStr = (order.createdAt || '').split('T')[0];
        if (localDateStr !== selectedDate && isoDateStr !== selectedDate) return false;
      }

      // 7. Order Type Filter (Dine-in / Delivery / Takeaway)
      if (orderTypeFilter !== 'all') {
        const t = (order.type || order.orderType || '').toLowerCase();
        if (orderTypeFilter === 'dine_in' && !t.includes('dine')) return false;
        if (orderTypeFilter === 'delivery' && !t.includes('deliv')) return false;
        if (orderTypeFilter === 'takeaway' && !t.includes('take') && !t.includes('pick') && !t.includes('branch'))
          return false;
      }

      // 8. Amount Range Filter
      if (minAmount !== '') {
        const minVal = parseFloat(minAmount);
        if (!isNaN(minVal) && order.total < minVal) return false;
      }
      if (maxAmount !== '') {
        const maxVal = parseFloat(maxAmount);
        if (!isNaN(maxVal) && order.total > maxVal) return false;
      }

      // 9. General Search Query (Name, Phone, Order Number, Address, Items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (order.orderNumber || order.id).toLowerCase().includes(q);
        const nameMatch = (order.customer?.name || '').toLowerCase().includes(q);
        const phoneMatch = (order.customer?.phone || '').includes(q);
        const addressMatch = (order.customer?.address || order.deliveryAddress || '').toLowerCase().includes(q);
        const itemMatch = order.items.some((it) => it.name.toLowerCase().includes(q));

        if (!numMatch && !nameMatch && !phoneMatch && !addressMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });

    // Sort Result
    result.sort((a, b) => {
      if (sortBy === 'time_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'time_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'total_desc') {
        return b.total - a.total;
      }
      if (sortBy === 'total_asc') {
        return a.total - b.total;
      }
      return 0;
    });

    return result;
  }, [
    orders,
    quickTab,
    selectedOutlet,
    selectedSource,
    selectedStatus,
    selectedUser,
    selectedDate,
    orderTypeFilter,
    minAmount,
    maxAmount,
    searchQuery,
    sortBy,
  ]);

  // Pagination Calculations for Paginated Mode
  const totalEntries = filteredOrders.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedOrders = useMemo(() => {
    if (viewMode === 'virtual') return filteredOrders;
    return filteredOrders.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredOrders, viewMode, startIndex, entriesPerPage]);

  // Display orders collection depending on view mode
  const displayedOrders = viewMode === 'virtual' ? filteredOrders : paginatedOrders;

  // Virtualizer Setup for High-Performance Smooth 60fps Scrolling
  const rowVirtualizer = useVirtualizer({
    count: displayedOrders.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSelectedOutlet('all');
    setSelectedSource('all');
    setSelectedStatus('all');
    setSelectedUser('all');
    setSelectedDate('');
    setSearchQuery('');
    setOrderTypeFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('time_desc');
    setQuickTab('ALL');
    setCurrentPage(1);
    showToast('Filters reset to default view.');
  };

  // Export to Structured Excel (.xls/.xlsx)
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('⚠️ No orders available to export.');
      return;
    }

    const reportType =
      quickTab === 'CANCELLED'
        ? 'rejected'
        : quickTab === 'DELIVERED'
        ? 'delivered'
        : 'all';

    exportToStyledExcel({
      reportType,
      orders: filteredOrders,
      filename: `Order_Report_${new Date().toISOString().split('T')[0]}.xls`,
    });

    showToast(`📊 Exported ${filteredOrders.length} orders into styled Excel report!`);
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    if (filteredOrders.length === 0) {
      showToast('⚠️ No orders to copy.');
      return;
    }

    const text = filteredOrders
      .map(
        (o, i) =>
          `${i + 1}. #${o.orderNumber || o.id} | ${o.customer?.name || 'Walk-in'} | ${o.customer?.phone || 'N/A'} | ${o.status.toUpperCase()} | PKR ${o.total.toLocaleString()}`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    showToast(`📋 Copied summary of ${filteredOrders.length} orders to clipboard!`);
  };

  // Helper for Source Badge Color
  const getSourceBadgeClass = (source?: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('call')) return 'bg-purple-950/80 text-purple-300 border-purple-800/50';
    if (s.includes('app')) return 'bg-blue-950/80 text-blue-300 border-blue-800/50';
    if (s.includes('branch')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50';
    if (s.includes('takeaway')) return 'bg-amber-950/80 text-amber-300 border-amber-800/50';
    return 'bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700';
  };

  // Helper for Outlet Code Pill
  const getOutletCode = (order: Order) => {
    const raw = order.outlet || order.branchName || 'MB';
    if (raw.toLowerCase().includes('jhang') || raw.toLowerCase().includes('jc')) return 'JC';
    if (raw.toLowerCase().includes('main') || raw.toLowerCase().includes('mb')) return 'MB';
    if (raw.toLowerCase().includes('city') || raw.toLowerCase().includes('mc')) return 'MC';
    if (raw.toLowerCase().includes('delivery') || raw.toLowerCase().includes('dr')) return 'DR';
    if (raw.toLowerCase().includes('express') || raw.toLowerCase().includes('eg')) return 'EG';
    if (raw.toLowerCase().includes('sheikhupura') || raw.toLowerCase().includes('skp')) return 'SKP';
    return raw.substring(0, 3).toUpperCase();
  };

  // Helper for Status Badge
  const renderStatusBadge = (order: Order) => {
    const st = (order.status || 'pending').toLowerCase();
    if (st === 'delivered' || st === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono text-[11px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Delivered
        </span>
      );
    }
    if (st === 'cancelled' || st === 'refunded') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800/60 font-mono text-[11px] font-bold">
          <XCircle className="w-3 h-3 text-rose-400" />
          Cancelled
        </span>
      );
    }
    if (st === 'dispatched') {
      const isTakeaway = order.type === 'takeaway' || order.orderType === 'takeaway';
      if (isTakeaway) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Ready for Pickup
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-400 border border-blue-800/60 font-mono text-[11px] font-bold">
          <Truck className="w-3 h-3 text-blue-400" />
          Dispatched
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono text-[11px] font-bold">
        <Clock className="w-3 h-3 text-amber-400" />
        {st.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden font-sans select-none ${
        isDark ? 'bg-[#090a0d] text-slate-900 dark:text-stone-100' : 'bg-slate-900 text-slate-900 dark:text-stone-100'
      }`}
    >
      {/* TOP HEADER BAR */}
      <header
        className={`px-3 sm:px-4 py-2.5 border-b flex flex-wrap md:flex-nowrap items-center justify-between gap-3 shrink-0 z-30 ${
          isDark ? 'bg-[#111319] border-slate-200 dark:border-stone-800' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md shrink-0">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight flex items-center gap-2 truncate">
              <span>All Orders Console</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20 font-bold uppercase hidden sm:flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Sync
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-stone-400 font-mono truncate hidden sm:block">
              High-performance query & virtualized rendering across all outlet records
            </p>
          </div>
        </div>

        {/* CONTROLS & QUICK STATUS PILLS */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          {/* Toggle Filter Panel Button */}
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`h-8 px-3 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
              isFilterPanelOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : isDark
                ? 'bg-slate-50 dark:bg-stone-800/80 hover:bg-stone-700 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700'
                : 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600'
            }`}
            title="Toggle Dedicated Filter Panel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-stone-950 font-mono text-[9px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Quick Status Tab Pills */}
          <div className="flex items-center gap-1 bg-[#090a0d] p-1 rounded-xl border border-slate-200 dark:border-stone-800 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x max-w-full">
            <button
              onClick={() => {
                setQuickTab('ALL');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                quickTab === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-stone-400 hover:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-800/50'
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[10px]">{counts.all}</span>
            </button>

            <button
              onClick={() => {
                setQuickTab('DELIVERED');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                quickTab === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delivered</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 font-mono text-[10px]">{counts.delivered}</span>
            </button>

            <button
              onClick={() => {
                setQuickTab('CANCELLED');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                quickTab === 'CANCELLED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-400 hover:bg-rose-950/40'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancelled</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-950/80 font-mono text-[10px]">{counts.cancelled}</span>
            </button>

            <button
              onClick={() => {
                setQuickTab('DISPATCHED');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                quickTab === 'DISPATCHED' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-400 hover:bg-blue-950/40'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dispatched</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-950/80 font-mono text-[10px]">{counts.dispatched}</span>
            </button>

            <button
              onClick={() => {
                setQuickTab('KITCHEN');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                quickTab === 'KITCHEN' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-400 hover:bg-amber-950/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kitchen</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-950/80 font-mono text-[10px]">{counts.kitchen}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ACTIVE FILTERS CHIP BAR */}
      {activeFiltersCount > 0 && (
        <div
          className={`px-4 py-2 border-b flex flex-wrap items-center gap-2 text-xs shrink-0 ${
            isDark ? 'bg-[#0f1118] border-slate-200 dark:border-stone-800' : 'bg-slate-800 border-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
            <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
            Active Filters:
          </span>

          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-mono text-[11px]">
              Query: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedOutlet !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              Outlet: {selectedOutlet}
              <button onClick={() => setSelectedOutlet('all')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedSource !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              Source: {selectedSource}
              <button onClick={() => setSelectedSource('all')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              Status: {selectedStatus}
              <button onClick={() => setSelectedStatus('all')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedUser !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              User: {selectedUser}
              <button onClick={() => setSelectedUser('all')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedDate && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              Date: {selectedDate}
              <button onClick={() => setSelectedDate('')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {orderTypeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px]">
              Type: {orderTypeFilter.toUpperCase()}
              <button onClick={() => setOrderTypeFilter('all')} className="hover:text-white cursor-pointer ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(minAmount || maxAmount) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-stone-800 text-stone-200 border border-slate-300 dark:border-stone-700 text-[11px] font-mono">
              PKR {minAmount || 0} - {maxAmount || '∞'}
              <button
                onClick={() => {
                  setMinAmount('');
                  setMaxAmount('');
                }}
                className="hover:text-white cursor-pointer ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={handleResetFilters}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-bold ml-auto hover:underline cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All Filters
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA WITH SIDEBAR FILTER PANEL + VIRTUALIZED TABLE */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* DEDICATED VISUALLY DISTINCT FILTER PANEL */}
        <OrderFilterPanel
          selectedOutlet={selectedOutlet}
          setSelectedOutlet={setSelectedOutlet}
          selectedSource={selectedSource}
          setSelectedSource={setSelectedSource}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          orderTypeFilter={orderTypeFilter}
          setOrderTypeFilter={setOrderTypeFilter}
          minAmount={minAmount}
          setMinAmount={setMinAmount}
          maxAmount={maxAmount}
          setMaxAmount={setMaxAmount}
          sortBy={sortBy}
          setSortBy={setSortBy}
          availableOutlets={availableOutlets}
          availableSources={availableSources}
          availableUsers={availableUsers}
          onResetFilters={handleResetFilters}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          activeFiltersCount={activeFiltersCount}
          isOpen={isFilterPanelOpen}
          onToggle={() => setIsFilterPanelOpen(false)}
          theme={theme}
          totalFiltered={filteredOrders.length}
          totalAll={orders.length}
        />

        {/* RIGHT DATA AREA: BATCH BAR + VIRTUALIZED TABLE CONTAINER */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0b0e] overflow-hidden">
          {/* BATCH ACTION BAR (Shown when items are selected) */}
          {selectedOrderIds.length > 0 && (
            <div className="bg-[#161a24] border-b border-emerald-500/30 p-2.5 px-4 shrink-0 flex flex-wrap items-center justify-between gap-3 animate-fadeIn text-xs z-10">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 font-mono">
                  {selectedOrderIds.length} Selected
                </span>
                <span className="text-slate-700 dark:text-stone-300 font-medium">Batch Update Status:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBatchStatusUpdate('ready')}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  Mark as Ready
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate('completed')}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  Mark as Completed
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate('dispatched')}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  Mark as Dispatched
                </button>
                <button
                  onClick={handleBatchWhatsAppDispatch}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 rounded bg-[#25D366] hover:bg-[#128C7E] text-white font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Open WhatsApp chat for all selected orders"
                >
                  WhatsApp Dispatch
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate('cancelled')}
                  disabled={isBatchProcessing}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  Cancel Selected
                </button>
                <button
                  onClick={() => selectAllFiltered(filteredOrders)}
                  disabled={isBatchProcessing}
                  className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 border border-slate-300 dark:border-stone-700 font-bold transition cursor-pointer"
                >
                  Select All ({filteredOrders.length})
                </button>
                <button
                  onClick={clearSelection}
                  disabled={isBatchProcessing}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-500 dark:text-stone-400 font-bold transition cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* VIRTUALIZED ORDERS TABLE CONTAINER */}
          <div ref={tableContainerRef} className="flex-1 overflow-auto bg-[#0a0b0e] p-2 min-w-0 relative">
            <div className="min-w-[980px] w-full">
              {/* STICKY TABLE HEADER */}
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead className="sticky top-0 z-10 shadow-xs">
                  <tr className="bg-[#111319] text-slate-700 dark:text-stone-300 font-bold border-b border-slate-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectAllVisible(displayedOrders)}
                        className="text-slate-500 dark:text-stone-400 hover:text-white transition focus:outline-none flex items-center justify-center mx-auto"
                        title="Toggle Select All in View"
                      >
                        {displayedOrders.length > 0 &&
                        displayedOrders.every((o) => selectedOrderIds.includes(o.id)) ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 w-12 text-center">Sr</th>
                    <th className="py-2.5 px-3 w-16">Time</th>
                    <th className="py-2.5 px-3 w-20">Source</th>
                    <th className="py-2.5 px-3 w-40">Name / Order #</th>
                    <th className="py-2.5 px-3 w-28">Phone</th>
                    <th className="py-2.5 px-3">Address</th>
                    <th className="py-2.5 px-3 w-16 text-center">Outlet</th>
                    <th className="py-2.5 px-3 w-10 text-center">-</th>
                    <th className="py-2.5 px-3 w-32">By</th>
                    <th className="py-2.5 px-3 w-24 text-right">Total</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3 w-20 text-center">Action</th>
                  </tr>
                </thead>

                {/* VIRTUALIZED TABLE BODY */}
                <tbody
                  className="font-mono text-[12px] relative"
                  style={{
                    height: displayedOrders.length > 0 ? `${rowVirtualizer.getTotalSize()}px` : 'auto',
                    position: 'relative',
                  }}
                >
                  {displayedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-24 text-center text-slate-400 dark:text-stone-500">
                        <div className="max-w-xs mx-auto space-y-3">
                          <Search className="w-12 h-12 text-stone-600 mx-auto" />
                          <p className="text-slate-700 dark:text-stone-300 font-bold text-sm">No Orders Match Search Criteria</p>
                          <p className="text-xs text-slate-400 dark:text-stone-500 font-sans">
                            Try adjusting your filters in the panel or clearing search criteria.
                          </p>
                          <button
                            onClick={handleResetFilters}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                          >
                            Clear All Search Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const order = displayedOrders[virtualRow.index];
                      if (!order) return null;

                      const srNum =
                        viewMode === 'virtual'
                          ? virtualRow.index + 1
                          : startIndex + virtualRow.index + 1;
                      const orderTime = new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      });
                      const sourceName =
                        order.source || order.sourceChannel || (order.type === 'delivery' ? 'Call' : 'Branch');
                      const customerName = order.customer?.name || 'Walk-in Customer';
                      const customerPhone = order.customer?.phone || '03000000000';
                      const addressText =
                        order.customer?.address || order.deliveryAddress || 'Branch Dine-In / Walk-In Takeaway';
                      const outletCode = getOutletCode(order);
                      const punchedBy =
                        order.punchedBy || order.cashierName || order.serverName || 'Muhammad Kashif CC';
                      const isDelivery = order.type === 'delivery' || order.orderType === 'delivery';
                      const isSelected = selectedOrderIds.includes(order.id);

                      return (
                        <tr
                          key={order.id || virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          className={`hover:bg-white/[0.04] transition-colors border-b border-slate-200 dark:border-stone-800/40 text-stone-200 absolute top-0 left-0 w-full flex items-center ${
                            isSelected ? 'bg-emerald-500/[0.05]' : ''
                          }`}
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            height: '48px',
                          }}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 w-10 text-center shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleSelectOrder(order.id)}
                              className="text-slate-500 dark:text-stone-400 hover:text-emerald-400 transition focus:outline-none flex items-center justify-center mx-auto"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Sr */}
                          <td className="py-2.5 px-3 w-12 text-center text-slate-500 dark:text-stone-400 font-bold shrink-0">
                            {srNum}
                          </td>

                          {/* Time */}
                          <td className="py-2.5 px-3 w-16 font-bold text-stone-200 shrink-0">
                            {orderTime}
                          </td>

                          {/* Source */}
                          <td className="py-2.5 px-3 w-20 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate block text-center ${getSourceBadgeClass(
                                sourceName
                              )}`}
                            >
                              {sourceName}
                            </span>
                          </td>

                          {/* Name & Order # */}
                          <td className="py-2.5 px-3 w-40 font-sans shrink-0">
                            <button
                              onClick={() => setInspectOrder(order)}
                              className="text-emerald-400 font-bold hover:underline cursor-pointer text-left truncate max-w-[150px] block"
                              title="Click to view full order details"
                            >
                              {customerName}
                            </button>
                            <span className="text-[10px] text-slate-400 dark:text-stone-500 font-mono block">
                              #{order.orderNumber || order.id.slice(-6)}
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="py-2.5 px-3 w-28 font-mono text-slate-700 dark:text-stone-300 shrink-0">
                            {customerPhone}
                          </td>

                          {/* Address */}
                          <td
                            className="py-2.5 px-3 font-sans text-slate-700 dark:text-stone-300 truncate flex-1 min-w-[180px]"
                            title={addressText}
                          >
                            {addressText}
                          </td>

                          {/* Outlet */}
                          <td className="py-2.5 px-3 w-16 text-center shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 font-mono text-[10px] font-bold">
                              {outletCode}
                            </span>
                          </td>

                          {/* Channel Icon */}
                          <td className="py-2.5 px-3 w-10 text-center shrink-0">
                            {isDelivery ? (
                              <span title="Delivery Order">
                                <Truck className="w-4 h-4 text-blue-400 inline-block" />
                              </span>
                            ) : (
                              <span title="Takeaway / Branch Order">
                                <Store className="w-4 h-4 text-amber-400 inline-block" />
                              </span>
                            )}
                          </td>

                          {/* Punched By */}
                          <td
                            className="py-2.5 px-3 w-32 font-sans text-slate-700 dark:text-stone-300 text-xs truncate shrink-0"
                            title={punchedBy}
                          >
                            {punchedBy}
                          </td>

                          {/* Total Amount */}
                          <td className="py-2.5 px-3 w-24 text-right font-mono font-bold text-white shrink-0">
                            PKR {order.total.toLocaleString()}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 w-28 text-center shrink-0">
                            {renderStatusBadge(order)}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 w-20 text-center shrink-0">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setInspectOrder(order)}
                                className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition shadow-xs cursor-pointer inline-flex items-center justify-center"
                                title="View order ticket & timeline"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPrintQueueOrder(order)}
                                className="p-1.5 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-amber-400 hover:text-amber-300 transition cursor-pointer inline-flex items-center justify-center border border-slate-300 dark:border-stone-700"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setActiveReceiptOrder(order)}
                                className="p-1.5 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white transition cursor-pointer inline-flex items-center justify-center border border-slate-300 dark:border-stone-700"
                                title="View Thermal Slip"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER BAR: VIRTUALIZATION ENGINE TELEMETRY & EXPORT ACTIONS */}
          <div className="bg-[#111319] border-t border-slate-200 dark:border-stone-800 px-4 py-2.5 shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
            {/* Left: View Mode Toggle & Telemetry */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#090a0d] p-0.5 rounded-lg border border-slate-200 dark:border-stone-800">
                <button
                  onClick={() => setViewMode('virtual')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    viewMode === 'virtual'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-stone-400 hover:text-stone-200'
                  }`}
                  title="Virtual Infinite Scroll: renders thousands of entries with zero lag"
                >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>Virtual Scroll</span>
                </button>
                <button
                  onClick={() => setViewMode('paginated')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    viewMode === 'paginated'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-stone-400 hover:text-stone-200'
                  }`}
                  title="Paginated Mode: step through results page by page"
                >
                  <span>Paginated</span>
                </button>
              </div>

              {viewMode === 'virtual' ? (
                <span className="text-slate-500 dark:text-stone-400 text-xs hidden sm:inline">
                  ⚡ <strong>{rowVirtualizer.getVirtualItems().length}</strong> active DOM rows for{' '}
                  <strong className="text-white">{filteredOrders.length.toLocaleString()}</strong> records
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={entriesPerPage}
                    onChange={(e) => {
                      setEntriesPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-[#090a0d] border border-slate-300 dark:border-stone-700 rounded-lg px-2 py-1 text-stone-200 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value={250}>250 / page</option>
                  </select>
                  <span className="text-slate-500 dark:text-stone-400 text-xs">
                    {totalEntries === 0
                      ? '0 Entries'
                      : `${startIndex + 1}-${Math.min(startIndex + entriesPerPage, totalEntries)} of ${totalEntries}`}
                  </span>
                </div>
              )}
            </div>

            {/* Center: Pagination Buttons when in Paginated Mode */}
            {viewMode === 'paginated' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-stone-300 font-bold transition cursor-pointer border border-slate-300 dark:border-stone-700"
                >
                  &lt;
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && safeCurrentPage > 3) {
                    pageNum = safeCurrentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  if (pageNum <= 0) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        safeCurrentPage === pageNum
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-white dark:bg-stone-900 text-slate-500 dark:text-stone-400 hover:text-white border-slate-200 dark:border-stone-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-stone-300 font-bold transition cursor-pointer border border-slate-300 dark:border-stone-700"
                >
                  &gt;
                </button>
              </div>
            )}

            {/* Right: Copy & Export Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySummary}
                className="px-3 py-1.5 rounded-lg bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-emerald-700/60 shadow-xs"
                title="Copy Filtered Data Summary"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Export Filtered Orders to Excel Workbook (.xls)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-stone-700 shadow-xs"
                title="Print Orders View"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INSPECT ORDER DETAILS MODAL */}
      {inspectOrder && (
        <DeliveryOrderDetailsModal
          order={inspectOrder}
          isOpen={!!inspectOrder}
          onClose={() => setInspectOrder(null)}
          onUpdateStatus={(orderId, newStatus, reason) => {
            if (newStatus === 'cancelled') {
              const cancelReason =
                reason ||
                window.prompt(
                  `Please enter cancellation reason for Order #${inspectOrder.orderNumber || inspectOrder.id}:`,
                  'Customer change of mind'
                ) ||
                'Customer requested cancellation';
              cancelOrder(orderId, cancelReason);
              if (inspectOrder) {
                setInspectOrder({ ...inspectOrder, status: 'cancelled', cancelReason });
              }
            } else {
              updateOrderStatus(orderId, newStatus);
              if (inspectOrder) {
                setInspectOrder({ ...inspectOrder, status: newStatus });
              }
            }
          }}
          onAssignRider={(orderId, riderName, phone, vehicle) => {
            assignDeliveryDriver(orderId, riderName);
            if (inspectOrder) {
              setInspectOrder({
                ...inspectOrder,
                riderName,
                deliveryDriver: riderName,
                riderPhone: phone,
                riderVehicle: vehicle,
              });
            }
          }}
        />
      )}
    </div>
  );
};
