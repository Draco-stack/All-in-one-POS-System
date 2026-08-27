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
}

export const POSWorkstation: React.FC<POSWorkstationProps> = ({
  onOpenUserSwitch,
  onOpenOrdersView,
  onOpenAdminDashboard,
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
      nextStatus = order.orderType === 'delivery' ? 'dispatched' : 'ready';
    } else if (order.status === 'dispatched' || order.status === 'ready' || order.status === 'delivered') {
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
        return 'Cooking';
      case 'ready':
        return 'Ready';
      case 'dispatched':
        return 'With Rider';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  };

  // Filter Ongoing Orders for Left Section
  const ongoingOrders = useMemo(() => {
    return orders.filter((o) => {
      const isOngoing = ['pending', 'PUNCHED', 'MODIFIED', 'open', 'in_kitchen', 'ready', 'dispatched'].includes(
        o.status
      );
      if (!isOngoing) return false;
      if (!searchOrdersInput) return true;
      const q = searchOrdersInput.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(q))
      );
    });
  }, [orders, searchOrdersInput]);

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
    <div className="w-full h-full flex flex-row overflow-hidden bg-[#2b2b2b] text-[#E0E0E0] font-sans select-none no-scrollbar">
      
      {/* ========================================================================= */}
      {/* PANE 1: LEFT SIDEBAR & ORDER STREAM (Approx 20% width)                    */}
      {/* ========================================================================= */}
      <div className="w-[22%] xl:w-[20%] flex flex-row h-full shrink-0 border-r border-stone-800 bg-[#111111] z-10">
        
        {/* Far-Left Icon Strip */}
        <div className="w-11 bg-[#1a1a1a] border-r border-stone-800 flex flex-col items-center justify-between py-2 shrink-0">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center font-black text-2xl text-white select-none tracking-tighter">
              H
            </div>

            <button onClick={() => showToast('Support & Intercom audio connected')} title="Audio / Intercom" className="p-1 rounded text-stone-300 hover:text-white transition cursor-pointer">
              <Headphones className="w-5 h-5 stroke-[2]" />
            </button>

            <button onClick={() => showToast('Terminal brightness optimized')} title="Terminal Night Mode" className="p-1 rounded text-stone-300 hover:text-white transition cursor-pointer">
              <Moon className="w-5 h-5 fill-current" />
            </button>

            <button onClick={() => setIsShiftCloseOpen(true)} title="End-of-Shift Denomination Counter" className="w-8 h-8 rounded hover:bg-stone-800 flex items-center justify-center text-stone-300 transition cursor-pointer">
              <Calculator className="w-4 h-4" />
            </button>

            {onOpenAdminDashboard && (
              <button onClick={onOpenAdminDashboard} title="Executive Administrative Console & Sales Dashboard" className="w-8 h-8 rounded hover:bg-stone-800 flex items-center justify-center text-stone-300 transition cursor-pointer">
                <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
              </button>
            )}

            {onOpenUserSwitch && (
              <button onClick={onOpenUserSwitch} title={`Active User: ${currentUser.name} (${currentUser.role})`} className="w-7 h-7 rounded-full bg-stone-700 border border-stone-600 text-white font-bold text-[10px] flex items-center justify-center cursor-pointer hover:bg-stone-600 transition">
                {currentUser.name.charAt(0)}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={() => showToast('Connecting to POS Live Dispatch Chat...')} title="Live Chat Support" className="w-8 h-8 rounded-full bg-[#1e7e4a] flex items-center justify-center text-white shadow-md hover:bg-[#137333] transition cursor-pointer">
              <MessageSquare className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>

        {/* Order Stream */}
        <div className="flex-1 flex flex-col h-full bg-[#111111] overflow-hidden">
          
          <div className="flex flex-col gap-1 p-1 shrink-0 bg-[#111111]">
            <button onClick={() => showToast('Showing all orders')} className="bg-[#1e7e4a] text-white text-[12px] font-bold px-2 py-1.5 rounded cursor-pointer w-full shadow-xs text-center border border-[#1e7e4a]">
              Blink Co Orders
            </button>

            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="search orders"
                value={searchOrdersInput}
                onChange={(e) => setSearchOrdersInput(e.target.value)}
                className="bg-[#222222] border border-stone-700 rounded px-1.5 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] flex-1 min-w-0"
              />
              <button onClick={() => { setSearchOrdersInput(''); showToast('Ongoing orders list refreshed'); }} className="bg-stone-800 hover:bg-stone-700 text-white p-1 rounded cursor-pointer shrink-0 border border-stone-700">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (onOpenOrdersView) onOpenOrdersView(); }} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded cursor-pointer shrink-0 border border-[#1e7e4a]">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-[#111111]">
            <div className="flex-1 overflow-y-auto p-1 space-y-1.5 no-scrollbar">
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
                      className={`bg-[#1c1c1c] rounded p-2 text-xs transition cursor-pointer hover:border-[#1e7e4a] border ${isSelected ? 'border-[#1e7e4a] ring-1 ring-[#1e7e4a]' : 'border-stone-800'}`}
                    >
                      <div className="flex justify-between items-center border-b border-stone-800 pb-1 mb-1">
                        <span className="font-mono text-white font-semibold">#{ord.orderNumber.replace('ORD-', '')}</span>
                        <span className="text-[#1e7e4a] font-bold">PKR {ord.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-1">
                        <span className="capitalize">{ord.type}</span>
                        <span>•</span>
                        <span>{ord.status}</span>
                      </div>
                      <div className="text-stone-300 text-[11px] truncate leading-tight mb-2">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-stone-800/80">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickDispatch(ord); }}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded text-[10px] font-bold transition flex-1"
                        >
                          Dispatch
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCashout(ord); }}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded text-[10px] font-bold transition flex-1"
                        >
                          Cashout
                        </button>
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickEdit(ord); }}
                            className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold transition"
                          >
                            Edit
                          </button>
                        )}
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCancel(ord.id, ord.orderNumber); }}
                            className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold transition"
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
      <div className="w-[30%] xl:w-[28%] flex flex-col h-full bg-[#111111] border-r border-stone-800 relative overflow-hidden justify-between">
        <div className="flex flex-col p-1 gap-1 shrink-0 bg-[#1a1a1a]">
          {/* Row 1: Select Outlet */}
          <div className="flex items-center gap-1">
            <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-[#1e7e4a] flex-1 cursor-pointer">
              <option value="">Select Outlet</option>
              {outlets.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={() => showToast('WhatsApp Sync Status')} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded shrink-0 cursor-pointer"><Check className="w-4 h-4 stroke-[3]" /></button>
            <button onClick={handleResetTicket} className="bg-[#c82333] hover:bg-[#bd2130] text-white p-1 rounded shrink-0 cursor-pointer"><X className="w-4 h-4 stroke-[3]" /></button>
          </div>
          
          {/* Row 2: Order Type & Source */}
          <div className="flex items-center gap-1">
            <div className="flex rounded overflow-hidden shrink-0 border border-stone-700">
              <button onClick={() => setPosOrderType('takeaway')} className={`px-2 py-1 text-xs font-bold transition cursor-pointer ${posCart.orderType === 'takeaway' ? 'bg-[#333333] text-white' : 'bg-[#222222] text-stone-400 hover:bg-[#333333]'}`}>TakeAway</button>
              <button onClick={() => setPosOrderType('delivery')} className={`px-2 py-1 text-xs font-bold transition cursor-pointer ${posCart.orderType === 'delivery' ? 'bg-[#1e7e4a] text-white' : 'bg-[#222222] text-stone-400 hover:bg-[#333333]'}`}>Delivery</button>
            </div>
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-[#1e7e4a] flex-1 cursor-pointer">
              <option value="Pos">Select Source</option>
              <option value="Blink Co Mobile">Blink Co Mobile</option>
              <option value="Website Web">Website Web</option>
              <option value="Call Center">Call Center</option>
            </select>
          </div>
          
          {/* Row 3: Customer Input */}
          <div className="flex items-center gap-1">
            <input type="text" placeholder="Search Customer Phone" value={phoneSearchInput} onChange={(e) => setPhoneSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneLookup(undefined, true); }} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] flex-1 min-w-0" />
            <button onClick={() => setIsCustomerManageModalOpen(true)} className="bg-[#1e7e4a] hover:bg-[#137333] text-white px-2 py-1 rounded shrink-0 text-[10px] font-bold font-mono cursor-pointer">{'>'}</button>
            <button onClick={() => handlePhoneLookup(undefined, true)} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded shrink-0 cursor-pointer"><Search className="w-3.5 h-3.5" /></button>
          </div>
          
          {/* Customer Details Display Area */}
          {customerLookupStatus === 'new' ? (
            <div className="bg-[#111111] border border-stone-800 rounded p-1 mt-1 flex flex-col gap-1">
               <input type="text" placeholder="Customer Name (Required)" value={posCart.customer?.name || ''} onChange={(e) => setPosCustomerField('name', e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] w-full" />
               <input type="text" placeholder="Address (Optional)" value={posCart.customer?.address || ''} onChange={(e) => setPosCustomerField('address', e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] w-full" />
            </div>
          ) : customerLookupStatus === 'found' && posCart.customer ? (
            <div className="bg-[#111111] border border-stone-800 rounded p-1 mt-1 flex justify-between items-center">
               <span className="font-bold text-white text-[11px] truncate ml-1">{posCart.customer.name}</span>
               <button onClick={() => setIsCustomerModalOpen(true)} className="text-[10px] text-[#1e7e4a] hover:text-[#137333] font-bold cursor-pointer underline mr-1">View Info</button>
            </div>
          ) : null}
        </div>

        {/* Active Ticket Cart Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-[#111111] no-scrollbar">
           {posCart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-600 space-y-2">
                 <ChefHat className="w-8 h-8 stroke-1 text-stone-800" />
                 <p className="text-xs font-semibold">Active Ticket is Empty</p>
              </div>
           ) : (
              posCart.items.map((cartItem) => (
                <div key={cartItem.id} className="bg-[#1c1c1c] border border-stone-800 rounded p-1.5 flex items-center justify-between text-xs hover:border-[#1e7e4a] transition">
                  <div className="flex-1 min-w-0 pr-1.5">
                    <div className="font-bold text-white truncate text-[11px]">{cartItem.name}</div>
                    {cartItem.flavor && <div className="text-[10px] text-emerald-500 truncate">{cartItem.flavor}</div>}
                    {cartItem.modifiers && cartItem.modifiers.length > 0 && <div className="text-[9px] text-stone-500 truncate">+{cartItem.modifiers.map(m=>m.name).join(', ')}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity - 1)} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Minus className="w-2.5 h-2.5" /></button>
                    <span className="w-4 text-center font-mono font-bold text-white text-[11px]">{cartItem.quantity}</span>
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity + 1)} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Plus className="w-2.5 h-2.5" /></button>
                  </div>
                  <div className="text-right shrink-0 pl-1.5 min-w-[50px]">
                    <span className="font-mono font-bold text-amber-400 text-[10px] block truncate">{Number(cartItem.price * cartItem.quantity).toLocaleString()}</span>
                    <button onClick={() => removeFromPosCart(cartItem.id)} className="text-stone-500 hover:text-red-500 text-[9px] transition cursor-pointer font-bold">X</button>
                  </div>
                </div>
              ))
           )}
        </div>

        {/* Bottom Action Controls */}
        <div className="p-1.5 bg-[#1a1a1a] border-t border-stone-800 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-12 bg-[#222222] border border-stone-700 rounded py-1.5 text-center font-mono font-bold text-xs text-white">0</div>
            <button onClick={() => setShowDiscountPrompt(true)} className="flex-1 bg-[#1e7e4a] hover:bg-[#137333] text-white font-bold text-[11px] py-1.5 px-2 rounded cursor-pointer transition text-center shadow-xs truncate">Discount {posCart.discountPercent > 0 ? `${(cartSubtotal * (posCart.discountPercent / 100)).toFixed(0)}(${posCart.discountPercent}%)` : '0(0%)'}</button>
            <button onClick={() => setShowChargesPrompt(true)} className="flex-1 bg-[#1e7e4a] hover:bg-[#137333] text-white font-bold text-[11px] py-1.5 px-2 rounded cursor-pointer transition text-center shadow-xs truncate">Charges {posCart.tipAmount || 0}</button>
          </div>
          {posCart.orderType === 'delivery' && (
            <select
              value={posCart.deliveryDriver || ''}
              onChange={(e) => setPosDeliveryDriver(e.target.value)}
              className="w-full bg-[#222222] border border-stone-700 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#1e7e4a] cursor-pointer"
            >
              <option value="">Assign Rider (Optional)</option>
              {users.filter(u => u.role === 'rider').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <input type="text" placeholder="Delivery Note" value={activeDeliveryNote} onChange={(e) => setActiveDeliveryNote(e.target.value)} className="w-full bg-[#222222] border border-stone-700 rounded px-2 py-1.5 text-[11px] text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a]" />
          <div className="flex items-center gap-2 pt-0.5">
            <label className="flex items-center gap-1 text-[11px] text-stone-400 font-semibold cursor-pointer shrink-0">
              <input type="checkbox" checked={isPreOrder} onChange={(e) => setIsPreOrder(e.target.checked)} className="rounded border-stone-700 bg-[#333333] text-[#1e7e4a] focus:ring-0 cursor-pointer w-3.5 h-3.5" />
              PreOrder
            </label>
            <button onClick={handlePlaceOrder} disabled={isPunching} className={`flex-1 bg-[#1e7e4a] hover:bg-[#137333] active:scale-[0.99] text-white font-bold text-xs py-2 px-4 rounded cursor-pointer transition shadow flex items-center justify-center gap-2 ${punchSuccessAnimation ? 'bg-emerald-600' : ''}`}>
              {isPunching ? <span className="animate-pulse">...</span> : punchSuccessAnimation ? <span>✓ Punched!</span> : <span>Place Order ({posCart.items.length === 0 ? '0' : cartTotal.toLocaleString()})</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 3: RIGHT MENU GRID (Approx 50% width)                                */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full bg-[#111111] relative overflow-hidden border-l border-stone-800">
        
        {/* Top Category Strip & Search */}
        <div className="bg-[#1a1a1a] border-b border-stone-800 p-1.5 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            {['all', 'deals', 'fried', 'square_pizza', 'desert', 'special_pizza', 'traditional_pizza', 'extra', 'pasta', 'crust_house', 'appetizers', 'beverages', 'fifa'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-xs whitespace-nowrap cursor-pointer transition ${
                  selectedCategory === cat
                    ? 'bg-[#c82333] text-white shadow-xs'
                    : 'bg-[#222222] text-stone-300 hover:bg-[#333333]'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'square_pizza' ? 'Square Pizza' : cat === 'special_pizza' ? 'Special Pizza' : cat === 'traditional_pizza' ? 'Traditional Pizza' : cat === 'crust_house' ? 'Crust House' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            
            <div className="flex items-center gap-1 flex-1 min-w-[150px] ml-auto">
               <input
                 type="text"
                 placeholder="Item Search"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-[#222222] border border-stone-700 rounded-xs px-2 py-0.5 text-[11px] text-white placeholder:text-stone-500 focus:outline-none focus:border-[#c82333] flex-1 min-w-0"
               />
               <button onClick={() => setSearchQuery('')} className="bg-[#c82333] hover:bg-[#bd2130] text-white font-bold px-2 py-0.5 text-[11px] rounded-xs cursor-pointer shrink-0">X</button>
            </div>
          </div>
        </div>

        {/* Visual Menu Grid */}
        <div className="flex-1 overflow-y-auto p-1.5 bg-[#111111] no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemTap(item)}
                className="border border-stone-700 bg-[#1c1c1c] rounded-sm flex flex-col overflow-hidden relative cursor-pointer hover:border-[#1e7e4a] active:scale-[0.98] transition h-[150px]"
              >
                {/* Title */}
                <div className="px-1.5 pt-1.5 pb-1 text-center z-10 shrink-0 min-h-[36px] bg-[#1c1c1c]">
                  <h4 className="font-medium text-white text-[11px] leading-tight line-clamp-2">
                    {item.name}
                  </h4>
                </div>

                {/* Image or empty space */}
                <div className="flex-1 relative w-full h-full flex items-end justify-end">
                  {item.image && (
                     <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                  )}
                  {/* Price Badge */}
                  <div className="relative z-10 border border-stone-400 bg-[#111111] px-1.5 py-0.5 text-[11px] font-mono text-white m-1 leading-none rounded-sm">
                    {item.price}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111111] border border-stone-800 rounded-xl w-[400px] shadow-2xl p-6 relative">
            <button onClick={() => setIsCashoutModalOpen(false)} className="absolute top-4 right-4 text-stone-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Process Cashout</h3>
            <p className="text-stone-400 mb-6">Order #{selectedOrderForCashout.orderNumber.replace('ORD-', '')}</p>
            
            <div className="bg-[#1a1a1a] rounded-lg p-6 text-center border border-stone-800 mb-6 shadow-inner">
              <div className="text-stone-400 text-sm font-semibold mb-1">AMOUNT DUE</div>
              <div className="text-4xl font-mono font-black text-[#1e7e4a]">
                PKR {selectedOrderForCashout.total.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => submitCashout('cash')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-lg transition border border-stone-700">
                💵 Cash Paid
              </button>
              <button onClick={() => submitCashout('card')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-[#1e7e4a]/20 hover:border-[#1e7e4a] hover:text-[#1e7e4a] text-white font-bold text-lg transition border border-stone-700">
                💳 Credit / Debit Card
              </button>
              <button onClick={() => submitCashout('online')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-[#c82333]/20 hover:border-[#c82333] hover:text-[#c82333] text-white font-bold text-lg transition border border-stone-700">
                🌐 Online Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLAVOR & VARIANT PICKER MODAL                                             */}
      {/* ========================================================================= */}
      {activeFlavorModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-bold text-stone-900 text-sm">
                Select Flavor: {activeFlavorModalItem.name}
              </h3>
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              {activeFlavorModalItem.flavors?.map((flavor) => (
                <button
                  key={flavor}
                  onClick={() => setSelectedFlavor(flavor)}
                  className={`w-full p-2 text-xs font-semibold rounded border text-left cursor-pointer transition ${
                    selectedFlavor === flavor
                      ? 'bg-[#00897b] text-white border-[#00897b]'
                      : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {flavor}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="px-3 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFlavor}
                className="px-4 py-1.5 rounded bg-[#00695c] hover:bg-[#005a4e] text-white text-xs font-bold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-lg max-w-xs w-full p-4 space-y-3 shadow-xl">
            <h3 className="font-bold text-stone-900 text-sm">Apply Order Discount (%)</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-300 rounded p-2 text-sm font-mono font-bold text-stone-900 focus:outline-none focus:border-[#00695c]"
                placeholder="Discount % (e.g. 10)"
              />
              <span className="font-bold text-stone-600 text-sm">%</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscountInput(d.toString())}
                  className="py-1 bg-stone-100 border border-stone-300 rounded text-xs font-bold text-stone-700 hover:bg-stone-200 cursor-pointer"
                >
                  {d}%
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                onClick={() => setShowDiscountPrompt(false)}
                className="px-3 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                className="px-4 py-1.5 rounded bg-[#00695c] text-white text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 rounded-lg max-w-xs w-full p-4 space-y-3 shadow-xl">
            <h3 className="font-bold text-stone-900 text-sm">Add Extra Service Charges (PKR)</h3>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-600 text-xs">PKR</span>
              <input
                type="number"
                min="0"
                value={chargesInput}
                onChange={(e) => setChargesInput(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-300 rounded p-2 text-sm font-mono font-bold text-stone-900 focus:outline-none focus:border-[#00695c]"
                placeholder="Charges amount"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                onClick={() => setShowChargesPrompt(false)}
                className="px-3 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCharges}
                className="px-4 py-1.5 rounded bg-[#00695c] text-white text-xs font-bold"
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
