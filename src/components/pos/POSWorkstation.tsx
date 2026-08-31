import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import {
  Headphones,
  Moon,
  MessageSquare,
  Search,
  RotateCw,
  Database,
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  Phone,
  User,
  MapPin,
  Clock,
  Layers,
  Percent,
  DollarSign,
  Send,
  AlertCircle,
  Wifi,
  WifiOff,
  Calculator,
  Award,
  Sparkles,
  Edit3,
  Printer,
  FileText,
  Truck,
  ChefHat,
  Receipt,
  CheckCircle2,
  Filter,
  ShieldAlert,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, Order, Customer, OrderStatus } from '../../types';
import { ShiftCloseModal } from '../shift/ShiftCloseModal';
import { CustomerViewModal } from './CustomerViewModal';
import { CustomerManageModal } from './CustomerManageModal';
import { OrderEditCancelModal } from '../orders/OrderEditCancelModal';
import { ReceiptModal } from '../orders/ReceiptModal';
import { posDB } from '../../utils/indexedDB';
import { playCashRegisterSound, playErrorSound } from '../../utils/audio';

interface POSWorkstationProps {
  onOpenUserSwitch?: () => void;
  onOpenOrdersView?: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenDeliveryMonitoring?: () => void;
  onOpenShiftsView?: () => void;
}

