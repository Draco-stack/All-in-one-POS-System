import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Phone,
  Truck,
  Ban,
  Search,
  Eye,
  RotateCw,
  Store,
  ChefHat,
  ShieldCheck,
  User,
  ChevronLeft,
  ChevronRight,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Filter,
  DollarSign,
  Send,
  Check,
  MessageSquare,
  X,
  Layers,
  Activity,
  ArrowRight,
  Printer,
  Copy,
  TrendingUp,
  Radio,
  Wifi,
  Navigation,
  ExternalLink,
  ShieldAlert,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderStatus } from '../../types';
import { DeliveryOrderDetailsModal } from './DeliveryOrderDetailsModal';
import { CallCenterOrderModal } from './CallCenterOrderModal';
import { playCashRegisterSound } from '../../utils/audio';
import { LiveClockBadge } from '../common/LiveClockBadge';
import { getWhatsAppDispatchData } from '../../utils/whatsapp';
import { MasterPOSLogo } from '../common/MasterPOSLogo';

interface DeliveryMonitoringViewProps {
  onOpenPOS?: () => void;
  onOpenKitchen?: () => void;
  onOpenAdmin?: () => void;
  onOpenUserSwitch?: () => void;
}

type TabFilter = 'ALL' | 'KITCHEN' | 'DELIVERY' | 'FINISHED' | 'CANCELLED' | 'RIDERS';

