import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order, OrderStatus } from '../../types';
import { DeliveryOrderDetailsModal } from './DeliveryOrderDetailsModal';
import { CallCenterOrderModal } from './CallCenterOrderModal';
import { playCashRegisterSound } from '../../utils/audio';

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
    showToast,
    outlets,
    addOrder,
    cashDrops,
    dropRiderCash,
    deliveryDrivers,
    getRiderStats,
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
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  // Pagination State (Default 20 as in screenshot)
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isCallCenterModalOpen, setIsCallCenterModalOpen] = useState<boolean>(false);

  // Live Elapsed Timers Map (Increment in real-time)
  const [liveElapsedMap, setLiveElapsedMap] = useState<Record<string, number>>({});

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
          const finishedTimeline = o.timeline?.find(t => t.status === 'delivered' || t.status === 'completed' || t.status === 'cancelled' || t.status === 'refunded');
          endDate = finishedTimeline ? new Date(finishedTimeline.timestamp) : (o.updatedAt ? new Date(o.updatedAt) : new Date(o.createdAt || Date.now()));
        }
        const diffMins = Math.max(1, Math.floor((endDate.getTime() - orderDate.getTime()) / 60000));
        initialMap[o.id] = diffMins;
      }
    });
    setLiveElapsedMap(initialMap);
  }, [orders]);

  const ordersRef = React.useRef(orders);
  React.useEffect(() => {
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

      // Simulation: randomly progress 1 pending or in-kitchen order if enabled
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
          showToast(`✓ Order #${target.orderNumber || target.id} successfully delivered!`);
        }
      }
    }, 10000); // Ticks every 10 seconds

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
    const cleanName = riderName.toLowerCase().trim();
    // Sum of delivered cash orders
    const totalDeliveredCash = orders
      .filter((o) => {
        const orderDriver = (o.riderName || o.deliveryDriver || '').trim().toLowerCase();
        const isDelivered = o.status === 'completed' || o.status === 'delivered';
        const isCash = o.paymentMethod?.toLowerCase() === 'cash';
        return orderDriver === cleanName && isDelivered && isCash;
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);

    // Sum of processed drops
    const totalDropped = (cashDrops || [])
      .filter((d) => d.riderName.toLowerCase().trim() === cleanName)
      .reduce((sum, d) => sum + d.amount, 0);

    return Math.max(0, totalDeliveredCash - totalDropped);
  };

  // --- Live KPI / SLA Calculations ---
  const { averageDeliveryTime, slaBreachRate, onTripRidersCount, idleRidersCount, totalCODPending } = useMemo(() => {
    const activeAndDelivered = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'refunded'
    );
    const delivered = orders.filter(
      (o) => o.status === 'delivered' || o.status === 'completed'
    );

    // 1. Average Delivery Time
    const avgTime = delivered.length > 0
      ? Math.round(
          delivered.reduce(
            (sum, o) => sum + (liveElapsedMap[o.id] || o.deliveryElapsedMinutes || 25),
            0
          ) / delivered.length
        )
      : 24;

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
      onTripRidersCount: onTrip,
      idleRidersCount: idle,
      totalCODPending: totalCOD,
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
        // Active delivery monitoring (Hide delivered, completed, cancelled, refunded)
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

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredOrders, currentPage, rowsPerPage]);

  const clusteredSectors = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    paginatedOrders.forEach((order) => {
      const sector = getAddressSector(order.deliveryAddress || order.customer?.address);
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(order);
    });
    return groups;
  }, [paginatedOrders]);

  const startRecordNum = filteredOrders.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecordNum = Math.min(currentPage * rowsPerPage, filteredOrders.length);

  // Helper for SLA Badge
  const getDeliveryTimeBadge = (order: Order) => {
    const elapsed = liveElapsedMap[order.id] ?? order.deliveryElapsedMinutes ?? 35;
    const isDelivered = order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled' || order.status === 'refunded';
    
    let bgClass = 'bg-[#b71c1c] text-white'; // Red for >45m
    if (isDelivered) {
      bgClass = 'bg-stone-800 text-stone-400 border border-stone-700 opacity-80'; // Gray for completed
    } else if (elapsed < 30) {
      bgClass = 'bg-[#0284c7] text-white'; // Cyan/Teal for <30m
    } else if (elapsed <= 45) {
      bgClass = 'bg-[#d97706] text-stone-950'; // Amber/Gold for 30-45m
    }

    return (
      <span className={`px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide ${bgClass} shadow-sm inline-block`}>
        {elapsed}m
      </span>
    );
  };

  // Helper for Order Status Badge
  const getOrderStatusBadge = (order: Order) => {
    const st = (order.status || 'pending').toLowerCase();
    
    if (st === 'delivered' || st === 'completed') {
      return (
        <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-[#14532d] text-[#4ade80] border border-[#166534] shadow-sm inline-block">
          Delivered
        </span>
      );
    }
    if (st === 'dispatched') {
      return (
        <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-[#78350f] text-[#fbbf24] border border-[#92400e] shadow-sm inline-block">
          On The Way
        </span>
      );
    }
    if (st === 'in_kitchen' || st === 'pending' || st === 'open' || st === 'punched') {
      return (
        <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-[#1e3a8a] text-[#60a5fa] border border-[#1e40af] shadow-sm inline-block">
          In Kitchen
        </span>
      );
    }
    if (st === 'ready') {
      return (
        <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-[#134e4a] text-[#2dd4bf] border border-[#115e59] shadow-sm inline-block">
          Ready
        </span>
      );
    }
    if (st === 'cancelled' || st === 'refunded') {
      return (
        <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-[#7f1d1d] text-[#f87171] border border-[#991b1b] shadow-sm inline-block">
          Cancelled
        </span>
      );
    }

    return (
      <span className="px-3.5 py-1 rounded-md text-xs font-bold bg-stone-800 text-stone-300 shadow-sm inline-block">
        {order.status}
      </span>
    );
  };

  // Format Order Time to `28-08-2026 21:52`
  const formatOrderTime = (isoString?: string) => {
    if (!isoString) return '28-08-2026 21:52';
    try {
      const d = new Date(isoString);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${mins}`;
    } catch (e) {
      return '28-08-2026 21:52';
    }
  };

  // Status Change Handler
  const handleInlineStatusChange = (orderId: string, newStatus: OrderStatus) => {
    updateOrderStatus(orderId, newStatus);
    if (soundEnabled) playCashRegisterSound();
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
    showToast(`🚀 Batch Dispatched ${pendingSectorOrders.length} orders in ${sectorName} to rider ${rider}!`);
    setBatchRiderMap(prev => ({ ...prev, [sectorName]: '' }));
  };

  // Helper to generate encoded WhatsApp dispatch links
  const getWhatsAppLink = (order: Order) => {
    if (!order.customer?.phone) return '#';
    const riderName = order.riderName || order.deliveryDriver || 'Unassigned Rider';
    const riderPhone = order.riderPhone || '0315-9988771';
    const vehicle = order.riderVehicle || 'Honda 125 (LEA-4891)';
    const totalAmount = order.total || order.subtotal || 0;
    const orderNum = order.orderNumber || order.id;

    const rawMessage = `Dear *${order.customer.name || 'Customer'}*, your Whites Castle order *${orderNum}* is OUT FOR DELIVERY! 🛵\n\n*Rider:* ${riderName}\n*Contact:* ${riderPhone}\n*Vehicle:* ${vehicle}\n\n*Total (COD):* PKR ${totalAmount.toLocaleString()}\n\n_Thank you for choosing Whites Castle!_`;
    return `https://wa.me/${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(rawMessage)}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1f2127] text-stone-100 font-sans select-none overflow-hidden">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR                                                         */}
      {/* ========================================================================= */}
      <header className="h-12 bg-[#191b22] border-b border-[#2d313c] px-4 flex items-center justify-between shrink-0 z-20 shadow-md">
        {/* Left Hamburger & Restaurant Name */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => showToast('Navigation Menu')}
            className="text-stone-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-stone-200 text-sm font-extrabold tracking-wide">
            whites castle
          </span>
        </div>

        {/* Right User Profile */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-300 font-semibold hidden sm:inline-block">
            {currentUser?.name ? currentUser.name.split(' ')[0] + ' ' + (currentUser.name.split(' ')[1] || '') : 'Ali Hassan'}
          </span>
          <button
            onClick={onOpenUserSwitch}
            className="w-8 h-8 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center transition shadow cursor-pointer border border-blue-400/40"
            title="User Profile & Switch"
          >
            <User className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Main Content Area with Left Icon Rail + Table */}
      <div className="flex-1 flex flex-row overflow-hidden">
        
        {/* ========================================================================= */}
        {/* 2. LEFT NAVIGATION RAIL (Matches User Screenshot)                         */}
        {/* ========================================================================= */}
        <nav className="w-14 bg-[#14151c] border-r border-[#2d313c] flex flex-col items-center justify-between py-3 shrink-0 z-10">
          <div className="flex flex-col items-center gap-3 w-full px-2">
            
            {/* Top Menu Icon */}
            <button
              onClick={() => showToast('Main Menu Trigger')}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Menu Options"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Call Center Icon (Phone) */}
            <button
              onClick={() => {
                setLeftRailActive('phone');
                setIsCallCenterModalOpen(true);
              }}
              className={`p-2.5 rounded-xl transition cursor-pointer relative group ${
                leftRailActive === 'phone'
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
              title="Call Center Dispatch & Order Entry"
            >
              <Phone className="w-5 h-5" />
              <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                Call Center Punch
              </span>
            </button>

            {/* Delivery Scooter Icon (ACTIVE in Screenshot with Blue Pill) */}
            <button
              onClick={() => {
                setLeftRailActive('delivery');
                setActiveTab('DELIVERY');
              }}
              className="w-10 h-10 rounded-xl bg-[#1e40af] text-white flex items-center justify-center shadow-lg transition cursor-pointer relative group"
              title="Delivery Monitoring"
            >
              <Truck className="w-5 h-5 text-white" />
              <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                Delivery Monitoring (Active)
              </span>
            </button>

            {/* Ban / Void / Cancelled Icon */}
            <button
              onClick={() => {
                setLeftRailActive('ban');
                setActiveTab('CANCELLED');
                showToast('Viewing Cancelled / Voided Orders');
              }}
              className={`p-2.5 rounded-xl transition cursor-pointer relative group ${
                leftRailActive === 'ban'
                  ? 'bg-red-600/30 text-red-400'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
              title="Cancelled / Voided Orders"
            >
              <Ban className="w-5 h-5" />
              <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                Cancelled Orders
              </span>
            </button>
          </div>

          {/* Bottom Quick Navigation Icons */}
          <div className="flex flex-col items-center gap-2.5 w-full px-2">
            {onOpenPOS && (
              <button
                onClick={onOpenPOS}
                className="p-2 rounded-xl text-stone-400 hover:text-emerald-400 hover:bg-stone-800 transition cursor-pointer relative group"
                title="Switch to Floor POS Workstation"
              >
                <Store className="w-5 h-5" />
                <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                  Floor POS Terminal
                </span>
              </button>
            )}

            {onOpenKitchen && (
              <button
                onClick={onOpenKitchen}
                className="p-2 rounded-xl text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer relative group"
                title="Kitchen Order Display"
              >
                <ChefHat className="w-5 h-5" />
                <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                  Kitchen Display
                </span>
              </button>
            )}

            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-2 rounded-xl text-stone-400 hover:text-purple-400 hover:bg-stone-800 transition cursor-pointer relative group"
                title="Admin Reports & Console"
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="absolute left-16 bg-stone-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                  Admin Reports
                </span>
              </button>
            )}
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* 3. MONITORING SUBHEADER & DATA GRID                                        */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col h-full bg-[#1b1c24] overflow-hidden">
          
          {/* ========================================================================= */}
          {/* LIVE SLA & DELIVERY PERFORMANCE OVERVIEW (Anti-Slop Modern Cards)          */}
          {/* ========================================================================= */}
          <div className="px-6 pt-4 pb-2 bg-[#1b1c24] grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 border-b border-stone-800/60">
            {/* SLA Delivery Time */}
            <div className="bg-[#171822] border border-stone-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400 block mb-0.5">Avg SLA Delivery</span>
                <span className="text-lg font-black text-white">{averageDeliveryTime} mins</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            {/* SLA Breach Risk */}
            <div className="bg-[#171822] border border-stone-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400 block mb-0.5">SLA Breach (&gt;45m)</span>
                <span className={`text-lg font-black ${Number(slaBreachRate) > 5 ? 'text-red-400' : 'text-emerald-400'}`}>{slaBreachRate}%</span>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${Number(slaBreachRate) > 5 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {/* Rider Fleet Status */}
            <div className="bg-[#171822] border border-stone-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400 block mb-0.5">Riders Fleet (Trip/Idle)</span>
                <span className="text-lg font-black text-white">{onTripRidersCount} <span className="text-stone-500 text-xs font-semibold">on trip</span> / {idleRidersCount} <span className="text-stone-500 text-xs font-semibold">idle</span></span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Truck className="w-4 h-4" />
              </div>
            </div>

            {/* Outstanding Cash on Hand */}
            <div className="bg-[#171822] border border-stone-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm hover:border-emerald-500/30 transition cursor-pointer" onClick={() => { setActiveTab('RIDERS'); showToast('Opened Rider Cash Reconciliation ledger'); }}>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400 block mb-0.5">Rider COD Outstanding</span>
                <span className="text-lg font-black text-emerald-400">PKR {totalCODPending.toLocaleString()}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          {/* Subheader Filter Bar (Matches User Screenshot) */}
          <div className="px-6 py-3.5 bg-[#1b1c24] border-b border-[#2d313c] flex flex-wrap items-center justify-between gap-4 shrink-0">
            
            {/* Filter Tabs on Left */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['ALL', 'KITCHEN', 'DELIVERY', 'FINISHED', 'RIDERS'] as TabFilter[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setLeftRailActive('delivery');
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition cursor-pointer ${
                      isActive
                        ? 'bg-[#1e40af] text-white shadow-md'
                        : 'bg-transparent text-stone-400 hover:text-stone-200 border border-stone-700/60 hover:border-stone-600'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}

              {/* Branch Filter Dropdown */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-stone-400 font-bold hidden md:inline">Branch:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-[#242632] border border-stone-700/80 rounded-lg px-2.5 py-1 text-xs text-stone-200 font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Branches</option>
                  <option value="Sargodha">Sargodha</option>
                  <option value="Jinnah Colony">Jinnah Colony</option>
                  <option value="Eden Garden">Eden Garden</option>
                  <option value="Gujrat">Gujrat</option>
                  <option value="Gojra">Gojra</option>
                  <option value="Gulberg">Gulberg</option>
                </select>
              </div>
            </div>

            {/* Center Search Input */}
            <div className="flex-1 max-w-md min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search Order"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#242632] border border-stone-700/80 rounded-lg px-4 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-stone-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Right Title & Realtime Refresh Switch */}
            <div className="flex items-center gap-4">
              {activeTab !== 'RIDERS' && (
                <div className="flex items-center gap-1 bg-[#242632] border border-stone-700/80 rounded-lg p-1 shrink-0">
                  <button
                    onClick={() => {
                      setIsClustered(false);
                      showToast('📋 Standard flat list view enabled');
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wider uppercase transition cursor-pointer ${
                      !isClustered
                        ? 'bg-[#1e40af] text-white shadow-sm font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => {
                      setIsClustered(true);
                      showToast('📍 Smart neighborhood route clustering enabled');
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wider uppercase transition cursor-pointer ${
                      isClustered
                        ? 'bg-[#1e40af] text-white shadow-sm font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Cluster
                  </button>
                </div>
              )}

              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Delivery Monitoring
              </h1>

              {/* Auto Refresh Toggle Switch (Matches UI Screenshot) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isAutoRefresh;
                    setIsAutoRefresh(next);
                    showToast(next ? '🟢 Realtime auto-refresh active' : '⏸️ Auto-refresh paused');
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                    isAutoRefresh ? 'bg-[#3b82f6]' : 'bg-stone-700'
                  }`}
                  title={isAutoRefresh ? 'Auto-Refresh Active' : 'Auto-Refresh Off'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                      isAutoRefresh ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs text-stone-300 font-semibold">
                  Refresh
                </span>
              </div>

              {/* Manual Refresh Icon */}
              <button
                onClick={handleManualRefresh}
                className="p-1.5 rounded-lg bg-[#242632] hover:bg-[#2c2f3e] text-stone-300 hover:text-white transition border border-stone-700/70 cursor-pointer"
                title="Sync Realtime Data Now"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              {/* Call Center Quick Punch Button */}
              <button
                onClick={() => setIsCallCenterModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Order</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. ORDERS DATA TABLE / RIDER LEDGER                                       */}
          {/* ========================================================================= */}
          <div className="flex-1 overflow-auto bg-[#1b1c24] custom-scrollbar">
            {activeTab === 'RIDERS' ? (
              <div className="p-6 space-y-6">
                {/* Rider grid layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {deliveryDrivers.map((driver) => {
                    const stats = getRiderStats(driver);
                    const cash = getRiderCashOnHand(driver);
                    
                    // Determine if currently out delivering
                    const activeTrips = orders.filter(
                      (o) =>
                        o.status === 'dispatched' &&
                        (o.riderName || o.deliveryDriver || '').trim().toLowerCase() ===
                          driver.toLowerCase().trim()
                    );
                    const isDelivering = activeTrips.length > 0;

                    return (
                      <div
                        key={driver}
                        className="bg-[#171822] border border-stone-800/80 rounded-xl p-4 space-y-4 hover:border-stone-700/60 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black">
                              {driver.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white">{driver}</h4>
                              <span className="text-[10px] text-stone-500 font-bold block">Whites Castle Delivery Rider</span>
                            </div>
                          </div>
                          
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                              isDelivering
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isDelivering ? `On Trip (${activeTrips.length})` : 'Idle / Ready'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-[#14151f] p-3 rounded-lg text-[11px]">
                          <div>
                            <span className="text-stone-500 font-semibold block mb-0.5">Active Trips</span>
                            <span className="text-stone-200 font-bold">{activeTrips.length}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 font-semibold block mb-0.5">Trips Today</span>
                            <span className="text-stone-200 font-bold">{stats?.delivered || 0}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-stone-800/80 pt-3.5">
                          <div>
                            <span className="text-[10px] text-stone-400 font-bold block mb-0.5 uppercase tracking-wide">COD Wallet Cash</span>
                            <span className="text-base font-black text-emerald-400">PKR {cash.toLocaleString()}</span>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDropRider(driver);
                              setDropAmount(cash > 0 ? cash.toString() : '');
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition shadow cursor-pointer"
                          >
                            Drop Cash
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cash drops ledger logs (Anti-Slop Design) */}
                <div className="bg-[#171822] border border-stone-800/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                    <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Recent Verified Cash Drops Audit Logs
                    </h3>
                    <span className="text-[10px] text-stone-500 font-bold">Showing last 20 operations</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-800 text-stone-400 font-bold">
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 px-4">Rider Name</th>
                          <th className="py-2.5 px-4 text-right">Amount dropped</th>
                          <th className="py-2.5 px-4">Manager signature</th>
                          <th className="py-2.5 px-4">Memo / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/50">
                        {(cashDrops || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-stone-500 font-semibold italic">
                              No cash drops recorded today.
                            </td>
                          </tr>
                        ) : (
                          (cashDrops || []).map((drop: any) => (
                            <tr key={drop.id} className="hover:bg-stone-800/20 text-stone-300">
                              <td className="py-3 px-4 font-mono">{new Date(drop.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                              <td className="py-3 px-4 font-bold text-white">{drop.riderName}</td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">PKR {drop.amount.toLocaleString()}</td>
                              <td className="py-3 px-4 font-mono">{drop.receivedBy || 'Robert Vance'}</td>
                              <td className="py-3 px-4 text-stone-400">{drop.notes || 'End of shift drop'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                
                {/* Dark Navy Table Header */}
                <thead className="bg-[#181a38] text-stone-300 font-bold sticky top-0 z-10 border-b border-[#2d313c] shadow-sm">
                  <tr>
                    <th className="py-3 px-4 text-stone-300 font-bold tracking-wider">Order Id</th>
                    <th className="py-3 px-4 text-center font-bold tracking-wider">Delivery Time</th>
                    <th className="py-3 px-4 font-bold tracking-wider">Order Time</th>
                    <th className="py-3 px-4 font-bold tracking-wider">From</th>
                    <th className="py-3 px-4 font-bold tracking-wider">Cust. Name</th>
                    <th className="py-3 px-4 font-bold tracking-wider">Contact / Alerts</th>
                    <th className="py-3 px-4 font-bold tracking-wider">Branch</th>
                    <th className="py-3 px-4 text-right font-bold tracking-wider">Total</th>
                    <th className="py-3 px-4 font-bold tracking-wider">Punched By</th>
                    <th className="py-3 px-4 text-center font-bold tracking-wider">Order Status</th>
                    <th className="py-3 px-4 text-center font-bold tracking-wider">View</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#272a36]">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-stone-500">
                        <Truck className="w-10 h-10 mx-auto text-stone-600 mb-2 opacity-50 stroke-1" />
                        <p className="text-sm font-semibold">No delivery orders found matching filter criteria</p>
                        <p className="text-xs text-stone-600 mt-1">Try changing your search keywords or branch filter</p>
                      </td>
                    </tr>
                  ) : isClustered ? (
                    Object.entries(clusteredSectors).map(([sectorName, sectorOrders]) => {
                      return (
                        <React.Fragment key={sectorName}>
                          {/* Sector Group Header Row */}
                          <tr className="bg-[#1f213a] border-y border-[#323657]">
                            <td colSpan={11} className="py-2.5 px-4 font-extrabold text-blue-300">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-black">
                                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                                  📍 {sectorName} &bull; {sectorOrders.length} Orders
                                </span>
                                
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={batchRiderMap[sectorName] || ''}
                                    onChange={(e) => setBatchRiderMap(prev => ({ ...prev, [sectorName]: e.target.value }))}
                                    className="bg-[#141524] border border-stone-700 rounded px-2.5 py-1 text-[11px] text-stone-200 focus:outline-none font-bold"
                                  >
                                    <option value="">-- Choose Rider to Batch --</option>
                                    {deliveryDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                  <button
                                    onClick={() => handleBatchDispatch(sectorName)}
                                    disabled={!batchRiderMap[sectorName]}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-800 disabled:text-stone-500 rounded text-[10px] text-white font-black transition cursor-pointer"
                                  >
                                    Batch Dispatch
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Orders under this sector */}
                          {sectorOrders.map((order, orderIndex) => {
                            const isEven = orderIndex % 2 === 0;
                            return (
                              <tr
                                key={order.id}
                                className={`hover:bg-[#252836] transition-colors group ${
                                  isEven ? 'bg-[#1b1c24]' : 'bg-[#1e202a]'
                                }`}
                              >
                                {/* Order ID */}
                                <td className="py-3.5 px-4 font-mono font-bold text-stone-200">
                                  {order.orderNumber || order.id}
                                </td>

                                {/* Delivery Time */}
                                <td className="py-3.5 px-4 text-center">
                                  {getDeliveryTimeBadge(order)}
                                </td>

                                {/* Order Time */}
                                <td className="py-3.5 px-4 text-stone-300 font-mono">
                                  {formatOrderTime(order.createdAt)}
                                </td>

                                {/* From */}
                                <td className="py-3.5 px-4 text-stone-300 font-semibold">
                                  {order.source || order.sourceChannel || 'Call Center'}
                                </td>

                                {/* Cust. Name */}
                                <td className="py-3.5 px-4 text-stone-200 font-bold">
                                  {order.customer?.name || 'Walk-in'}
                                </td>

                                {/* Contact with WhatsApp trigger */}
                                <td className="py-3.5 px-4 font-mono text-stone-300">
                                  <div className="flex items-center gap-2">
                                    <span>{order.customer?.phone || 'N/A'}</span>
                                    {order.customer?.phone && (
                                      <a
                                        href={getWhatsAppLink(order)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2 py-0.5 rounded text-[10px] font-black tracking-wide border border-emerald-500/30 transition cursor-pointer"
                                        title="Send Instant WhatsApp Dispatch Alert"
                                        onClick={() => {
                                          showToast(`💬 opening WhatsApp alert for ${order.customer?.name}`);
                                        }}
                                      >
                                        <MessageSquare className="w-2.5 h-2.5 text-emerald-400 group-hover:text-white" />
                                        <span>Dispatch</span>
                                      </a>
                                    )}
                                  </div>
                                </td>

                                {/* Branch */}
                                <td className="py-3.5 px-4 text-stone-300 font-medium">
                                  {order.branchName || order.outlet || 'Main Branch'}
                                </td>

                                {/* Total */}
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-200">
                                  {order.total?.toLocaleString() || '0'}
                                </td>

                                {/* Punched By */}
                                <td className="py-3.5 px-4 text-stone-300 font-medium">
                                  {order.punchedBy || order.cashierName || 'Staff'}
                                </td>

                                {/* Order Status */}
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    onClick={() => {
                                      if (order.status === 'in_kitchen' || order.status === 'pending') {
                                        handleInlineStatusChange(order.id, 'dispatched');
                                      } else if (order.status === 'dispatched') {
                                        handleInlineStatusChange(order.id, 'delivered');
                                      } else if (order.status === 'delivered') {
                                        showToast(`Order #${order.orderNumber || order.id} already completed`);
                                      }
                                    }}
                                    className="cursor-pointer hover:opacity-85 transition"
                                    title="Click to cycle status"
                                  >
                                    {getOrderStatusBadge(order)}
                                  </button>
                                </td>

                                {/* View Action */}
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedOrderForView(order);
                                      setIsDetailsModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-700/60 transition cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-blue-400" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    paginatedOrders.map((order, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-[#252836] transition-colors group ${
                            isEven ? 'bg-[#1b1c24]' : 'bg-[#1e202a]'
                          }`}
                        >
                          {/* Order ID */}
                          <td className="py-3.5 px-4 font-mono font-bold text-stone-200">
                            {order.orderNumber || order.id}
                          </td>

                          {/* Delivery Time (Dynamic Color Pill Badge) */}
                          <td className="py-3.5 px-4 text-center">
                            {getDeliveryTimeBadge(order)}
                          </td>

                          {/* Order Time */}
                          <td className="py-3.5 px-4 text-stone-300 font-mono">
                            {formatOrderTime(order.createdAt)}
                          </td>

                          {/* From */}
                          <td className="py-3.5 px-4 text-stone-300 font-semibold">
                            {order.source || order.sourceChannel || 'Call Center'}
                          </td>

                          {/* Cust. Name */}
                          <td className="py-3.5 px-4 text-stone-200 font-bold">
                            {order.customer?.name || 'Walk-in'}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4 font-mono text-stone-300">
                            <div className="flex items-center gap-2">
                              <span>{order.customer?.phone || 'N/A'}</span>
                              {order.customer?.phone && (
                                <a
                                  href={getWhatsAppLink(order)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2 py-0.5 rounded text-[10px] font-black tracking-wide border border-emerald-500/30 transition cursor-pointer"
                                  title="Send Instant WhatsApp Dispatch Alert"
                                  onClick={() => {
                                    showToast(`💬 opening WhatsApp alert for ${order.customer?.name}`);
                                  }}
                                >
                                  <MessageSquare className="w-2.5 h-2.5 text-emerald-400 group-hover:text-white" />
                                  <span>Dispatch</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="py-3.5 px-4 text-stone-300 font-medium">
                            {order.branchName || order.outlet || 'Main Branch'}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-200">
                            {order.total?.toLocaleString() || '0'}
                          </td>

                          {/* Punched By */}
                          <td className="py-3.5 px-4 text-stone-300 font-medium">
                            {order.punchedBy || order.cashierName || 'Staff'}
                          </td>

                          {/* Order Status */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                // Quick cycle status
                                if (order.status === 'in_kitchen' || order.status === 'pending') {
                                  handleInlineStatusChange(order.id, 'dispatched');
                                } else if (order.status === 'dispatched') {
                                  handleInlineStatusChange(order.id, 'delivered');
                                } else if (order.status === 'delivered') {
                                  showToast(`Order #${order.orderNumber || order.id} already completed`);
                                }
                              }}
                              className="cursor-pointer hover:opacity-85 transition"
                              title="Click to cycle status (In Kitchen → On The Way → Delivered)"
                            >
                              {getOrderStatusBadge(order)}
                            </button>
                          </td>

                          {/* View Eye Icon Action */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedOrderForView(order);
                                setIsDetailsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-700/60 transition cursor-pointer"
                              title="View Complete Delivery Details & Live Tracking"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 5. BOTTOM PAGINATION BAR (Matches User Screenshot)                        */}
          {/* ========================================================================= */}
          <div className="h-12 bg-[#191b22] border-t border-[#2d313c] px-6 flex items-center justify-end gap-6 text-xs text-stone-400 shrink-0">
            
            {/* Rows per page */}
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#242632] border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Showing Range */}
            <div>
              <span>
                {startRecordNum}–{endRecordNum} of {filteredOrders.length}
              </span>
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

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

      {/* Rider Cash Drop Modal */}
      {activeDropRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-[#1b1c24] border border-[#2d313c] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#181a38] px-5 py-4 border-b border-[#2d313c] flex items-center justify-between">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Rider Cash Drop
              </h2>
              <button
                onClick={() => setActiveDropRider(null)}
                className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-[#14151f] border border-stone-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Rider</p>
                <p className="text-sm font-bold text-white">{activeDropRider}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 mb-1.5 block">Drop Amount (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-bold">Rs.</span>
                  <input
                    type="number"
                    value={dropAmount}
                    onChange={(e) => setDropAmount(e.target.value)}
                    className="w-full bg-[#14151f] border border-stone-700 rounded-lg py-2.5 pl-10 pr-4 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 mb-1.5 block">Manager Notes / Signature</label>
                <input
                  type="text"
                  value={dropNotes}
                  onChange={(e) => setDropNotes(e.target.value)}
                  className="w-full bg-[#14151f] border border-stone-700 rounded-lg py-2.5 px-4 text-white font-medium focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. End of shift deposit"
                />
              </div>
            </div>

            <div className="p-5 border-t border-[#2d313c] bg-[#14151f] flex gap-3">
              <button
                onClick={() => setActiveDropRider(null)}
                className="flex-1 py-2.5 rounded-lg font-bold text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(dropAmount);
                  if (isNaN(amt) || amt <= 0) {
                    showToast('⚠️ Please enter a valid drop amount.');
                    return;
                  }
                  dropRiderCash(activeDropRider, amt, dropNotes);
                  if (soundEnabled) playCashRegisterSound();
                  showToast(`✅ Successfully deposited PKR ${amt.toLocaleString()} from ${activeDropRider}.`);
                  setActiveDropRider(null);
                  setDropAmount('');
                  setDropNotes('');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Center Order Punch Modal */}
      <CallCenterOrderModal
        isOpen={isCallCenterModalOpen}
        onClose={() => setIsCallCenterModalOpen(false)}
        onOrderCreated={(newOrd) => {
          addOrder(newOrd);
        }}
      />
    </div>
  );
};