export const POSWorkstation: React.FC<POSWorkstationProps> = ({
  onOpenUserSwitch,
  onOpenOrdersView,
  onOpenAdminDashboard,
  onOpenDeliveryMonitoring,
  onOpenShiftsView,
}) => {
  const {
    menuItems,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    posCart,
    addToPosCart,
    removeFromPosCart,
    updateCartItemQty,
    updateCartItemNote,
    clearPosCart,
    setPosOrderType,
    setPosDeliveryDriver,
    setPosTableNumber,
    setPosServer,
    setPosDiscountPercent,
    setPosTipAmount,
    setPosPaymentMethod,
    setPosNotes,
    setPosCustomerField,
    lookupCustomer,
    upsertCustomer,
    punchOrder,
    orders,
    updateOrderStatus,
    cancelOrder,
    editOrder,
    cartSubtotal,
    cartTax,
    cartDeliveryFee,
    cartDiscount,
    cartTotal,
    showToast,
    currentUser,
    currentShift,
    users,
    outlets,
    tables,
  } = useRestaurant();

  const [, startTransition] = useTransition();

  // Tab View for Middle Section: 'all_orders' or 'active_ticket'
  const [middleTab, setMiddleTab] = useState<'all_orders' | 'active_ticket'>('all_orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState<string>('all');
  const [allOrdersSearch, setAllOrdersSearch] = useState<string>('');

  // Active Flavor / Customization Modal
  const [activeFlavorModalItem, setActiveFlavorModalItem] = useState<MenuItem | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');

  // Discount & Charges Modals / Popups
  const [showDiscountPrompt, setShowDiscountPrompt] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [showChargesPrompt, setShowChargesPrompt] = useState(false);
  const [chargesInput, setChargesInput] = useState<string>('0');

  // Customer Management
  const [phoneSearchInput, setPhoneSearchInput] = useState<string>(posCart.customer?.phone || '');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'found' | 'new' | 'idle'>('idle');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerManageModalOpen, setIsCustomerManageModalOpen] = useState(false);

  // Pane 1 Controls State
  const [selectedOutlet, setSelectedOutlet] = useState<string>('Gulberg Branch');
  const [selectedSource, setSelectedSource] = useState<string>('Pos');
  const [searchOrdersInput, setSearchOrdersInput] = useState<string>('');
  const [orderStreamTab, setOrderStreamTab] = useState<'ongoing'|'all'>('ongoing');
  const [activeDeliveryNote, setActiveDeliveryNote] = useState<string>('');
  const [isPreOrder, setIsPreOrder] = useState<boolean>(false);
  const [bottomInputVal, setBottomInputVal] = useState<string>('0');

  // Shift Close Modal State
  const [isShiftCloseOpen, setIsShiftCloseOpen] = useState(false);

  // Order Edit & Receipt Modals
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedOrderForCashout, setSelectedOrderForCashout] = useState<Order | null>(null);
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);

  // Online / Offline & Punch Hardening
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [punchSuccessAnimation, setPunchSuccessAnimation] = useState<boolean>(false);
  const lastPunchTimestampRef = useRef<number>(0);

  // Network listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('🟢 Network online — synced');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚠️ Network offline — orders queueing locally');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    posDB.getQueuedOrders().then((queued) => {
      setOfflineQueueCount(queued.length);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Sync phoneSearchInput when customer changes
  useEffect(() => {
    if (posCart.customer?.phone !== undefined && posCart.customer.phone !== phoneSearchInput) {
      setPhoneSearchInput(posCart.customer.phone);
    }
  }, [posCart.customer?.phone]);

  // Handle phone lookup
  const handlePhoneLookup = async (phoneVal?: string, manual = false) => {
    const raw = (phoneVal !== undefined ? phoneVal : phoneSearchInput).trim();
    if (!raw) {
      if (manual) showToast('Please enter a phone number to search');
      return;
    }

    setIsSearchingCustomer(true);
    try {
      const result = await lookupCustomer(raw);
      if (result.found && result.customer) {
        setCustomerLookupStatus('found');
        setFoundCustomer(result.customer);
        setPosCustomerField('phone', result.customer.phone);
        setPosCustomerField('name', result.customer.name);
        setPosCustomerField('address', result.customer.address || '');
        setPosCustomerField('notes', result.customer.notes || result.customer.deliveryNotes || '');
        if (manual) showToast(`✓ Customer recognized: ${result.customer.name}`);
      } else {
        setCustomerLookupStatus('new');
        setFoundCustomer(null);
        setPosCustomerField('phone', raw);
        // Do not clear name if user already typed one
        if (!posCart.customer?.name) {
          setPosCustomerField('name', '');
        }
        if (!posCart.customer?.address) {
          setPosCustomerField('address', '');
        }
        if (manual) showToast('ℹ️ New customer — please enter name and address below');
      }
    } catch (err) {
      console.warn('Customer search issue:', err);
      setCustomerLookupStatus('new');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Debounced auto-fetch
  useEffect(() => {
    const raw = phoneSearchInput.trim();
    if (raw.length >= 7) {
      const timer = setTimeout(() => {
        handlePhoneLookup(raw, false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCustomerLookupStatus('idle');
      setFoundCustomer(null);
    }
  }, [phoneSearchInput]);

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePhoneLookup();
    }
  };

  // Filter menu items by selected category and search
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCat =
        selectedCategory === 'all' ||
        item.category.toLowerCase().replace(/[-_ ]/g, '') ===
          selectedCategory.toLowerCase().replace(/[-_ ]/g, '');
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Tap Item Handler
  const handleItemTap = (item: MenuItem) => {
    if (item.flavors && item.flavors.length > 0) {
      setActiveFlavorModalItem(item);
      setSelectedFlavor(item.flavors[0]);
    } else {
      addToPosCart(item);
      if (middleTab === 'all_orders') {
        showToast(`Added ${item.name} to Active Ticket`);
      }
    }
  };

  const handleConfirmFlavor = () => {
    if (activeFlavorModalItem) {
      addToPosCart(activeFlavorModalItem, selectedFlavor);
      setActiveFlavorModalItem(null);
      setSelectedFlavor('');
      if (middleTab === 'all_orders') {
        showToast(`Added ${activeFlavorModalItem.name} (${selectedFlavor}) to Active Ticket`);
      }
    }
  };

  // Apply Discount
  const handleApplyDiscount = () => {
    const disc = parseFloat(discountInput) || 0;
    setPosDiscountPercent(Math.min(100, Math.max(0, disc)));
    setShowDiscountPrompt(false);
    showToast(`Applied ${disc}% discount`);
  };

  // Apply Extra Charges
  const handleApplyCharges = () => {
    const chg = parseFloat(chargesInput) || 0;
    setPosTipAmount(chg);
    setShowChargesPrompt(false);
    showToast(`Applied charges: PKR ${chg}`);
  };

  // Hardened Order Submission
  const handlePlaceOrder = async () => {
    const now = Date.now();
    if (now - lastPunchTimestampRef.current < 600) {
      return; // Debounce guardrail
    }
    lastPunchTimestampRef.current = now;

    if (posCart.items.length === 0) {
      playErrorSound();
      showToast('⚠️ Cannot place an empty order. Tap items from the menu.');
      return;
    }

    if (posCart.orderType === 'dine_in') {
      if (!posCart.tableNumber) {
        playErrorSound();
        showToast('⚠️ Please select a Table for Dine-In order.');
        return;
      }
      if (!posCart.serverId) {
        playErrorSound();
        showToast('⚠️ Please select a Server for Dine-In order.');
        return;
      }
    }

    setIsPunching(true);

    try {
      if (posCart.customer?.phone && posCart.customer.name && customerLookupStatus === 'new') {
        await upsertCustomer({
          name: posCart.customer.name,
          phone: posCart.customer.phone,
          address: posCart.customer.address,
          notes: activeDeliveryNote,
        });
      }

      setPosNotes(activeDeliveryNote);
      const tendered = parseFloat(bottomInputVal) || 0;
      const createdOrder = await punchOrder(tendered > 0 ? tendered : undefined, selectedOutlet);

      playCashRegisterSound();
      setPunchSuccessAnimation(true);
      showToast(`✓ Order #${createdOrder.orderNumber} successfully placed!`);

      // Switch to All Orders view to see the new live order
      setMiddleTab('all_orders');
      setSelectedOrderId(createdOrder.id);

      // Reset local fields
      setBottomInputVal('0');
      setActiveDeliveryNote('');
      setTimeout(() => setPunchSuccessAnimation(false), 1000);
    } catch (err: any) {
      console.error('Place order failed:', err);
      playErrorSound();
      showToast(`❌ Place order failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPunching(false);
    }
  };

  // ==========================================
  // ONE-CLICK ACTION HANDLERS (Left Bar & Middle)
  // ==========================================
  const handleOneClickCancel = (orderId: string, orderNumber: string) => {
    if (currentUser.role === 'cashier') {
      playErrorSound();
      showToast('⚠️ Manager/Owner PIN authorization required to cancel orders');
      return;
    }
    cancelOrder(orderId, `Cancelled by Manager ${currentUser.name}`);
    playErrorSound();
    showToast(`✕ Order #${orderNumber} cancelled by ${currentUser.name}`);
  };

  const handleOneClickDispatch = (order: Order) => {
    if (order.status === 'completed' || order.status === 'cancelled') {
      return;
    }
    
    let nextStatus: OrderStatus = 'in_kitchen';
    if (
      order.status === 'pending' ||
      order.status === 'PUNCHED' ||
      order.status === 'open' ||
      order.status === 'MODIFIED'
    ) {
      nextStatus = 'in_kitchen';
    } else if (order.status === 'in_kitchen') {
      nextStatus = 'dispatched';
    } else if (order.status === 'ready') {
      nextStatus = 'dispatched';
    } else if (order.status === 'dispatched' || order.status === 'delivered') {
      handleOneClickCashout(order);
      return;
    } else {
      nextStatus = order.status;
    }

    if (nextStatus === order.status) return;

    updateOrderStatus(order.id, nextStatus);
    const labelMap: Record<string, string> = {
      in_kitchen: 'In Kitchen',
      ready: 'Ready for Pickup',
      dispatched: 'Out for Delivery',
    };
    showToast(`🚀 Order #${order.orderNumber} dispatched → ${labelMap[nextStatus] || nextStatus}`);
  };

  const handleOneClickCashout = (order: Order) => {
    setSelectedOrderForCashout(order);
    setIsCashoutModalOpen(true);
  };
  
  const submitCashout = (method: 'cash' | 'card' | 'online') => {
    if (!selectedOrderForCashout) return;
    updateOrderStatus(selectedOrderForCashout.id, 'completed');
    editOrder(selectedOrderForCashout.id, { status: 'completed', paymentStatus: 'paid', paymentMethod: method });
    playCashRegisterSound();
    showToast(`💵 Order #${selectedOrderForCashout.orderNumber} paid via ${method.toUpperCase()} & completed!`);
    setIsCashoutModalOpen(false);
    setSelectedOrderForCashout(null);
  };

  const handleOneClickEdit = (order: Order) => {
    if (currentUser.role === 'cashier') {
      playErrorSound();
      showToast('⚠️ Manager/Owner permission required to edit live tickets');
      return;
    }
    setSelectedOrderForEdit(order);
    setIsEditModalOpen(true);
  };

  const handlePrintReceipt = (order: Order) => {
    setSelectedOrderForReceipt(order);
    setIsReceiptModalOpen(true);
  };

  // Helper for Status Badge Styling
  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
      case 'open':
      case 'PUNCHED':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'in_kitchen':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ready':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'dispatched':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'completed':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
      case 'open':
      case 'PUNCHED':
        return 'Punched';
      case 'MODIFIED':
        return 'Modified';
      case 'in_kitchen':
        return 'In Kitchen';
      case 'ready':
        return 'Ready';
      case 'dispatched':
        return 'On the way';
      case 'completed':
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  };

  // Filter Orders for Left Section based on tab
  const ongoingOrders = useMemo(() => {
    return orders.filter((o) => {
      const isOngoing = ['pending', 'PUNCHED', 'MODIFIED', 'open', 'in_kitchen', 'ready', 'dispatched'].includes(
        o.status
      );
      
      if (orderStreamTab === 'ongoing' && !isOngoing) {
        return false;
      }
      
      if (!searchOrdersInput) return true;
      const q = searchOrdersInput.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(q))
      );
    });
  }, [orders, searchOrdersInput, orderStreamTab]);

  // Filter All Orders for Middle Section
  const middleFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (allOrdersStatusFilter !== 'all') {
        if (allOrdersStatusFilter === 'active') {
          if (!['pending', 'PUNCHED', 'MODIFIED', 'open', 'in_kitchen', 'ready', 'dispatched'].includes(o.status)) {
            return false;
          }
        } else if (allOrdersStatusFilter === 'punched' && !['pending', 'PUNCHED', 'open', 'MODIFIED'].includes(o.status)) {
          return false;
        } else if (allOrdersStatusFilter === 'kitchen' && o.status !== 'in_kitchen') {
          return false;
        } else if (allOrdersStatusFilter === 'ready' && o.status !== 'ready') {
          return false;
        } else if (allOrdersStatusFilter === 'delivery' && o.status !== 'dispatched') {
          return false;
        } else if (allOrdersStatusFilter === 'completed' && o.status !== 'completed') {
          return false;
        } else if (allOrdersStatusFilter === 'cancelled' && o.status !== 'cancelled' && o.status !== 'refunded') {
          return false;
        }
      }

      if (allOrdersSearch) {
        const q = allOrdersSearch.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
          (o.customer?.phone && o.customer.phone.includes(q)) ||
          (o.tableNumber && o.tableNumber.toLowerCase().includes(q)) ||
          (o.notes && o.notes.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [orders, allOrdersStatusFilter, allOrdersSearch]);

  const isOwnerOrManager = currentUser.role === 'owner' || currentUser.role === 'manager';

  const handleResetTicket = () => {
    clearPosCart();
    setPhoneSearchInput('');
    setCustomerLookupStatus('idle');
    setFoundCustomer(null);
    setActiveDeliveryNote('');
    setIsPreOrder(false);
    setSelectedOutlet('Gulberg Branch');
    setSelectedSource('Pos');
  };

  return (
    <div className="w-full h-full flex flex-row overflow-hidden bg-gradient-to-br from-stone-900 via-[#191919] to-[#111111] text-[#E0E0E0] font-sans select-none no-scrollbar">
      
      {/* ========================================================================= */}
      {/* PANE 1: LEFT SIDEBAR & ORDER STREAM (Approx 20% width)                    */}
      {/* ========================================================================= */}
      <div className="w-[22%] xl:w-[20%] flex flex-row h-full shrink-0 border-r border-white/5 bg-gradient-to-b from-[#141414] to-[#0c0c0c] z-10">
        
        {/* Far-Left Icon Strip */}
        <div className="w-11 bg-[#161616] border-r border-white/5 flex flex-col items-center justify-between py-2.5 shrink-0 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-white/10 flex items-center justify-center font-black text-xl text-white select-none tracking-tighter shadow-md">
              H
            </div>

            <button onClick={() => showToast('Support & Intercom audio connected')} title="Audio / Intercom" className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <Headphones className="w-4.5 h-4.5 stroke-[2]" />
            </button>

            <button onClick={() => showToast('Terminal brightness optimized')} title="Terminal Night Mode" className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <Moon className="w-4.5 h-4.5 fill-current" />
            </button>

            <button
              onClick={() => {
                if (onOpenShiftsView) {
                  onOpenShiftsView();
                } else {
                  setIsShiftCloseOpen(true);
                }
              }}
              title="Register Shift & Cash Drawer Reconciliation"
              className="w-8 h-8 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm"
            >
              <Calculator className="w-4 h-4" />
            </button>

            {onOpenDeliveryMonitoring && (
              <button onClick={onOpenDeliveryMonitoring} title="Open Live Delivery Monitoring System" className="w-8 h-8 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm">
                <Truck className="w-4 h-4" />
              </button>
            )}

            {onOpenAdminDashboard && (
              <button onClick={onOpenAdminDashboard} title="Executive Administrative Console & Sales Dashboard" className="w-8 h-8 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm">
                <ShieldCheck className="w-4.5 h-4.5" />
              </button>
            )}

            {onOpenUserSwitch && (
              <button onClick={onOpenUserSwitch} title={`Active User: ${currentUser.name} (${currentUser.role})`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-stone-700 to-stone-600 border border-white/20 text-white font-bold text-[10px] flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-sm">
                {currentUser.name.charAt(0)}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={() => showToast('Connecting to POS Live Dispatch Chat...')} title="Live Chat Support" className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center justify-center text-white shadow-lg hover:shadow-emerald-900/40 hover:scale-105 transition-all duration-200 cursor-pointer border border-emerald-400/20">
              <MessageSquare className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>

        {/* Order Stream */}
        <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
          
          <div className="flex flex-col gap-1.5 p-2 shrink-0 bg-[#161616]/80 border-b border-white/5 backdrop-blur-xs">
            <div className="flex bg-stone-950/80 rounded-xl p-0.5 border border-white/5 shadow-inner">
              <button 
                onClick={() => setOrderStreamTab('ongoing')} 
                className={`flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${orderStreamTab === 'ongoing' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-400/20' : 'text-stone-400 hover:text-white'}`}
              >
                Ongoing
              </button>
              <button 
                onClick={() => setOrderStreamTab('all')} 
                className={`flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${orderStreamTab === 'all' ? 'bg-stone-800 text-white shadow-sm border border-white/10' : 'text-stone-400 hover:text-white'}`}
              >
                All Orders
              </button>
            </div>
            
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchOrdersInput}
                  onChange={(e) => setSearchOrdersInput(e.target.value)}
                  className="w-full bg-stone-950/80 border border-white/10 rounded-xl pl-2.5 pr-2 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>
              <button onClick={() => { setSearchOrdersInput(''); showToast('Ongoing orders list refreshed'); }} className="bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white p-1.5 rounded-xl cursor-pointer shrink-0 border border-white/5 transition-all hover:scale-105">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (onOpenOrdersView) onOpenOrdersView(); }} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white p-1.5 rounded-xl cursor-pointer shrink-0 border border-emerald-400/20 shadow-sm transition-all hover:scale-105">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
            <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
              {ongoingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-500 space-y-2">
                  <Database className="w-8 h-8 stroke-1 text-stone-700" />
                  <p className="text-xs font-semibold">No active orders</p>
                </div>
              ) : (
                ongoingOrders.map((ord) => {
                  const isSelected = selectedOrderId === ord.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                      }}
                      className={`bg-gradient-to-b from-stone-900/90 to-stone-950/90 rounded-xl p-2.5 text-xs transition-all duration-200 cursor-pointer border ${isSelected ? 'border-emerald-500/60 ring-1 ring-emerald-500/40 bg-stone-900 shadow-lg shadow-emerald-950/20' : 'border-white/5 hover:border-emerald-500/30 hover:shadow-md'}`}
                    >
                      <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-1.5">
                        <span className="font-mono text-stone-200 font-bold">#{ord.orderNumber.replace('ORD-', '')}</span>
                        <span className="text-emerald-400 font-black font-mono">PKR {ord.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-1.5">
                        <span className="capitalize font-medium">{ord.type.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${getStatusBadgeStyle(ord.status)}`}>
                          {getStatusLabel(ord.status)}
                        </span>
                      </div>
                      <div className="text-stone-300 text-[11px] truncate leading-tight mb-2 font-normal">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                        {ord.status !== 'dispatched' && ord.status !== 'delivered' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickDispatch(ord); }}
                            className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 flex-1 hover:scale-[1.02] cursor-pointer"
                          >
                            {ord.status === 'pending' || ord.status === 'open' || ord.status === 'PUNCHED' ? 'To Kitchen' : 'Dispatch'}
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCashout(ord); }}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 flex-1 hover:scale-[1.02] cursor-pointer shadow-xs"
                        >
                          Cashout
                        </button>
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickEdit(ord); }}
                            className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCancel(ord.id, ord.orderNumber); }}
                            className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 2: CENTER PANE (Order Construction, Approx 28% width)                */}
      {/* ========================================================================= */}
      <div className="w-[30%] xl:w-[28%] flex flex-col h-full bg-gradient-to-b from-[#131313] to-[#0c0c0c] border-r border-white/5 relative overflow-hidden justify-between">
        <div className="flex flex-col p-2 gap-1.5 shrink-0 bg-[#161616]/90 border-b border-white/5 backdrop-blur-xs">
          {/* Row 1: Select Outlet */}
          <div className="flex items-center gap-1.5">
            <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 cursor-pointer transition-all">
              <option value="">Select Outlet</option>
              {outlets.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={() => showToast('WhatsApp Sync Status')} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-emerald-400/20"><Check className="w-4 h-4 stroke-[3]" /></button>
            <button onClick={handleResetTicket} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-red-400/20"><X className="w-4 h-4 stroke-[3]" /></button>
          </div>
          
          {/* Row 2: Order Type & Source */}
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-xl overflow-hidden shrink-0 border border-white/10 bg-stone-950/80 p-0.5 shadow-inner">
              <button onClick={() => setPosOrderType('dine_in')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'dine_in' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm border border-amber-400/30' : 'text-stone-400 hover:text-white'}`}>DineIn</button>
              <button onClick={() => setPosOrderType('takeaway')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'takeaway' ? 'bg-gradient-to-r from-stone-700 to-stone-800 text-white shadow-sm border border-white/10' : 'text-stone-400 hover:text-white'}`}>TakeAway</button>
              <button onClick={() => setPosOrderType('delivery')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'delivery' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-400/30' : 'text-stone-400 hover:text-white'}`}>Delivery</button>
            </div>
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 cursor-pointer transition-all">
              <option value="Pos">Select Source</option>
              <option value="Blink Co Mobile">Blink Co Mobile</option>
              <option value="Website Web">Website Web</option>
              <option value="Call Center">Call Center</option>
            </select>
          </div>
          
          {/* Row 3: Customer Input */}
          <div className="flex items-center gap-1.5">
            <input type="text" placeholder="Search Customer Phone" value={phoneSearchInput} onChange={(e) => setPhoneSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneLookup(undefined, true); }} className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 min-w-0 transition-all" />
            <button onClick={() => setIsCustomerManageModalOpen(true)} className="bg-stone-800 hover:bg-stone-700 text-white px-2.5 py-1.5 rounded-xl shrink-0 text-[11px] font-bold font-mono cursor-pointer border border-white/10 transition-all hover:scale-105">{'>'}</button>
            <button onClick={() => handlePhoneLookup(undefined, true)} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 border border-emerald-400/20 shadow-sm"><Search className="w-3.5 h-3.5" /></button>
          </div>
          
          {/* Customer Details Display Area */}
          {customerLookupStatus === 'new' ? (
            <div className="bg-stone-950/90 border border-white/5 rounded-xl p-1.5 mt-0.5 flex flex-col gap-1.5 shadow-inner">
               <input type="text" placeholder="Customer Name (Required)" value={posCart.customer?.name || ''} onChange={(e) => setPosCustomerField('name', e.target.value)} className="bg-stone-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 w-full" />
               <input type="text" placeholder="Address (Optional)" value={posCart.customer?.address || ''} onChange={(e) => setPosCustomerField('address', e.target.value)} className="bg-stone-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 w-full" />
            </div>
          ) : customerLookupStatus === 'found' && posCart.customer ? (
            <div className="bg-stone-950/90 border border-white/5 rounded-xl p-2 mt-0.5 flex justify-between items-center shadow-inner">
               <span className="font-bold text-white text-xs truncate ml-1">{posCart.customer.name}</span>
               <button onClick={() => setIsCustomerModalOpen(true)} className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 hover:text-emerald-300 cursor-pointer underline mr-1">View Info</button>
            </div>
          ) : null}
        </div>

        {/* Active Ticket Cart Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-transparent no-scrollbar">
           {posCart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-600 space-y-2">
                 <ChefHat className="w-8 h-8 stroke-1 text-stone-700" />
                 <p className="text-xs font-semibold text-stone-500">Active Ticket is Empty</p>
              </div>
           ) : (
              posCart.items.map((cartItem) => (
                <div key={cartItem.id} className="bg-gradient-to-r from-stone-900/90 to-stone-950/90 border border-white/5 rounded-xl p-2 flex items-center justify-between text-xs hover:border-emerald-500/30 transition-all duration-200 shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-semibold text-stone-100 truncate text-[11px]">{cartItem.name}</div>
                    {cartItem.flavor && <div className="text-[10px] text-emerald-400 font-medium truncate">{cartItem.flavor}</div>}
                    {cartItem.modifiers && cartItem.modifiers.length > 0 && <div className="text-[9px] text-stone-400 truncate">+{cartItem.modifiers.map(m=>m.name).join(', ')}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 bg-stone-950/90 border border-white/5 rounded-lg p-0.5">
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity - 1)} className="w-5 h-5 rounded-md bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Minus className="w-2.5 h-2.5" /></button>
                    <span className="w-4 text-center font-mono font-bold text-white text-[11px]">{cartItem.quantity}</span>
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity + 1)} className="w-5 h-5 rounded-md bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Plus className="w-2.5 h-2.5" /></button>
                  </div>
                  <div className="text-right shrink-0 pl-2 min-w-[55px]">
                    <span className="font-mono font-black text-emerald-400 text-xs block truncate">{Number(cartItem.price * cartItem.quantity).toLocaleString()}</span>
                    <button onClick={() => removeFromPosCart(cartItem.id)} className="text-stone-500 hover:text-red-400 text-[10px] transition cursor-pointer font-bold mt-0.5">X</button>
                  </div>
                </div>
              ))
           )}
        </div>

        {/* Bottom Action Controls */}
        <div className="p-2.5 bg-gradient-to-t from-[#141414] to-[#181818] border-t border-white/5 space-y-2 shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-12 bg-stone-950 border border-white/10 rounded-xl py-2 text-center font-mono font-bold text-xs text-stone-300 shadow-inner">0</div>
            <button onClick={() => setShowDiscountPrompt(true)} className="flex-1 bg-stone-900 hover:bg-stone-800 border border-white/10 hover:border-emerald-500/30 text-stone-200 font-bold text-[11px] py-2 px-2 rounded-xl cursor-pointer transition-all duration-150 text-center shadow-sm truncate">Discount {posCart.discountPercent > 0 ? `${(cartSubtotal * (posCart.discountPercent / 100)).toFixed(0)}(${posCart.discountPercent}%)` : '0(0%)'}</button>
            <button onClick={() => setShowChargesPrompt(true)} className="flex-1 bg-stone-900 hover:bg-stone-800 border border-white/10 hover:border-emerald-500/30 text-stone-200 font-bold text-[11px] py-2 px-2 rounded-xl cursor-pointer transition-all duration-150 text-center shadow-sm truncate">Charges {posCart.tipAmount || 0}</button>
          </div>
          {posCart.orderType === 'dine_in' && (
            <div className="flex gap-2 w-full">
              <select
                value={posCart.tableNumber || ''}
                onChange={(e) => setPosTableNumber(e.target.value)}
                className="flex-1 bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="">Select Table (Required)</option>
                {tables.filter(t => t.active !== false).map(t => (
                  <option key={t.id} value={t.number}>Table {t.number} ({t.capacity} Pax)</option>
                ))}
              </select>

              <select
                value={posCart.serverId || ''}
                onChange={(e) => {
                  const matched = users.find(u => u.id === e.target.value);
                  if (matched) {
                    setPosServer(matched.id, matched.name);
                  } else {
                    setPosServer('', '');
                  }
                }}
                className="flex-1 bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="">Select Server (Required)</option>
                {users.filter(u => u.role === 'server' && u.active !== false).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {posCart.orderType === 'delivery' && (
            <select
              value={posCart.deliveryDriver || ''}
              onChange={(e) => setPosDeliveryDriver(e.target.value)}
              className="w-full bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="">Assign Rider (Optional)</option>
              {users.filter(u => u.role === 'rider').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <input type="text" placeholder="Delivery Note" value={activeDeliveryNote} onChange={(e) => setActiveDeliveryNote(e.target.value)} className="w-full bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 transition-all" />
          <div className="flex items-center gap-2 pt-0.5">
            <label className="flex items-center gap-1.5 text-[11px] text-stone-400 font-bold uppercase tracking-wider cursor-pointer shrink-0 select-none">
              <input type="checkbox" checked={isPreOrder} onChange={(e) => setIsPreOrder(e.target.checked)} className="rounded border-white/10 bg-stone-900 text-emerald-500 focus:ring-0 cursor-pointer w-4 h-4" />
              PreOrder
            </label>
            <button onClick={handlePlaceOrder} disabled={isPunching} className={`flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-95 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-200 shadow-lg flex items-center justify-center gap-2 border border-emerald-400/20 ${punchSuccessAnimation ? 'from-emerald-500 to-teal-500' : ''}`}>
              {isPunching ? <span className="animate-pulse">Punching...</span> : punchSuccessAnimation ? <span>✓ Punched!</span> : <span>Place Order ({posCart.items.length === 0 ? '0' : `PKR ${cartTotal.toLocaleString()}`})</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 3: RIGHT MENU GRID (Approx 50% width)                                */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#131313] to-[#0c0c0c] relative overflow-hidden border-l border-white/5">
        
        {/* Top Category Strip & Search */}
        <div className="bg-[#161616]/95 border-b border-white/5 p-2 shrink-0 backdrop-blur-xs shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            {['all', 'deals', 'fried', 'square_pizza', 'desert', 'special_pizza', 'traditional_pizza', 'extra', 'pasta', 'crust_house', 'appetizers', 'beverages', 'fifa'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-xl whitespace-nowrap cursor-pointer transition-all duration-200 border ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-400/40 shadow-sm'
                    : 'bg-stone-900/80 text-stone-400 border-white/5 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'square_pizza' ? 'Square Pizza' : cat === 'special_pizza' ? 'Special Pizza' : cat === 'traditional_pizza' ? 'Traditional Pizza' : cat === 'crust_house' ? 'Crust House' : cat.replace('_', ' ')}
              </button>
            ))}
            
            <div className="flex items-center gap-1.5 flex-1 min-w-[160px] ml-auto">
               <input
                 type="text"
                 placeholder="Search menu items..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 min-w-0 transition-all"
               />
               <button onClick={() => setSearchQuery('')} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold px-2.5 py-1 text-xs rounded-xl cursor-pointer shrink-0 transition-all hover:scale-105 border border-red-400/20 shadow-sm">X</button>
            </div>
          </div>
        </div>

        {/* Visual Menu Grid */}
        <div className="flex-1 overflow-y-auto p-2 bg-transparent no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemTap(item)}
                className="border border-white/5 bg-gradient-to-b from-stone-900 to-stone-950 rounded-2xl flex flex-col overflow-hidden relative cursor-pointer hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] transition-all duration-200 h-[155px] group"
              >
                {/* Title */}
                <div className="px-2 pt-2 pb-1 text-center z-10 shrink-0 min-h-[38px] bg-stone-900/90 backdrop-blur-xs border-b border-white/5">
                  <h4 className="font-medium text-stone-100 text-[11px] leading-tight line-clamp-2 group-hover:text-emerald-300 transition-colors">
                    {item.name}
                  </h4>
                </div>

                {/* Image or background */}
                <div className="flex-1 relative w-full h-full flex items-end justify-end overflow-hidden">
                  {item.image ? (
                     <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover rounded-t-2xl opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900 to-transparent" />
                  )}
                  {/* Price Badge */}
                  <div className="relative z-10 border border-white/10 bg-stone-950/90 backdrop-blur-xs px-2 py-1 text-xs font-black font-mono text-emerald-400 m-1.5 leading-none rounded-lg shadow-md">
                    PKR {item.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      
      {/* CASHOUT MODAL */}
      {isCashoutModalOpen && selectedOrderForCashout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-[420px] shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button onClick={() => setIsCashoutModalOpen(false)} className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">Process Cashout</h3>
            <p className="text-xs text-stone-400 mb-5">Order #{selectedOrderForCashout.orderNumber.replace('ORD-', '')}</p>
            
            <div className="bg-stone-950/80 rounded-xl p-5 text-center border border-white/5 mb-5 shadow-inner">
              <div className="text-[10px] tracking-wider text-stone-400 uppercase font-bold mb-1">AMOUNT DUE</div>
              <div className="text-3xl font-mono font-black text-emerald-400">
                PKR {selectedOrderForCashout.total.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button onClick={() => submitCashout('cash')} className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer border border-emerald-400/20 shadow-lg">
                💵 Cash Paid
              </button>
              <button onClick={() => submitCashout('card')} className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer border border-white/10 shadow-md">
                💳 Credit / Debit Card
              </button>
              <button onClick={() => submitCashout('online')} className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer border border-white/10 shadow-md">
                🌐 Online Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLAVOR & VARIANT PICKER MODAL                                             */}
      {/* ========================================================================= */}
      {activeFlavorModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-stone-100 text-sm">
                Select Flavor: {activeFlavorModalItem.name}
              </h3>
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {activeFlavorModalItem.flavors?.map((flavor) => (
                <button
                  key={flavor}
                  onClick={() => setSelectedFlavor(flavor)}
                  className={`w-full p-2.5 text-xs font-semibold rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                    selectedFlavor === flavor
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-400/40 shadow-sm'
                      : 'bg-stone-950/60 text-stone-300 border-white/5 hover:bg-stone-800/80 hover:text-white'
                  }`}
                >
                  {flavor}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFlavor}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-md border border-emerald-400/20"
              >
                Add to Ticket (PKR {activeFlavorModalItem.price})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCOUNT MODAL PROMPT                                                     */}
      {/* ========================================================================= */}
      {showDiscountPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-stone-100 text-sm">Apply Order Discount (%)</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="flex-1 bg-stone-950 border border-white/10 rounded-xl p-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Discount % (e.g. 10)"
              />
              <span className="font-bold text-stone-400 text-sm">%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscountInput(d.toString())}
                  className="py-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 rounded-lg text-xs font-bold text-stone-200 transition-all cursor-pointer hover:scale-105"
                >
                  {d}%
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowDiscountPrompt(false)}
                className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-semibold text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md border border-emerald-400/20 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXTRA CHARGES MODAL PROMPT                                                */}
      {/* ========================================================================= */}
      {showChargesPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-stone-100 text-sm">Add Extra Service Charges (PKR)</h3>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-400 text-xs">PKR</span>
              <input
                type="number"
                min="0"
                value={chargesInput}
                onChange={(e) => setChargesInput(e.target.value)}
                className="flex-1 bg-stone-950 border border-white/10 rounded-xl p-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Charges amount"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowChargesPrompt(false)}
                className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-semibold text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCharges}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md border border-emerald-400/20 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER EDIT / FORM MODAL                                                */}
      {/* ========================================================================= */}
      <CustomerManageModal
        isOpen={isCustomerManageModalOpen}
        onClose={() => setIsCustomerManageModalOpen(false)}
        title={posCart.customer?.name ? "Edit Customer Details" : "New Customer Details"}
        initialData={{
          name: posCart.customer?.name || '',
          phone: posCart.customer?.phone || phoneSearchInput || '',
          address: posCart.customer?.address || '',
          notes: posCart.customer?.notes || '',
        }}
        onSave={async (data) => {
          setPosCustomerField('phone', data.phone);
          setPosCustomerField('name', data.name);
          setPosCustomerField('address', data.address);
          setPosCustomerField('notes', data.notes || '');
          setPhoneSearchInput(data.phone);
          try {
            await upsertCustomer({
              name: data.name,
              phone: data.phone,
              address: data.address,
              notes: data.notes,
            });
            showToast(`✓ Saved customer: ${data.name}`);
          } catch (e) {
            console.error(e);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* CUSTOMER HISTORY VIEW MODAL                                               */}
      {/* ========================================================================= */}
      <CustomerViewModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={foundCustomer}
        pastOrders={[]}
      />

      {/* ========================================================================= */}
      {/* MANAGER ORDER EDIT & AUDIT MODAL                                          */}
      {/* ========================================================================= */}
      <OrderEditCancelModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedOrderForEdit(null);
        }}
        order={selectedOrderForEdit}
      />

      {/* ========================================================================= */}
      {/* CUSTOMER PRINTABLE RECEIPT MODAL                                          */}
      {/* ========================================================================= */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedOrderForReceipt(null);
        }}
        order={selectedOrderForReceipt}
      />

      {/* ========================================================================= */}
      {/* SHIFT CLOSE & DENOMINATION MATRIX MODAL                                   */}
      {/* ========================================================================= */}
      <ShiftCloseModal
        isOpen={isShiftCloseOpen}
        onClose={() => setIsShiftCloseOpen(false)}
      />
    </div>
  );
};