export const DeliveryMonitoringView: React.FC<DeliveryMonitoringViewProps> = ({
  onOpenPOS,
  onOpenKitchen,
  onOpenAdmin,
  onOpenUserSwitch,
}) => {
  const {
    orders,
    updateOrderStatus,
    assignDeliveryDriver,
    currentUser,
    logoutUser,
    showToast,
    outlets,
    cashDrops,
    dropRiderCash,
    deliveryDrivers,
    getRiderStats,
    setActiveDeliverySlipOrder,
    theme,
    toggleTheme,
  } = useRestaurant();

  // Tab and Filters State
  const [activeTab, setActiveTab] = useState<TabFilter>('DELIVERY');
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [leftRailActive, setLeftRailActive] = useState<'phone' | 'delivery' | 'ban'>('delivery');

  // Route Clustering & Smart Batching State
  const [isClustered, setIsClustered] = useState<boolean>(false);
  const [batchRiderMap, setBatchRiderMap] = useState<Record<string, string>>({});

  // Cash Drops Reconciliation Modal
  const [activeDropRider, setActiveDropRider] = useState<string | null>(null);
  const [dropAmount, setDropAmount] = useState<string>('');
  const [dropNotes, setDropNotes] = useState<string>('');

  // Real-time Controls
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(false); // default off for clean operational reality
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  // Pagination State
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isCallCenterModalOpen, setIsCallCenterModalOpen] = useState<boolean>(false);

  // Search input ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live Elapsed Timers Map (Increment in real-time)
  const [liveElapsedMap, setLiveElapsedMap] = useState<Record<string, number>>({});

  // Keyboard Shortcuts (F2: New Order, /: Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsCallCenterModalOpen(true);
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (!isDetailsModalOpen && !isCallCenterModalOpen && !activeDropRider) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailsModalOpen, isCallCenterModalOpen, activeDropRider]);

  // Initialize elapsed minutes from orders
  useEffect(() => {
    const initialMap: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.deliveryElapsedMinutes) {
        initialMap[o.id] = o.deliveryElapsedMinutes;
      } else {
        const orderDate = new Date(o.createdAt || Date.now());
        let endDate = new Date();
        if (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled' || o.status === 'refunded') {
          const finishedTimeline = o.timeline?.find(
            (t) => t.status === 'delivered' || t.status === 'completed' || t.status === 'cancelled' || t.status === 'refunded'
          );
          endDate = finishedTimeline ? new Date(finishedTimeline.timestamp) : (o.updatedAt ? new Date(o.updatedAt) : new Date(o.createdAt || Date.now()));
        }
        const diffMins = Math.max(1, Math.floor((endDate.getTime() - orderDate.getTime()) / 60000));
        initialMap[o.id] = diffMins;
      }
    });
    setLiveElapsedMap(initialMap);
  }, [orders]);

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Live Auto-Refresh and Clock Tick
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      setLastRefreshedAt(new Date());
      
      // Increment live delivery elapsed minutes
      setLiveElapsedMap((prev) => {
        const updated = { ...prev };
        ordersRef.current.forEach((o) => {
          if (o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'refunded') {
            const orderDate = new Date(o.createdAt || Date.now());
            updated[o.id] = Math.max(1, Math.floor((Date.now() - orderDate.getTime()) / 60000));
          }
        });
        return updated;
      });

      // Simulation mode if explicitly enabled by operator
      if (isSimulatingLive && Math.random() > 0.65) {
        const activeInKitchen = ordersRef.current.filter((o) => o.status === 'in_kitchen');
        const activeOnTheWay = ordersRef.current.filter((o) => o.status === 'dispatched');

        if (activeInKitchen.length > 0 && Math.random() > 0.5) {
          const target = activeInKitchen[Math.floor(Math.random() * activeInKitchen.length)];
          updateOrderStatus(target.id, 'dispatched');
          if (soundEnabled) playCashRegisterSound();
          showToast(`🛵 Order #${target.orderNumber || target.id} dispatched! Out with Rider.`);
        } else if (activeOnTheWay.length > 0) {
          const target = activeOnTheWay[Math.floor(Math.random() * activeOnTheWay.length)];
          updateOrderStatus(target.id, 'delivered');
          if (soundEnabled) playCashRegisterSound();
          showToast(`✓ Order #${target.orderNumber || target.id} marked as delivered!`);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, isSimulatingLive, soundEnabled, updateOrderStatus, showToast]);

  // Manual Refresh Handler
  const handleManualRefresh = () => {
    setIsSpinning(true);
    setLastRefreshedAt(new Date());
    setTimeout(() => {
      setIsSpinning(false);
      showToast('🔄 Realtime delivery records synced');
    }, 500);
  };

  // Helper to determine the routing sector of a given address
  const getAddressSector = (address?: string) => {
    if (!address) return 'Sargodha Central';
    const addr = address.toLowerCase();
    if (addr.includes('satellite') || addr.includes('satelite')) return 'Satellite Town';
    if (addr.includes('civil') || addr.includes('lines')) return 'Civil Lines';
    if (addr.includes('jinnah') || addr.includes('colony')) return 'Jinnah Colony';
    if (addr.includes('eden') || addr.includes('garden')) return 'Eden Garden';
    if (addr.includes('gulberg')) return 'Gulberg Sector';
    if (addr.includes('university') || addr.includes('college')) return 'University Area';
    if (addr.includes('gojra')) return 'Gojra Suburb';
    if (addr.includes('gujrat')) return 'Gujrat Bypass';
    return 'Sargodha Central';
  };

  // Helper to calculate a rider's actual cash on hand dynamically
  const getRiderCashOnHand = (riderName: string) => {
    const stats = getRiderStats(riderName);
    return stats ? stats.codCashOnHand : 0;
  };

  // --- Live KPI / SLA Calculations ---
  const {
    averageDeliveryTime,
    slaBreachRate,
    breachedOrdersCount,
    onTripRidersCount,
    idleRidersCount,
    totalCODPending,
    activePipelineCount,
    kitchenOrdersCount,
    dispatchedOrdersCount,
    deliveredOrdersCount,
    cancelledOrdersCount,
  } = useMemo(() => {
    const activeAndDelivered = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'refunded'
    );
    const delivered = orders.filter(
      (o) => o.status === 'delivered' || o.status === 'completed'
    );
    const inKitchen = orders.filter(
      (o) => o.status === 'in_kitchen' || o.status === 'pending' || o.status === 'ready' || o.status === 'open'
    );
    const dispatched = orders.filter((o) => o.status === 'dispatched');
    const cancelled = orders.filter((o) => o.status === 'cancelled' || o.status === 'refunded');

    // 1. Average Delivery Time
    const avgTime = delivered.length > 0
      ? Math.round(
          delivered.reduce(
            (sum, o) => sum + (liveElapsedMap[o.id] || o.deliveryElapsedMinutes || 25),
            0
          ) / delivered.length
        )
      : (orders.length > 0 ? 24 : 0);

    // 2. SLA Breach Rate
    const breached = activeAndDelivered.filter((o) => {
      const elapsed = liveElapsedMap[o.id] || o.deliveryElapsedMinutes || 0;
      return elapsed > 45;
    }).length;
    const breachRate = activeAndDelivered.length > 0
      ? ((breached / activeAndDelivered.length) * 100).toFixed(1)
      : '0.0';

    // 3. Riders Status Grid
    const activeDispatchedRiders = new Set(
      orders
        .filter((o) => o.status === 'dispatched')
        .map((o) => o.riderName || o.deliveryDriver)
        .filter(Boolean)
    );
    const onTrip = activeDispatchedRiders.size;
    const idle = Math.max(0, deliveryDrivers.length - onTrip);

    // 4. Total COD Cash pending
    const totalCOD = deliveryDrivers.reduce((sum, d) => sum + getRiderCashOnHand(d), 0);

    return {
      averageDeliveryTime: avgTime,
      slaBreachRate: breachRate,
      breachedOrdersCount: breached,
      onTripRidersCount: onTrip,
      idleRidersCount: idle,
      totalCODPending: totalCOD,
      activePipelineCount: inKitchen.length + dispatched.length,
      kitchenOrdersCount: inKitchen.length,
      dispatchedOrdersCount: dispatched.length,
      deliveredOrdersCount: delivered.length,
      cancelledOrdersCount: cancelled.length,
    };
  }, [orders, liveElapsedMap, deliveryDrivers, cashDrops]);

  // Filter Orders based on activeTab, search query, branch, and leftRail
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Left rail quick ban filter
      if (leftRailActive === 'ban') {
        if (order.status !== 'cancelled' && order.status !== 'refunded') return false;
      }

      // Branch filter
      if (selectedBranch !== 'All') {
        const orderBranch = order.branchName || order.outlet || '';
        if (!orderBranch.toLowerCase().includes(selectedBranch.toLowerCase())) {
          return false;
        }
      }

      // Status Tab filter
      const st = (order.status || 'pending').toLowerCase();
      if (activeTab === 'KITCHEN') {
        if (st !== 'in_kitchen' && st !== 'pending' && st !== 'open' && st !== 'punched') return false;
      } else if (activeTab === 'DELIVERY') {
        if (st === 'cancelled' || st === 'refunded' || st === 'delivered' || st === 'completed') return false;
      } else if (activeTab === 'FINISHED') {
        if (st !== 'delivered' && st !== 'completed') return false;
      } else if (activeTab === 'CANCELLED') {
        if (st !== 'cancelled' && st !== 'refunded') return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (order.orderNumber || order.id).toLowerCase().includes(q);
        const nameMatch = (order.customer?.name || '').toLowerCase().includes(q);
        const phoneMatch = (order.customer?.phone || '').includes(q);
        const branchMatch = (order.branchName || order.outlet || '').toLowerCase().includes(q);
        const puncherMatch = (order.punchedBy || order.cashierName || '').toLowerCase().includes(q);
        const riderMatch = (order.riderName || order.deliveryDriver || '').toLowerCase().includes(q);

        if (!numMatch && !nameMatch && !phoneMatch && !branchMatch && !puncherMatch && !riderMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, selectedBranch, searchQuery, leftRailActive]);

  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, selectedBranch, searchQuery, leftRailActive]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, visibleCount);
  }, [filteredOrders, visibleCount]);

  const clusteredSectors = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    displayedOrders.forEach((order) => {
      const sector = getAddressSector(order.deliveryAddress || order.customer?.address);
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(order);
    });
    return groups;
  }, [displayedOrders]);

  const startRecordNum = filteredOrders.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecordNum = Math.min(currentPage * rowsPerPage, filteredOrders.length);

  // Helper for SLA Badge
  const getDeliveryTimeBadge = (order: Order) => {
    const elapsed = liveElapsedMap[order.id] ?? order.deliveryElapsedMinutes ?? 35;
    const isFinished = order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled' || order.status === 'refunded';
    
    if (isFinished) {
      return (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-stone-400">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-stone-500" />
          <span>{elapsed}m</span>
        </div>
      );
    }

    if (elapsed > 45) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>{elapsed}m</span>
          <span className="text-[10px] uppercase tracking-wider font-sans font-semibold">Delayed</span>
        </div>
      );
    }

    if (elapsed >= 30) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shadow-xs">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{elapsed}m</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold shadow-xs">
        <Clock className="w-3.5 h-3.5 text-emerald-400" />
        <span>{elapsed}m</span>
        <span className="text-[10px] uppercase tracking-wider font-sans font-semibold">On Time</span>
      </div>
    );
  };

  // Helper for Order Status Badge
  const getOrderStatusBadge = (order: Order) => {
    const st = (order.status || 'pending').toLowerCase();
    
    if (st === 'delivered' || st === 'completed') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold tracking-wide uppercase">
          <CheckCircle2 className="w-3 h-3" />
          Delivered
        </div>
      );
    }
    if (st === 'dispatched') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold tracking-wide uppercase shadow-sm">
          <Truck className="w-3 h-3 text-amber-400 animate-bounce" />
          On The Way
        </div>
      );
    }
    if (st === 'in_kitchen' || st === 'pending' || st === 'open' || st === 'punched') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-bold tracking-wide uppercase">
          <ChefHat className="w-3 h-3 text-blue-400" />
          In Kitchen
        </div>
      );
    }
    if (st === 'ready') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 text-xs font-bold tracking-wide uppercase">
          <Sparkles className="w-3 h-3 text-teal-400" />
          Ready
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-bold tracking-wide uppercase">
        <Ban className="w-3 h-3 text-rose-400" />
        {st}
      </div>
    );
  };

  // Format Order Time
  const formatOrderTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} • ${hours}:${mins}`;
    } catch {
      return '--:--';
    }
  };

  // Status Change Handler
  const handleInlineStatusChange = (orderId: string, newStatus: OrderStatus) => {
    updateOrderStatus(orderId, newStatus);
    if (soundEnabled) playCashRegisterSound();
    showToast(`✓ Order status advanced to ${newStatus.toUpperCase()}`);
  };

  // Batch dispatch handler for clustered/grouped view
  const handleBatchDispatch = (sectorName: string) => {
    const rider = batchRiderMap[sectorName];
    if (!rider) {
      showToast('⚠️ Please select a rider to batch assign.');
      return;
    }

    const sectorOrders = filteredOrders.filter(
      (o) => getAddressSector(o.deliveryAddress || o.customer?.address) === sectorName
    );

    const pendingSectorOrders = sectorOrders.filter(
      (o) => o.status === 'in_kitchen' || o.status === 'pending' || o.status === 'ready' || o.status === 'open'
    );

    if (pendingSectorOrders.length === 0) {
      showToast(`⚠️ No pending orders in ${sectorName} to dispatch.`);
      return;
    }

    pendingSectorOrders.forEach((o) => {
      assignDeliveryDriver(o.id, rider);
      updateOrderStatus(o.id, 'dispatched');
    });

    if (soundEnabled) playCashRegisterSound();
    showToast(`🚀 Batch Dispatched ${pendingSectorOrders.length} orders in ${sectorName} to ${rider}!`);
    setBatchRiderMap((prev) => ({ ...prev, [sectorName]: '' }));
  };

  // WhatsApp dispatch message link with accurate status and customer phone handling
  const getWhatsAppLink = (order: Order) => {
    const waData = getWhatsAppDispatchData(order);
    return waData.url || '#';
  };

  return (
    <div className={`w-full h-full grid grid-cols-[68px_1fr] md:grid-cols-[80px_1fr] font-sans select-none overflow-hidden antialiased transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0c0c0e] text-[#f4f4f6]' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {/* Refined Sidebar Navigation Rail */}
      <aside className={`border-r flex flex-col items-center py-5 gap-6 z-20 shadow-xl transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#111216] border-slate-300 dark:border-white/10' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Brand Emblem */}
        <div 
          onClick={onOpenPOS}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white cursor-pointer shadow-lg shadow-blue-500/20 hover:scale-105 transition-all border border-blue-400/30 group p-2"
          title="Floor POS Terminal"
        >
          <MasterPOSLogo className="w-6 h-6 text-white" size={22} />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" />
        </div>

        <div className={`w-8 h-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Navigation Items */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          {/* Floor POS */}
          <button 
            onClick={onOpenPOS}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group ${
              theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`} 
            title="Floor POS Workstation"
          >
            <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Floor POS</span>
          </button>

          {/* Call Center Order Punch */}
          <button 
            onClick={() => {
              setLeftRailActive('phone');
              setIsCallCenterModalOpen(true);
            }}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
              leftRailActive === 'phone' 
                ? 'bg-blue-600/20 text-blue-500 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Call Center Order Punch (F2)"
          >
            <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Call Center</span>
          </button>

          {/* Delivery Dispatch Console */}
          <button 
            onClick={() => {
              setLeftRailActive('delivery');
              setActiveTab('DELIVERY');
            }}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
              leftRailActive === 'delivery' 
                ? 'bg-blue-600/20 text-blue-500 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Live Delivery Monitoring"
          >
            <Truck className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Dispatch</span>
            {activePipelineCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-mono text-[9px] font-black animate-pulse shadow-sm">
                {activePipelineCount}
              </span>
            )}
          </button>

          {/* Kitchen Display Screen (KDS) */}
          <button 
            onClick={onOpenKitchen}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
              theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-amber-300 hover:bg-white/5' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
            }`} 
            title="Kitchen Display Screen (KDS)"
          >
            <ChefHat className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Kitchen</span>
            {kitchenOrdersCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 font-mono text-[9px] font-black shadow-sm">
                {kitchenOrdersCount}
              </span>
            )}
          </button>

          {/* Voided / Cancelled Orders */}
          <button 
            onClick={() => {
              setLeftRailActive('ban');
              setActiveTab('CANCELLED');
              showToast('Viewing Cancelled / Voided Orders');
            }}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
              leftRailActive === 'ban' 
                ? 'bg-rose-600/20 text-rose-500 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]' 
                : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-rose-400 hover:bg-white/5' : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
            }`}
            title="Voided & Cancelled Deliveries"
          >
            <Ban className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Voided</span>
            {cancelledOrdersCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-400 font-mono text-[9px] font-bold">
                {cancelledOrdersCount}
              </span>
            )}
          </button>
        </div>

        {/* Bottom Utilities */}
        <div className="mt-auto flex flex-col items-center gap-3 w-full px-2">
          {/* Sound alert toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              showToast(soundEnabled ? '🔇 Dispatch sound alerts muted' : '🔊 Dispatch sound alerts enabled');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              soundEnabled 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                : theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-400 dark:text-stone-500 border-slate-200 dark:border-white/5 hover:text-stone-300' : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-700'
            }`}
            title={soundEnabled ? 'Audio alerts active (Click to mute)' : 'Audio alerts muted (Click to enable)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Admin Reports */}
          <button 
            onClick={onOpenAdmin}
            className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group ${
              theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-amber-300 hover:bg-white/5' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
            }`} 
            title="Executive Admin & Financial Reports"
          >
            <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wide">Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Command Center Surface */}
      <main className={`flex flex-col h-full overflow-hidden relative transition-colors duration-200 ${
        theme === 'dark' ? 'bg-gradient-to-br from-[#121318] via-[#0e0f13] to-[#090a0d]' : 'bg-slate-50'
      }`}>
        
        {/* Executive Header Bar */}
        <header className={`px-4 sm:px-6 lg:px-8 py-3.5 border-b flex justify-between items-center shrink-0 backdrop-blur-md z-30 transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#121318]/90 border-slate-300 dark:border-white/10 text-white' : 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
        }`}>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-stone-950 shadow-sm border border-emerald-300/40 shrink-0">
              <MasterPOSLogo className="w-5 h-5 text-stone-950" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`font-extrabold text-base sm:text-lg tracking-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Master POS
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Live Dispatch Command
                </span>
                <span className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced
                </span>
              </div>
              <p className={`text-[11px] mt-0.5 flex items-center gap-2 font-medium ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                <Store className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-400'}`} />
                {selectedBranch === 'All' ? 'All Operating Branches' : `${selectedBranch} Branch`}
                <span className={theme === 'dark' ? 'text-stone-600' : 'text-slate-300'}>•</span>
                <LiveClockBadge />
              </p>
            </div>
          </div>

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-3">
            {/* Auto Refresh pill */}
            <button
              onClick={() => {
                setIsAutoRefresh(!isAutoRefresh);
                showToast(isAutoRefresh ? 'Auto-refresh paused' : 'Auto-refresh resumed');
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isAutoRefresh
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                  : theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-500 dark:text-stone-400 border-slate-200 dark:border-white/5 hover:text-stone-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
              title="Toggle automatic 10-second polling"
            >
              <span className={`w-2 h-2 rounded-full ${isAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
              Auto Sync {isAutoRefresh ? 'ON' : 'PAUSED'}
            </button>

            {/* Theme Toggle Button (Button 2) */}
            <button
              id="theme-toggle-btn"
              onClick={() => {
                toggleTheme();
                showToast(theme === 'dark' ? '☀️ Switched to Light Theme' : '🌙 Switched to Dark Theme');
              }}
              className={`p-2 rounded-xl border transition-all duration-300 cursor-pointer active:scale-90 flex items-center justify-center group shadow-sm relative overflow-hidden ${
                theme === 'dark'
                  ? 'bg-slate-50 dark:bg-stone-800/90 hover:bg-stone-700 text-amber-400 border-slate-300 dark:border-white/10 hover:border-amber-400/50 hover:shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-300/80 hover:border-amber-400 hover:shadow-[0_0_16px_rgba(245,158,11,0.25)]'
              }`}
              title={theme === 'dark' ? 'Switch to Light Theme (Current: Dark)' : 'Switch to Dark Theme (Current: Light)'}
              aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 group-hover:-rotate-12 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
              )}
            </button>

            {/* Manual Sync */}
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-xl transition cursor-pointer active:scale-95 border ${
                theme === 'dark' 
                  ? 'bg-slate-50 dark:bg-stone-800/80 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white border-slate-300 dark:border-white/10' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200 shadow-xs'
              }`}
              title="Sync latest live orders"
            >
              <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            <div className={`w-[1px] h-6 mx-1 hidden sm:block ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Sign Out Button */}
            <button
              onClick={() => {
                logoutUser();
                showToast(`✓ Signed out of account (${currentUser?.name || 'Operator'})`);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer group shadow-sm ${
                theme === 'dark' 
                  ? 'bg-white dark:bg-stone-900/80 hover:bg-red-950/60 hover:border-red-500/40 border-slate-300 dark:border-white/10' 
                  : 'bg-slate-100 hover:bg-red-50 hover:border-red-300 border-slate-200'
              }`}
              title={`Sign Out (${currentUser?.name || 'Operator'})`}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <div className={`text-xs font-bold transition-colors leading-tight ${theme === 'dark' ? 'text-white group-hover:text-red-300' : 'text-slate-800 group-hover:text-red-600'}`}>
                  {currentUser?.name || 'Operator'}
                </div>
                <div className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                  {currentUser?.role || 'Dispatcher'}
                </div>
              </div>
              <LogOut className="w-4 h-4 text-red-400 ml-1 shrink-0" />
            </button>
          </div>
        </header>

        {/* Executive KPI Metric Strip (High Density & Ergonomic Hierarchy) */}
        <section className={`grid grid-cols-2 lg:grid-cols-4 border-b shrink-0 transition-colors duration-200 ${
          theme === 'dark' 
            ? 'border-slate-300 dark:border-white/10 bg-[#14161d]/60 divide-x divide-white/10' 
            : 'border-slate-200 bg-white divide-x divide-slate-200 shadow-xs'
        }`}>
          {/* Metric 1: SLA Delivery Time */}
          <div className="p-5 flex items-center justify-between">
            <div>
              <div className={`font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Avg SLA Delivery
              </div>
              <div className={`text-2xl lg:text-3xl font-black mt-1 tracking-tight flex items-baseline gap-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {averageDeliveryTime > 0 ? `${averageDeliveryTime}m` : '--'}
                <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>avg/trip</span>
              </div>
              <div className="text-[11px] text-emerald-500 font-semibold mt-1">
                Target Benchmark: &lt; 30 mins
              </div>
            </div>
          </div>

          {/* Metric 2: SLA Breach Rate */}
          <div className="p-5 flex items-center justify-between">
            <div>
              <div className={`font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                SLA Breach (&gt;45m)
              </div>
              <div className={`text-2xl lg:text-3xl font-black mt-1 tracking-tight flex items-baseline gap-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <span className={Number(slaBreachRate) > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                  {slaBreachRate}%
                </span>
              </div>
              <div className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                {breachedOrdersCount} orders currently at SLA risk
              </div>
            </div>
          </div>

          {/* Metric 3: Fleet Status (Trip / Idle) */}
          <div 
            onClick={() => {
              setActiveTab('RIDERS');
              setLeftRailActive('delivery');
              showToast('Opened Delivery Fleet Overview');
            }}
            className={`p-5 flex items-center justify-between cursor-pointer transition group ${
              theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
            }`}
          >
            <div>
              <div className={`font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                Fleet (On Trip / Idle)
              </div>
              <div className={`text-2xl lg:text-3xl font-black mt-1 tracking-tight flex items-baseline gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <span className="text-amber-500">{onTripRidersCount}</span>
                <span className={theme === 'dark' ? 'text-stone-600' : 'text-slate-300'}>/</span>
                <span className="text-emerald-500">{idleRidersCount}</span>
                <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>riders</span>
              </div>
              <div className="text-[11px] text-blue-500 group-hover:underline font-semibold mt-1 flex items-center gap-1">
                Manage Fleet &amp; Riders →
              </div>
            </div>
          </div>

          {/* Metric 4: COD Pending Cash */}
          <div 
            onClick={() => {
              setActiveTab('RIDERS');
              setLeftRailActive('delivery');
              showToast('Opened Rider Cash Reconciliation ledger');
            }}
            className={`p-5 flex items-center justify-between cursor-pointer transition group ${
              theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
            }`}
          >
            <div>
              <div className={`font-mono text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                COD Cash Outstanding
              </div>
              <div className="text-2xl lg:text-3xl font-black mt-1 text-emerald-500 tracking-tight font-mono">
                PKR {totalCODPending.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-500/80 group-hover:underline font-semibold mt-1 flex items-center gap-1">
                Drop &amp; Reconcile Cash →
              </div>
            </div>
          </div>
        </section>

        {/* Filter Toolbar & Command Controls */}
        <div className={`px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 backdrop-blur-md shrink-0 border-b z-20 transition-colors duration-200 ${
          theme === 'dark' 
            ? 'bg-[#14161d]/80 border-slate-300 dark:border-white/10' 
            : 'bg-white/90 border-slate-200 shadow-xs'
        }`}>
          
          {/* Status Tab Pills with Dynamic Badges and Horizontal Scroll Safeguard */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x min-w-0 py-0.5 max-w-full">
            {[
              { id: 'ALL', label: 'All Orders', count: orders.length },
              { id: 'KITCHEN', label: 'In Kitchen', count: kitchenOrdersCount, color: 'text-blue-500' },
              { id: 'DELIVERY', label: 'On The Way', count: dispatchedOrdersCount, color: 'text-amber-500' },
              { id: 'FINISHED', label: 'Delivered', count: deliveredOrdersCount, color: 'text-emerald-500' },
              { id: 'CANCELLED', label: 'Cancelled', count: cancelledOrdersCount, color: 'text-rose-500' },
              { id: 'RIDERS', label: 'Fleet & Cash', count: deliveryDrivers.length, color: 'text-purple-500' },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabFilter);
                    if (tab.id === 'CANCELLED') setLeftRailActive('ban');
                    else setLeftRailActive('delivery');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border shrink-0 whitespace-nowrap active:scale-95 ${
                    isSelected
                      ? theme === 'dark' ? 'bg-white text-stone-950 border-white shadow-md' : 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : theme === 'dark' ? 'bg-[#181a22] text-slate-500 dark:text-stone-400 border-slate-200 dark:border-white/5 hover:text-white hover:border-white/20' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                    isSelected 
                      ? theme === 'dark' ? 'bg-white dark:bg-stone-900 text-white' : 'bg-blue-800 text-white' 
                      : theme === 'dark' ? 'bg-white/10 text-slate-700 dark:text-stone-300' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}

            <div className={`hidden lg:block w-[1px] h-6 mx-1 shrink-0 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Route Clustering Toggle */}
            {activeTab !== 'RIDERS' && (
              <button
                onClick={() => {
                  setIsClustered(!isClustered);
                  showToast(isClustered ? 'Switched to Standard Orders Table' : 'Switched to Sector / Route Clustered Batching View');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shrink-0 whitespace-nowrap active:scale-95 ${
                  isClustered 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' 
                    : theme === 'dark' ? 'bg-[#181a22] text-slate-500 dark:text-stone-400 border-slate-200 dark:border-white/5 hover:text-stone-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Group active deliveries by geographic neighborhood for batch dispatch"
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Group by Sector</span>
              </button>
            )}

            {/* Branch Selector */}
            <div className="relative shrink-0">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className={`border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-7 shadow-xs ${
                  theme === 'dark' ? 'bg-[#181a22] text-slate-700 dark:text-stone-300 border-slate-300 dark:border-white/10' : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <option value="All">All Outlets</option>
                <option value="Sargodha">Sargodha Branch</option>
                <option value="Jinnah Colony">Jinnah Colony</option>
                <option value="Eden Garden">Eden Garden</option>
                <option value="Gujrat">Gujrat Branch</option>
                <option value="Gojra">Gojra Branch</option>
                <option value="Gulberg">Gulberg Branch</option>
              </select>
              <Store className={`w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`} />
            </div>
          </div>

          {/* Search and New Order Action */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-60 md:w-64">
              <Search className={`w-4 h-4 absolute left-3 top-2.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-400'}`} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search order, phone, rider (/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-xl pl-9 pr-8 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition font-medium ${
                  theme === 'dark' 
                    ? 'bg-[#181a22] border-slate-300 dark:border-white/10 text-white placeholder:text-slate-400 dark:text-stone-500 shadow-inner' 
                    : 'bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-xs'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-2 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Primary Action Button: New Delivery Order */}
            <button
              onClick={() => setIsCallCenterModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs border border-blue-400/30 cursor-pointer flex items-center gap-1.5 transition shadow-lg shadow-blue-600/30 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Delivery</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-blue-700/50 rounded border border-slate-300 dark:border-white/20">F2</kbd>
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-5 custom-scrollbar">
          
          {/* TAB 1: FLEET & RIDERS RECONCILIATION */}
          {activeTab === 'RIDERS' ? (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <Truck className="w-5 h-5 text-amber-400" />
                      Active Delivery Fleet &amp; COD Cash Reconciliations
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                      Monitor live rider assignments, in-flight trips, and audit collected cash on hand.
                    </p>
                  </div>
                </div>

                {/* Rider Fleet Cards Grid */}
                <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence>
                  {deliveryDrivers.map((driver, idx) => {
                    const stats = getRiderStats(driver);
                    const cash = getRiderCashOnHand(driver);
                    const activeTrips = orders.filter(
                      (o) =>
                        (o.riderName === driver || o.deliveryDriver === driver) &&
                        o.status === 'dispatched'
                    );
                    const isDelivering = activeTrips.length > 0;

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                        key={driver}
                        className={`border rounded-2xl p-5 space-y-4 shadow-lg transition group ${
                          theme === 'dark' 
                            ? 'bg-[#151720] border-slate-300 dark:border-white/10 hover:border-white/20' 
                            : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-700 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                              {driver.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <h4 className={`text-sm font-black transition-colors ${
                                theme === 'dark' ? 'text-white group-hover:text-amber-300' : 'text-slate-900 group-hover:text-amber-600'
                              }`}>
                                {driver}
                              </h4>
                              <span className={`text-[11px] font-medium block ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                                Master POS Delivery Fleet
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isDelivering
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            }`}
                          >
                            {isDelivering ? `On Trip (${activeTrips.length})` : 'Idle / Available'}
                          </span>
                        </div>

                        {/* Trips stats */}
                        <div className={`grid grid-cols-3 gap-2 p-3 rounded-xl text-xs border ${
                          theme === 'dark' ? 'bg-[#0d0e12] border-slate-200 dark:border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div>
                            <span className={`text-[10px] font-medium block mb-0.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>Active</span>
                            <span className="font-mono font-bold text-sm text-amber-400">{activeTrips.length}</span>
                          </div>
                          <div>
                            <span className={`text-[10px] font-medium block mb-0.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>Delivered</span>
                            <span className="font-mono font-bold text-sm text-emerald-400">{stats?.delivered || 0}</span>
                          </div>
                          <div>
                            <span className={`text-[10px] font-medium block mb-0.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>Cancelled</span>
                            <span className="font-mono font-bold text-sm text-red-400">{stats?.cancelled || 0}</span>
                          </div>
                        </div>

                        {/* Cash & Drop Button */}
                        <div className={`flex items-center justify-between border-t pt-3.5 ${theme === 'dark' ? 'border-slate-300 dark:border-white/10' : 'border-slate-200'}`}>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-[10px] uppercase tracking-wider font-bold block ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                                COD Wallet Balance
                              </span>
                              {(stats?.cancelledRevenue || 0) > 0 && (
                                <span className="px-1.5 py-0.2 bg-red-950/80 text-red-400 border border-red-800/40 rounded text-[9px] font-mono font-bold" title="Deducted for cancelled orders">
                                  -PKR {(stats?.cancelledRevenue || 0).toLocaleString()} Can
                                </span>
                              )}
                            </div>
                            <span className="text-lg font-black text-emerald-500 font-mono">
                              PKR {cash.toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDropRider(driver);
                              setDropAmount(cash > 0 ? cash.toString() : '');
                            }}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Drop Cash
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Cash Drops Audit Log Table */}
              <div className={`border rounded-2xl p-6 space-y-4 shadow-xl ${
                theme === 'dark' ? 'bg-[#151720] border-slate-300 dark:border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`flex items-center justify-between border-b pb-4 ${theme === 'dark' ? 'border-slate-300 dark:border-white/10' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Verified Rider Cash Drops Audit Ledger
                    </h3>
                  </div>
                  <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                    Showing latest processed drops
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                        theme === 'dark' ? 'border-slate-300 dark:border-white/10 text-slate-500 dark:text-stone-400' : 'border-slate-200 text-slate-500'
                      }`}>
                        <th className="py-3 px-4">Time &amp; Date</th>
                        <th className="py-3 px-4">Fleet Rider</th>
                        <th className="py-3 px-4 text-right">Amount Dropped</th>
                        <th className="py-3 px-4">Authorized Manager</th>
                        <th className="py-3 px-4">Audit Memo / Notes</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-medium ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
                      {(cashDrops || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className={`py-12 text-center text-xs ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                            No cash drops recorded during current shift.
                          </td>
                        </tr>
                      ) : (
                        (cashDrops || []).map((drop) => (
                          <tr key={drop.id} className={`transition ${
                            theme === 'dark' ? 'hover:bg-white/[0.02] text-stone-200' : 'hover:bg-slate-50 text-slate-800'
                          }`}>
                            <td className={`py-3.5 px-4 font-mono ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                              {new Date(drop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className={`py-3.5 px-4 font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{drop.riderName}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-emerald-500 font-mono">
                              PKR {drop.amount.toLocaleString()}
                            </td>
                            <td className={`py-3.5 px-4 font-mono ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>{drop.receivedBy || 'Robert Vance'}</td>
                            <td className={`py-3.5 px-4 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>{drop.notes || 'End of shift reconciliation'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : isClustered ? (
            /* TAB 2: ROUTE CLUSTERED & SMART BATCHING VIEW */
            <div className="space-y-6">
              <div className={`flex items-center justify-between border rounded-2xl p-4 text-xs ${
                theme === 'dark' ? 'bg-blue-950/30 border-blue-500/20' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Geographical Sector Clustering Active</h4>
                    <p className={theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}>
                      Deliveries are grouped by neighborhood for high-efficiency route batching and multi-order rider dispatch.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsClustered(false)}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                    theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-white/10' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                  }`}
                >
                  Switch to Standard View
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Object.entries(clusteredSectors).map(([sectorName, sectorOrders]) => {
                  const pendingInSector = sectorOrders.filter(
                    (o) => o.status === 'in_kitchen' || o.status === 'pending' || o.status === 'ready' || o.status === 'open'
                  );
                  const selectedRider = batchRiderMap[sectorName] || '';

                  return (
                    <div
                      key={sectorName}
                      className={`border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition ${
                        theme === 'dark' ? 'bg-[#151720] border-slate-300 dark:border-white/10 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className={`flex items-center justify-between border-b pb-3 ${theme === 'dark' ? 'border-slate-300 dark:border-white/10' : 'border-slate-200'}`}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-rose-500" />
                            <h3 className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{sectorName}</h3>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-500 text-xs font-mono font-bold">
                            {sectorOrders.length} {sectorOrders.length === 1 ? 'order' : 'orders'}
                          </span>
                        </div>

                        {/* Order list preview */}
                        <div className={`divide-y my-3 max-h-56 overflow-y-auto custom-scrollbar ${
                          theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'
                        }`}>
                          {sectorOrders.map((order) => (
                            <div key={order.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <div className={`font-mono font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  #{order.orderNumber || order.id}
                                  {getOrderStatusBadge(order)}
                                </div>
                                <div className={`text-[11px] truncate max-w-[200px] mt-0.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                                  {order.customer?.name} • {order.customer?.address}
                                </div>
                              </div>
                              <div className={`text-right font-mono font-bold ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                                PKR {(order.total || 0).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Batch Dispatch Control */}
                      {pendingInSector.length > 0 && (
                        <div className={`p-3 rounded-xl border space-y-2 ${
                          theme === 'dark' ? 'bg-[#0e0f14] border-slate-200 dark:border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <label className={`text-[11px] font-bold uppercase tracking-wider block ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                            Batch Assign Rider
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={selectedRider}
                              onChange={(e) =>
                                setBatchRiderMap((prev) => ({ ...prev, [sectorName]: e.target.value }))
                              }
                              className={`flex-1 border rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer ${
                                theme === 'dark' ? 'bg-[#181a22] text-white border-slate-300 dark:border-white/10' : 'bg-white text-slate-900 border-slate-300'
                              }`}
                            >
                              <option value="">Select Rider...</option>
                              {deliveryDrivers.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleBatchDispatch(sectorName)}
                              disabled={!selectedRider}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <Send className="w-3 h-3" />
                              Dispatch
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAB 3: STANDARD PRODUCTION ORDERS TABLE */
            <div className={`overflow-hidden border rounded-2xl shadow-2xl transition-colors duration-200 ${
              theme === 'dark' ? 'border-slate-300 dark:border-white/10 bg-[#14161f]' : 'border-slate-200 bg-white shadow-sm'
            }`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 ${
                    theme === 'dark' ? 'border-slate-300 dark:border-white/10 bg-[#111218] text-slate-500 dark:text-stone-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}>
                    <th className="py-3.5 px-4">Order ID &amp; Source</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">SLA / Elapsed</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Address &amp; Sector</th>
                    <th className="py-3.5 px-4">Assigned Fleet Rider</th>
                    <th className="py-3.5 px-4">WhatsApp Dispatch</th>
                    <th className="py-3.5 px-4 text-right">Total (COD)</th>
                    <th className="py-3.5 px-4 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs font-medium ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
                  {displayedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`py-20 text-center ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                        <Truck className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-stone-600' : 'text-slate-300'}`} />
                        <h4 className={`text-base font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Orders Match Current View</h4>
                        <p className={`text-xs max-w-sm mx-auto ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                          There are no active orders matching your filter criteria. Punch a new order or adjust branch/status filters.
                        </p>
                        <button
                          onClick={() => setIsCallCenterModalOpen(true)}
                          className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                        >
                          + Punch New Delivery Order
                        </button>
                      </td>
                    </tr>
                  ) : (
                    displayedOrders.map((order) => {
                      const isUnassigned = !order.riderName && !order.deliveryDriver;
                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors group ${
                            theme === 'dark' ? 'hover:bg-white/[0.02] text-stone-200' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          {/* Order ID & Source */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => {
                                setSelectedOrderForView(order);
                                setIsDetailsModalOpen(true);
                              }}
                              className={`font-mono font-bold text-xs tracking-tight cursor-pointer text-left block transition-colors ${
                                theme === 'dark' ? 'text-white hover:text-blue-400' : 'text-slate-900 hover:text-blue-600'
                              }`}
                              title="Click to view complete order details"
                            >
                              #{order.orderNumber || order.id}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-blue-500 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                                {order.source || 'Call Center'}
                              </span>
                              <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                                {order.branchName || order.outlet || 'Main'}
                              </span>
                            </div>
                          </td>

                          {/* Status with Quick Advance Trigger */}
                          <td 
                            className="py-3.5 px-4 cursor-pointer"
                            onClick={() => {
                              if (order.status === 'in_kitchen' || order.status === 'pending') {
                                handleInlineStatusChange(order.id, 'dispatched');
                              } else if (order.status === 'dispatched') {
                                handleInlineStatusChange(order.id, 'delivered');
                              }
                            }}
                            title="Click to advance order to next stage"
                          >
                            <div className="group-hover:scale-105 transition-transform inline-block">
                              {getOrderStatusBadge(order)}
                            </div>
                          </td>

                          {/* SLA / Elapsed Time */}
                          <td className="py-3.5 px-4">
                            {getDeliveryTimeBadge(order)}
                          </td>

                          {/* Timestamp */}
                          <td className={`py-3.5 px-4 font-mono text-xs ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                            {formatOrderTime(order.createdAt)}
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{order.customer?.name || 'Walk-in'}</div>
                            <div className={`font-mono text-[11px] mt-0.5 ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                              {order.customer?.phone || 'N/A'}
                            </div>
                          </td>

                          {/* Address & Sector */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 mb-0.5">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate">{getAddressSector(order.deliveryAddress || order.customer?.address)}</span>
                            </div>
                            <div 
                              className={`text-xs truncate ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-600'}`}
                              title={order.customer?.address || order.deliveryAddress || '-'}
                            >
                              {order.customer?.address || order.deliveryAddress || '-'}
                            </div>
                          </td>

                          {/* Assigned Fleet Rider (with Inline Assign Dropdown if unassigned) */}
                          <td className="py-3.5 px-4">
                            {isUnassigned ? (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignDeliveryDriver(order.id, e.target.value);
                                    showToast(`✓ Rider ${e.target.value} assigned to Order #${order.orderNumber || order.id}`);
                                  }
                                }}
                                className={`border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer transition ${
                                  theme === 'dark' 
                                    ? 'bg-[#1c1e28] text-amber-300 border-amber-500/30 hover:border-amber-400' 
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500'
                                }`}
                              >
                                <option value="">+ Assign Rider...</option>
                                {deliveryDrivers.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className={`flex items-center gap-1.5 text-xs font-bold ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                                <Truck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{order.riderName || order.deliveryDriver}</span>
                              </div>
                            )}
                          </td>

                          {/* WhatsApp Dispatch Action */}
                          <td className="py-3.5 px-4">
                            {(() => {
                              const waData = getWhatsAppDispatchData(order);
                              const hasPhone = Boolean(waData.phone);
                              return hasPhone ? (
                                <a
                                  href={waData.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!waData.url) {
                                      e.preventDefault();
                                      showToast('⚠️ No valid customer phone number found');
                                      return;
                                    }
                                    showToast(`💬 WhatsApp status update (${waData.statusLabel}) opened for #${order.orderNumber || order.id}`);
                                  }}
                                  title={`Send "${waData.statusLabel}" WhatsApp message to +${waData.phone}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 hover:border-[#25D366]/70 text-[#25D366] hover:text-[#128C7E] dark:hover:text-white text-xs font-bold transition-all shadow-xs hover:shadow-[0_0_12px_rgba(37,211,102,0.25)] active:scale-95 whitespace-nowrap cursor-pointer group"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366] group-hover:scale-110 transition-transform" />
                                  <span>WhatsApp</span>
                                </a>
                              ) : (
                                <span 
                                  title="No customer phone number available"
                                  className={`text-[11px] font-mono italic opacity-60 ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`}
                                >
                                  No Phone
                                </span>
                              );
                            })()}
                          </td>

                          {/* Total (COD) */}
                          <td className={`py-3.5 px-4 text-right font-mono font-bold text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            PKR {(order.total || 0).toLocaleString()}
                          </td>

                          {/* Inspect View Details */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              id={`btn-view-order-${order.id}`}
                              onClick={() => {
                                setSelectedOrderForView(order);
                                setIsDetailsModalOpen(true);
                              }}
                              className={`px-3 py-1.5 rounded-xl transition cursor-pointer inline-flex items-center justify-center gap-1.5 border font-bold text-xs shadow-xs active:scale-95 ${
                                theme === 'dark'
                                  ? 'bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-500/30 hover:border-blue-500'
                                  : 'bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border-blue-200 hover:border-blue-600'
                              }`}
                              title="Inspect full order details, items & timeline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Order</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational Pagination Footer */}
        <footer className={`px-8 py-3 border-t flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 text-xs transition-colors duration-200 ${
          theme === 'dark' 
            ? 'border-slate-300 dark:border-white/10 bg-[#111216] text-slate-500 dark:text-stone-400' 
            : 'border-slate-200 bg-white text-slate-600 shadow-xs'
        }`}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
              Showing {displayedOrders.length} of {filteredOrders.length} orders
            </span>
            {filteredOrders.length > visibleCount && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                {filteredOrders.length - visibleCount} remaining
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {filteredOrders.length > 10 && visibleCount < filteredOrders.length && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 10)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <span>Load More Orders (+10)</span>
                <span className="bg-blue-700 px-2 py-0.5 rounded text-[10px] font-mono">
                  +{Math.min(10, filteredOrders.length - visibleCount)}
                </span>
              </button>
            )}

            {visibleCount > 10 && (
              <button
                onClick={() => setVisibleCount(10)}
                className={`px-3 py-1.5 border rounded-xl text-xs font-semibold transition cursor-pointer ${
                  theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-white/10 hover:bg-stone-700' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                Reset to 10
              </button>
            )}
          </div>
        </footer>
      </main>

      {/* View Order Details & Tracking Modal */}
      <DeliveryOrderDetailsModal
        order={selectedOrderForView}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrderForView(null);
        }}
        onUpdateStatus={(orderId, newStatus) => {
          updateOrderStatus(orderId, newStatus);
          if (selectedOrderForView && selectedOrderForView.id === orderId) {
            setSelectedOrderForView({ ...selectedOrderForView, status: newStatus });
          }
        }}
        onAssignRider={(orderId, riderName, riderPhone, riderVehicle) => {
          assignDeliveryDriver(orderId, riderName);
          if (selectedOrderForView && selectedOrderForView.id === orderId) {
            setSelectedOrderForView({
              ...selectedOrderForView,
              riderName,
              deliveryDriver: riderName,
              riderPhone,
              riderVehicle,
            });
          }
        }}
      />

      {/* Call Center Order Punch Modal */}
      <CallCenterOrderModal
        isOpen={isCallCenterModalOpen}
        onClose={() => setIsCallCenterModalOpen(false)}
      />

      {/* Rider Cash Drop Modal */}
      {activeDropRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
          <div className="bg-[#171924] border border-slate-300 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#12131d] border-b border-slate-300 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Record Rider Cash Drop</h3>
                  <p className="text-xs text-slate-500 dark:text-stone-400 font-medium">Reconcile COD Cash on Hand</p>
                </div>
              </div>
              <button
                onClick={() => setActiveDropRider(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amt = Number(dropAmount);
                if (!amt || amt <= 0) {
                  showToast('⚠️ Please specify a valid cash drop amount');
                  return;
                }
                dropRiderCash(activeDropRider, amt, dropNotes);
                showToast(`✓ Received PKR ${amt.toLocaleString()} cash drop from rider ${activeDropRider}`);
                setActiveDropRider(null);
                setDropAmount('');
                setDropNotes('');
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div className="bg-[#0e0f15] p-3.5 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-slate-500 dark:text-stone-400 text-[11px] block">Selected Delivery Fleet Rider:</span>
                <span className="text-sm font-black text-white block">{activeDropRider}</span>
                <span className="text-emerald-400 text-xs font-mono font-bold block">
                  Current Wallet Cash: PKR {getRiderCashOnHand(activeDropRider).toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-stone-300 mb-1">
                  Amount to Receive (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="e.g. 5000"
                  value={dropAmount}
                  onChange={(e) => setDropAmount(e.target.value)}
                  className="w-full bg-[#0e0f15] border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition"
                />
                <div className="flex gap-2 mt-2">
                  {[1000, 2000, 5000, getRiderCashOnHand(activeDropRider)].map((quickAmt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDropAmount(quickAmt.toString())}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      {idx === 3 ? 'Max All' : `${quickAmt}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-stone-300 mb-1">
                  Manager Reconciliation Memo / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of dinner shift handoff"
                  value={dropNotes}
                  onChange={(e) => setDropNotes(e.target.value)}
                  className="w-full bg-[#0e0f15] border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-400 dark:text-stone-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDropRider(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-stone-400 hover:text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirm Drop Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
