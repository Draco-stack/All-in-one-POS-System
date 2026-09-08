import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Headphones,
  Moon,
  Sun,
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
  Users,
  Eye,
  CreditCard,
  Globe,
  Coins,
  Banknote,
  ArrowRight, History,
  Save,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, Order, Customer, OrderStatus } from '../../types';
import { ShiftCloseModal } from '../shift/ShiftCloseModal';
import { CustomerViewModal } from './CustomerViewModal';
import { CustomerManageModal } from './CustomerManageModal';
import { BlockCustomerModal } from './BlockCustomerModal';
import { ManagerAuthModal } from '../auth/ManagerAuthModal';
import { BlockedCustomerAlertModal } from './BlockedCustomerAlertModal';
import { OrderEditCancelModal } from '../orders/OrderEditCancelModal';
import { CancelOrderModal } from '../orders/CancelOrderModal';
import { ReceiptModal } from '../orders/ReceiptModal';
import { CustomerHistoryView } from '../history/CustomerHistoryView';
import { CategoryIcon, getCategoryIcon } from '../../utils/categoryIcons';
import { MenuItemThumbnail } from '../common/MenuItemThumbnail';
import { MasterPOSLogo } from '../common/MasterPOSLogo';
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
    theme,
    toggleTheme,
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
    blockCustomer,
    unblockCustomer,
    isCustomerBlocked,
    customers,
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
    logoutUser,
    currentShift,
    users,
    outlets,
    tables,
    deliveryDrivers,
    isRestricted,
  } = useRestaurant();

  const [, startTransition] = useTransition();

  // Tab View for Middle Section: 'active_ticket' | 'order_details' | 'all_orders'
  const [middleTab, setMiddleTab] = useState<'active_ticket' | 'order_details' | 'all_orders'>('active_ticket');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState<string>('all');
  const [allOrdersSearch, setAllOrdersSearch] = useState<string>('');
  const [receiptInitialMode, setReceiptInitialMode] = useState<'receipt' | 'kot'>('receipt');
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  // Block Customer Modals State
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockTargetPhone, setBlockTargetPhone] = useState('');
  const [blockTargetName, setBlockTargetName] = useState('');
  const [isBlockedAlertOpen, setIsBlockedAlertOpen] = useState(false);
  const [blockedAlertCustomer, setBlockedAlertCustomer] = useState<Customer | null>(null);
  const [blockedAlertPhone, setBlockedAlertPhone] = useState('');

  // Currently selected order for Order Details view
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return orders[0] || null;
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null;
  }, [orders, selectedOrderId]);

  // Filtered orders for All Orders view
  const filteredAllOrders = useMemo(() => {
    const seen = new Set<string>();
    return orders.filter((ord) => {
      if (!ord || !ord.id || seen.has(ord.id)) return false;
      seen.add(ord.id);

      if (allOrdersStatusFilter === 'active') {
        if (ord.status === 'completed' || ord.status === 'cancelled' || ord.status === 'refunded') return false;
      } else if (allOrdersStatusFilter !== 'all') {
        const normStatus = (ord.status || '').toLowerCase();
        if (allOrdersStatusFilter === 'delivery') {
          if (normStatus !== 'dispatched' && ord.type !== 'delivery') return false;
        } else if (normStatus !== allOrdersStatusFilter.toLowerCase()) {
          return false;
        }
      }

      if (allOrdersSearch.trim()) {
        const q = allOrdersSearch.toLowerCase().trim();
        const num = (ord.orderNumber || '').toLowerCase();
        const phone = (ord.customer?.phone || '').toLowerCase();
        const name = (ord.customer?.name || '').toLowerCase();
        const table = (ord.tableNumber || '').toLowerCase();
        if (!num.includes(q) && !phone.includes(q) && !name.includes(q) && !table.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, allOrdersStatusFilter, allOrdersSearch]);

  // Active Flavor / Customization Modal
  const [activeFlavorModalItem, setActiveFlavorModalItem] = useState<MenuItem | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');

  // Discount & Charges Modals / Popups
  const [showDiscountPrompt, setShowDiscountPrompt] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [showChargesPrompt, setShowChargesPrompt] = useState(false);
  const [chargesInput, setChargesInput] = useState<string>('0');

  // Customer Management
  const [isCustomerHistoryOpen, setIsCustomerHistoryOpen] = useState<boolean>(false);
  const [phoneSearchInput, setPhoneSearchInput] = useState<string>(posCart.customer?.phone || '');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'found' | 'new' | 'idle'>('idle');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerManageModalOpen, setIsCustomerManageModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isClientDetailsCollapsed, setIsClientDetailsCollapsed] = useState<boolean>(false);

  // Clean phone digits helper for 11-digit Pakistan / standard phone format
  const cleanPhoneDigits = useMemo(() => phoneSearchInput.replace(/\D/g, ''), [phoneSearchInput]);

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
  const [isCashoutSubmitting, setIsCashoutSubmitting] = useState<boolean>(false);
  const cashoutLockRef = useRef<boolean>(false);
  const [cashoutPaymentMethod, setCashoutPaymentMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [cashoutTenderedInput, setCashoutTenderedInput] = useState<string>('');

  // Online / Offline & Punch Hardening
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const isPunchingRef = useRef<boolean>(false);
  const [punchSuccessAnimation, setPunchSuccessAnimation] = useState<boolean>(false);
  const lastPunchTimestampRef = useRef<number>(0);

  // Fullscreen & Section Layout Control
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' ? !!document.fullscreenElement : false
  );
  const [isLeftStreamCollapsed, setIsLeftStreamCollapsed] = useState<boolean>(
    () => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false)
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        showToast('⛶ Fullscreen mode enabled');
      } else {
        await document.exitFullscreen();
        showToast('Exit Fullscreen mode');
      }
    } catch (err) {
      console.warn('Fullscreen request issue:', err);
      showToast('Press F11 to toggle fullscreen in browser');
    }
  };

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

  const lastSearchedPhone = useRef<string>('');

  // Sync phoneSearchInput when customer changes externally (e.g., recalled order)
  useEffect(() => {
    if (posCart.customer?.phone !== undefined && posCart.customer.phone !== phoneSearchInput) {
      // If the context updated because of our own async search, ignore it so we don't erase user's active typing
      if (posCart.customer.phone === lastSearchedPhone.current) return;
      
      setPhoneSearchInput(posCart.customer.phone);
      lastSearchedPhone.current = posCart.customer.phone;
    }
  }, [posCart.customer?.phone, phoneSearchInput]);

  // Handle phone lookup - STRICTLY WHEN 11 DIGITS COMPLETES
  const handlePhoneLookup = async (phoneVal?: string, manual = false) => {
    const raw = (phoneVal !== undefined ? phoneVal : phoneSearchInput).trim();
    const cleanDigits = raw.replace(/\D/g, '');

    if (!cleanDigits) {
      if (manual) showToast('Please enter an 11-digit phone number (e.g. 03001234567)');
      return;
    }

    // Strictly fetch customer data ONLY when 11 digits phone number completes
    if (cleanDigits.length !== 11) {
      if (manual) {
        showToast(`⚠️ Please enter all 11 digits (current: ${cleanDigits.length}/11)`);
      }
      return;
    }
    
    lastSearchedPhone.current = cleanDigits;

    setIsSearchingCustomer(true);
    try {
      const result = await lookupCustomer(cleanDigits);
      if (result.found && result.customer) {
        setCustomerLookupStatus('found');
        setFoundCustomer(result.customer);
        setPosCustomerField('phone', result.customer.phone || cleanDigits);
        setPosCustomerField('name', result.customer.name);
        setPosCustomerField('address', result.customer.address || '');
        setPosCustomerField('notes', result.customer.notes || result.customer.deliveryNotes || '');
        
        // CHECK IF CUSTOMER IS BLOCKED
        if (result.customer.isBlocked) {
          setBlockedAlertCustomer(result.customer);
          setBlockedAlertPhone(cleanDigits);
          setIsBlockedAlertOpen(true);
          playErrorSound();
          showToast(`⛔ BLOCKED CUSTOMER: Can't place an order! (${result.customer.blockReason || 'Blocked'})`);
        } else if (manual) {
          showToast(`✓ Customer recognized: ${result.customer.name}`);
        }
      } else {
        // Also check if local blocked records contain this number
        const blockStatus = isCustomerBlocked(cleanDigits);
        if (blockStatus.blocked) {
          const blkCust = blockStatus.customer || {
            id: `blk-${cleanDigits}`,
            name: 'Blocked Customer',
            phone: cleanDigits,
            isBlocked: true,
            blockReason: blockStatus.reason,
            loyaltyPoints: 0,
            vipTier: 'Regular',
            totalOrdersCount: 0,
            totalSpent: 0,
            createdAt: new Date().toISOString(),
          };
          setCustomerLookupStatus('found');
          setFoundCustomer(blkCust);
          setPosCustomerField('phone', cleanDigits);
          setPosCustomerField('name', blkCust.name);
          setBlockedAlertCustomer(blkCust);
          setBlockedAlertPhone(cleanDigits);
          setIsBlockedAlertOpen(true);
          playErrorSound();
          showToast(`⛔ BLOCKED CUSTOMER: Can't place an order! (${blockStatus.reason || 'Blocked'})`);
        } else {
          setCustomerLookupStatus('new');
          setFoundCustomer(null);
          setPosCustomerField('phone', cleanDigits);
          // Do not clear name or address if user already typed one
          if (!posCart.customer?.name) {
            setPosCustomerField('name', '');
          }
          if (!posCart.customer?.address) {
            setPosCustomerField('address', '');
          }
          if (manual) showToast('ℹ️ New customer — please enter name and address below');
        }
      }
    } catch (err) {
      console.warn('Customer search issue:', err);
      setCustomerLookupStatus('new');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Debounced auto-fetch: TRIGGERS ONLY WHEN 11 DIGITS COMPLETES
  useEffect(() => {
    const clean = phoneSearchInput.replace(/\D/g, '');
    if (clean.length === 11) {
      const timer = setTimeout(() => {
        handlePhoneLookup(clean, false);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setCustomerLookupStatus('idle');
      setFoundCustomer(null);
    }
  }, [phoneSearchInput]);

  // Explicit Save New Customer Profile handler
  const handleSaveCustomerManually = async () => {
    const cleanDigits = (posCart.customer?.phone || phoneSearchInput).replace(/\D/g, '');
    const name = posCart.customer?.name?.trim();

    if (!name) {
      showToast('⚠️ Please enter customer name');
      return;
    }

    if (cleanDigits.length !== 11) {
      showToast(`⚠️ Customer phone must have 11 digits (current: ${cleanDigits.length}/11)`);
      return;
    }

    setIsSavingCustomer(true);
    try {
      const saved = await upsertCustomer({
        name,
        phone: cleanDigits,
        address: posCart.customer?.address || '',
        notes: activeDeliveryNote || posCart.customer?.notes || '',
      });

      setFoundCustomer(saved);
      setCustomerLookupStatus('found');
      setPosCustomerField('phone', saved.phone || cleanDigits);
      setPosCustomerField('name', saved.name);
      setPosCustomerField('address', saved.address || '');
      setPosCustomerField('notes', saved.notes || saved.deliveryNotes || '');
      showToast(`✓ Customer "${saved.name}" (${saved.phone}) successfully saved to database!`);
    } catch (err) {
      console.error('Failed to save customer:', err);
      showToast('❌ Failed to save customer to database');
    } finally {
      setIsSavingCustomer(false);
    }
  };

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

  // Memoize all unique menu categories (all categories from state + any on menu items, excluding duplicate 'all')
  const displayCategories = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    categories.forEach((cat) => {
      if (!cat || !cat.id) return;
      const norm = cat.id.toLowerCase().replace(/[-_ ]/g, '');
      if (norm === 'all') return;
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push({ id: cat.id, name: cat.name || cat.id });
      }
    });

    // Also include any categories defined on menuItems that might not be in categories list
    menuItems.forEach((item) => {
      if (!item.category) return;
      const norm = item.category.toLowerCase().replace(/[-_ ]/g, '');
      if (norm === 'all') return;
      if (!seen.has(norm)) {
        seen.add(norm);
        const name = item.category
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        list.push({ id: item.category, name });
      }
    });

    return list;
  }, [categories, menuItems]);

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
    // Immediate synchronous lock against race conditions or rapid double-clicks
    if (isPunchingRef.current || isPunching) {
      return;
    }

    const now = Date.now();
    if (now - lastPunchTimestampRef.current < 1500) {
      return; // Debounce guardrail
    }
    lastPunchTimestampRef.current = now;
    isPunchingRef.current = true;
    setIsPunching(true);

    try {
      // 0. Check if Customer is Blocked before placing order
      const targetPhone = (posCart.customer?.phone || phoneSearchInput || '').replace(/\D/g, '');
      const blockStatus = targetPhone ? isCustomerBlocked(targetPhone) : { blocked: false };
      const isBlocked = Boolean(posCart.customer?.isBlocked) || Boolean(foundCustomer?.isBlocked) || blockStatus.blocked;
      
      if (isBlocked) {
        const blkCust = (posCart.customer?.isBlocked ? (foundCustomer || posCart.customer as any) : (blockStatus.customer || foundCustomer)) || null;
        setBlockedAlertCustomer(blkCust);
        setBlockedAlertPhone(targetPhone);
        setIsBlockedAlertOpen(true);
        playErrorSound();
        showToast(`⛔ BLOCKED CUSTOMER: Blocked customer can't place an order!`);
        return;
      }

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

      if (posCart.orderType === 'delivery') {
        if (!posCart.deliveryDriver) {
          playErrorSound();
          showToast('⚠️ Please select a Delivery Rider. Rider selection is required for delivery orders.');
          return;
        }
      }

      if (posCart.customer?.phone && posCart.customer.name) {
        const cleanDigits = posCart.customer.phone.replace(/\D/g, '');
        if (cleanDigits.length >= 7) {
          await upsertCustomer({
            name: posCart.customer.name.trim(),
            phone: cleanDigits,
            address: posCart.customer.address || '',
            notes: activeDeliveryNote || posCart.customer.notes || '',
          });
        }
      }

      setPosNotes(activeDeliveryNote);
      const tendered = parseFloat(bottomInputVal) || 0;
      const createdOrder = await punchOrder(tendered > 0 ? tendered : undefined, selectedOutlet);

      playCashRegisterSound();
      setPunchSuccessAnimation(true);
      showToast(`✓ Order #${createdOrder.orderNumber} successfully placed!`);

      // Switch to Order Details view to see the live order, print receipt or KOT
      setSelectedOrderId(createdOrder.id);
      setMiddleTab('order_details');

      // Reset local fields
      setBottomInputVal('0');
      setActiveDeliveryNote('');
      setTimeout(() => setPunchSuccessAnimation(false), 1000);
    } catch (err: any) {
      console.error('Place order failed:', err);
      playErrorSound();
      showToast(`❌ Place order failed: ${err.message || 'Unknown error'}`);
    } finally {
      isPunchingRef.current = false;
      setIsPunching(false);
    }
  };

  // ==========================================
  // ONE-CLICK ACTION HANDLERS (Left Bar & Middle)
  // ==========================================
  const handleOneClickCancel = (orderId: string, orderNumber?: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      setCancellingOrder(target);
    }
  };

  const handleOneClickDispatch = (order: Order) => {
    if (order.status === 'completed' || order.status === 'cancelled') {
      return;
    }
    
    const isDelivery = order.type === 'delivery' || order.orderType === 'delivery';
    let nextStatus: OrderStatus = 'in_kitchen';

    if (
      order.status === 'pending' ||
      order.status === 'PUNCHED' ||
      order.status === 'open' ||
      order.status === 'MODIFIED'
    ) {
      nextStatus = 'in_kitchen';
    } else if (order.status === 'in_kitchen') {
      nextStatus = 'ready';
    } else if (order.status === 'ready') {
      if (isDelivery) {
        nextStatus = 'dispatched';
      } else {
        handleOneClickCashout(order);
        return;
      }
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
      ready: 'Ready',
      dispatched: 'Out for Delivery',
      completed: 'Completed',
    };
    showToast(`🚀 Order #${order.orderNumber} updated → ${labelMap[nextStatus] || nextStatus}`);
  };

  const handleOneClickCashout = (order: Order) => {
    setSelectedOrderForCashout(order);
    const initMethod = (order.paymentMethod?.toLowerCase() === 'card' || order.paymentMethod?.toLowerCase() === 'online')
      ? (order.paymentMethod.toLowerCase() as 'card' | 'online')
      : 'cash';
    setCashoutPaymentMethod(initMethod);
    setCashoutTenderedInput('');
    setIsCashoutModalOpen(true);
  };
  
  const submitCashout = async (
    method: 'cash' | 'card' | 'online',
    tenderedAmount?: number,
    changeGiven?: number
  ) => {
    if (!selectedOrderForCashout || cashoutLockRef.current || isCashoutSubmitting) return;

    cashoutLockRef.current = true;
    setIsCashoutSubmitting(true);

    try {
      let targetStatus = selectedOrderForCashout.status;
      const isDelivery = selectedOrderForCashout.type === 'delivery' || selectedOrderForCashout.orderType === 'delivery';

      if (isDelivery) {
         if (targetStatus === 'dispatched' || targetStatus === 'delivered' || targetStatus === 'ready') {
             targetStatus = targetStatus === 'ready' ? 'ready' : 'completed';
         }
      } else {
         targetStatus = 'completed';
      }

      const finalTendered = tenderedAmount ?? selectedOrderForCashout.total;
      const finalChange = changeGiven ?? 0;

      await updateOrderStatus(selectedOrderForCashout.id, targetStatus, { 
        paymentStatus: 'paid', 
        paymentMethod: method,
        amountTendered: finalTendered,
        changeGiven: finalChange,
      });
      playCashRegisterSound();
      
      if (targetStatus === 'completed') {
        showToast(`💵 Order #${selectedOrderForCashout.orderNumber.replace('ORD-', '')} paid via ${method.toUpperCase()} & closed! ${finalChange > 0 ? `(Change: PKR ${finalChange.toLocaleString()})` : ''}`);
      } else {
        showToast(`💵 Order #${selectedOrderForCashout.orderNumber.replace('ORD-', '')} marked as PAID via ${method.toUpperCase()}.`);
      }
      
      setIsCashoutModalOpen(false);
      setSelectedOrderForCashout(null);
      setCashoutTenderedInput('');
    } catch (err: any) {
      showToast(`❌ Cashout failed: ${err?.message || 'Error completing payment'}`);
    } finally {
      cashoutLockRef.current = false;
      setIsCashoutSubmitting(false);
    }
  };

  const handleOneClickEdit = (order: Order) => {
    setSelectedOrderForEdit(order);
    setIsEditModalOpen(true);
  };

  const handlePrintReceipt = (order: Order) => {
    setSelectedOrderForReceipt(order);
    setReceiptInitialMode('receipt');
    setIsReceiptModalOpen(true);
  };

  const handlePrintKOT = (order: Order) => {
    setSelectedOrderForReceipt(order);
    setReceiptInitialMode('kot');
    setIsReceiptModalOpen(true);
  };

  // Helper for Status Badge Styling with status light reflections
  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
      case 'open':
      case 'PUNCHED':
      case 'MODIFIED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.25)]';
      case 'in_kitchen':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/50 shadow-[0_0_8px_rgba(99,102,241,0.25)]';
      case 'ready':
      case 'completed':
      case 'delivered':
        // Reflects Green Light
        return 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.4)] ring-1 ring-emerald-400/30';
      case 'dispatched':
        // Reflects Yellow-Orange Light
        return 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)] ring-1 ring-orange-400/30';
      case 'cancelled':
      case 'refunded':
        // Reflects Red Light
        return 'bg-rose-500/25 text-rose-300 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/30';
      default:
        return 'bg-stone-500/20 text-stone-300 border-stone-400/40';
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
    const seen = new Set<string>();
    return orders.filter((o) => {
      if (!o || !o.id || seen.has(o.id)) return false;
      seen.add(o.id);

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
    lastSearchedPhone.current = '';
    setCustomerLookupStatus('idle');
    setFoundCustomer(null);
    setActiveDeliveryNote('');
    setIsPreOrder(false);
    setSelectedOutlet('Gulberg Branch');
    setSelectedSource('Pos');
  };

  return (
    <div className={`w-full h-full flex flex-row overflow-hidden font-sans select-none no-scrollbar transition-colors duration-200 ${
      isLeftStreamCollapsed ? 'pos-stream-collapsed' : ''
    } ${
      theme === 'dark' ? 'bg-[#0c0c0e] text-[#e4e4e7]' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {/* Far-Left Icon Strip */}
      <div className={`w-[64px] shrink-0 border-r flex flex-col items-center justify-between py-4 shadow-sm z-20 transition-colors duration-200 ${
        theme === 'dark' ? 'bg-black border-[#e4e4e7]/10' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col items-center gap-2.5">
          <div 
            className="relative w-11 h-11 rounded-2xl bg-gradient-to-b from-[#1c1e28] via-[#12131b] to-[#0a0b10] flex items-center justify-center mb-2 shadow-xl shadow-black/50 border border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-300 group cursor-pointer" 
            title="Master POS Commercial Edition"
          >
            <div className="absolute inset-0 rounded-2xl bg-radial from-emerald-500/30 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
            <MasterPOSLogo className="w-6 h-6 text-emerald-400 relative z-10 group-hover:scale-110 transition-transform duration-200" size={26} useColor={true} accent="emerald" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#12131b] shadow-xs" />
          </div>

          {/* Fullscreen Toggle Button */}
          <button
            id="pos-fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen Mode (F11)"}
            className={`w-10 h-10 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center group active:scale-95 ${
              isFullscreen
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-sm'
                : theme === 'dark'
                ? 'border-slate-300 dark:border-white/10 bg-white dark:bg-stone-900/60 text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-white hover:border-white/20'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-500 dark:text-stone-400 group-hover:text-emerald-400 group-hover:scale-110 transition-transform" />
            )}
          </button>

          {/* Left Stream Collapse / Expand Toggle */}
          <button
            onClick={() => {
              setIsLeftStreamCollapsed(!isLeftStreamCollapsed);
              showToast(isLeftStreamCollapsed ? 'Orders Stream Expanded' : 'Orders Stream Collapsed (Focus Mode)');
            }}
            title={isLeftStreamCollapsed ? "Show Live Orders Stream" : "Collapse Live Orders Stream"}
            className={`w-10 h-10 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center group active:scale-95 ${
              !isLeftStreamCollapsed
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                : theme === 'dark'
                ? 'border-slate-300 dark:border-white/10 bg-white dark:bg-stone-900/60 text-slate-500 dark:text-stone-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-label="Toggle Orders Stream Pane"
          >
            {isLeftStreamCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
          </button>

          <button onClick={() => showToast('Support & Intercom audio connected')} title="Audio / Intercom" className={`w-10 h-10 rounded-xl border border-transparent transition-all cursor-pointer flex items-center justify-center ${
            theme === 'dark' ? 'text-[#e4e4e7]/50 hover:bg-[#141417] hover:text-emerald-500' : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600'
          }`}>
            <Headphones className="w-4 h-4 stroke-[2]" />
          </button>

          {/* Theme Toggle Button */}
          <button 
            id="pos-theme-toggle-btn"
            onClick={() => {
              toggleTheme();
              showToast(theme === 'dark' ? '☀️ Switched to Light Theme' : '🌙 Switched to Dark Theme');
            }} 
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'} 
            className={`w-10 h-10 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center group active:scale-95 ${
              theme === 'dark' 
                ? 'border-slate-300 dark:border-white/10 bg-white dark:bg-stone-900/60 text-amber-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-amber-300 hover:border-amber-400/40 shadow-xs' 
                : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300 shadow-xs'
            }`}
            aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 group-hover:scale-110 transition-transform duration-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
            ) : (
              <Moon className="w-4 h-4 fill-current text-amber-600 group-hover:-rotate-12 group-hover:scale-110 transition-transform duration-200" />
            )}
          </button>

          {!isRestricted('shift') && (
            <button
              onClick={() => {
                if (onOpenShiftsView) {
                  onOpenShiftsView();
                } else {
                  setIsShiftCloseOpen(true);
                }
              }}
              title="Register Shift & Cash Drawer Reconciliation"
              className="w-10 h-10 rounded-xl border border-emerald-500/10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-all cursor-pointer hover:scale-105"
            >
              <Calculator className="w-4 h-4" />
            </button>
          )}

          {onOpenOrdersView && !isRestricted('kitchen') && (
            <button
              onClick={onOpenOrdersView}
              title="Live Kitchen Display (KDS) & Order Queue"
              className={`w-10 h-10 rounded-xl border border-transparent transition-all cursor-pointer flex items-center justify-center ${
                theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:bg-[#141417] hover:text-amber-400' : 'text-slate-400 hover:bg-slate-100 hover:text-amber-600'
              }`}
            >
              <ChefHat className="w-4 h-4" />
            </button>
          )}

          {onOpenDeliveryMonitoring && !isRestricted('delivery') && (
            <button onClick={onOpenDeliveryMonitoring} title="Open Live Delivery Monitoring System" className={`w-10 h-10 rounded-xl border border-transparent transition-all cursor-pointer flex items-center justify-center ${
              theme === 'dark' ? 'text-[#e4e4e7]/50 hover:bg-[#141417] hover:text-emerald-500' : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600'
            }`}>
              <Truck className="w-4 h-4" />
            </button>
          )}

          {onOpenAdminDashboard && !isRestricted('staff') && (
            <button onClick={onOpenAdminDashboard} title="Executive Administrative Console & Sales Dashboard" className={`w-10 h-10 rounded-xl border border-transparent transition-all cursor-pointer flex items-center justify-center ${
              theme === 'dark' ? 'text-[#e4e4e7]/50 hover:bg-[#141417] hover:text-emerald-500' : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600'
            }`}>
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              logoutUser();
              showToast(`✓ Signed out of account (${currentUser.name})`);
            }}
            title={`Sign Out (${currentUser.name} - ${currentUser.role.toUpperCase()})`}
            className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center cursor-pointer transition-all hover:bg-red-950/60 hover:border-red-500/40 hover:text-red-400 ${
              theme === 'dark' ? 'bg-[#141417] text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-white/10' : 'bg-slate-100 text-slate-800 border border-slate-300'
            }`}
          >
            <LogOut className="w-4.5 h-4.5 text-slate-700 dark:text-stone-300 hover:text-red-400 transition" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button onClick={() => showToast('Connecting to POS Live Dispatch Chat...')} title="Live Chat Support" className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center justify-center text-white shadow-lg hover:shadow-emerald-900/40 hover:scale-105 transition-all duration-200 cursor-pointer border border-emerald-400/20">
            <MessageSquare className="w-4 h-4 fill-white" />
          </button>
        </div>
      </div>

      {/* Order Stream (Pane 1: Left Live Orders) */}
      <div className={`${
        isLeftStreamCollapsed ? 'w-0 border-none opacity-0 pointer-events-none' : 'pos-left-stream border-r opacity-100'
      } flex flex-col h-full overflow-hidden z-10 shrink-0 transition-all duration-300 ease-in-out ${
        theme === 'dark' ? 'bg-[#0c0c0e] border-[#e4e4e7]/10' : 'bg-slate-50 border-slate-200'
      }`}>
        
        <div className={`flex flex-col gap-1.5 px-3.5 py-2.5 shrink-0 border-b ${theme === 'dark' ? 'border-[#e4e4e7]/10' : 'border-slate-200'}`}>
          <div className={`flex rounded-lg p-1 mb-2.5 ${theme === 'dark' ? 'bg-[#141417]' : 'bg-slate-200/70'}`}>
              <button 
                onClick={() => setOrderStreamTab('ongoing')} 
                className={`flex-1 border-none py-2 px-2 text-[0.75rem] font-semibold rounded-md cursor-pointer uppercase transition-all ${
                  orderStreamTab === 'ongoing' 
                    ? theme === 'dark' ? 'bg-[#27272a] text-[#e4e4e7]' : 'bg-white text-slate-900 shadow-xs' 
                    : theme === 'dark' ? 'bg-transparent text-[#e4e4e7]/50' : 'bg-transparent text-slate-500'
                }`}
              >
                Ongoing
              </button>
              <button 
                onClick={() => setOrderStreamTab('all')} 
                className={`flex-1 border-none py-2 px-2 text-[0.75rem] font-semibold rounded-md cursor-pointer uppercase transition-all ${
                  orderStreamTab === 'all' 
                    ? theme === 'dark' ? 'bg-[#27272a] text-[#e4e4e7]' : 'bg-white text-slate-900 shadow-xs' 
                    : theme === 'dark' ? 'bg-transparent text-[#e4e4e7]/50' : 'bg-transparent text-slate-500'
                }`}
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
                  className={`w-full border rounded-lg px-3 py-2.5 text-[0.8rem] focus:outline-none focus:border-emerald-500 transition-all ${
                    theme === 'dark' 
                      ? 'bg-[#141417] border-[#e4e4e7]/10 text-[#e4e4e7] placeholder:text-[#e4e4e7]/50' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-inner'
                  }`}
                />
              </div>
              <button onClick={() => { setSearchOrdersInput(''); showToast('Ongoing orders list refreshed'); }} className={`p-1.5 rounded-xl cursor-pointer shrink-0 border transition-all hover:scale-105 ${
                theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800/80 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white border-slate-200 dark:border-white/5' : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200 shadow-xs'
              }`}>
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
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-stone-500 space-y-2">
                  <Database className="w-8 h-8 stroke-1 text-stone-700" />
                  <p className="text-xs font-semibold">No active orders</p>
                </div>
              ) : (
                ongoingOrders.map((ord) => {
                  const isSelected = selectedOrderId === ord.id;
                  const elapsedMins = Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 60000);
                  const ordSt = (ord.status || '').toLowerCase();
                  const isFinished = ordSt === 'completed' || ordSt === 'delivered' || ordSt === 'refunded' || ordSt === 'cancelled';
                  const isDelayed15M = elapsedMins >= 15 && !isFinished;
                  const isUrgent = elapsedMins >= 20 && !isFinished;
                  const isWarming = elapsedMins >= 10 && elapsedMins < 20 && !isFinished;
                  const isCancelled = ordSt === 'cancelled' || ordSt === 'refunded' || ordSt === 'void';
                  const isDelivered = ordSt === 'delivered' || ordSt === 'completed' || ordSt === 'ready';
                  const isOnTheWay = ordSt === 'dispatched' || ordSt === 'on_the_way';
                  const isKitchen = ordSt === 'in_kitchen';

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                        setMiddleTab('order_details');
                      }}
                      className={`relative overflow-hidden rounded-xl p-3 text-xs transition-all duration-200 cursor-pointer border-2 ${
                        isSelected
                          ? 'border-emerald-400 bg-gradient-to-b from-stone-900 to-stone-950 shadow-[0_0_20px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/50'
                          : isDelayed15M
                          ? 'animate-pulse-glow bg-gradient-to-b from-[#261016] to-[#140b0f] border-rose-500/95 shadow-[0_0_24px_rgba(244,63,94,0.45)] ring-2 ring-rose-500/50'
                          : isCancelled
                          ? 'bg-gradient-to-b from-[#261016] to-[#140b0f] border-rose-500/95 shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/40'
                          : isDelivered
                          ? 'bg-gradient-to-b from-[#0e2216] to-[#0a140f] border-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400/40'
                          : isOnTheWay
                          ? 'bg-gradient-to-b from-[#24170a] to-[#140f09] border-amber-400/90 shadow-[0_0_18px_rgba(245,158,11,0.3)] ring-1 ring-orange-400/40'
                          : isUrgent
                          ? 'bg-gradient-to-b from-[#221217] to-[#120c11] border-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/30'
                          : isWarming
                          ? 'bg-gradient-to-b from-[#221a0f] to-[#14100c] border-amber-400/90 shadow-[0_0_16px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/30'
                          : isKitchen
                          ? 'bg-gradient-to-b from-[#1c1322] to-[#100d16] border-indigo-400/80 shadow-[0_0_16px_rgba(99,102,241,0.2)] ring-1 ring-indigo-400/30'
                          : 'bg-gradient-to-b from-stone-900/95 to-stone-950/95 border-white/15 dark:shadow-[0_0_12px_rgba(255,255,255,0.03)] hover:border-emerald-400/60 hover:shadow-md'
                      }`}
                    >
                      {/* Luminous Top Accent Indicator */}
                      <div
                        className={`absolute top-0 left-0 right-0 h-0.5 ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                            : isCancelled
                            ? 'bg-gradient-to-r from-rose-500 via-rose-300 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]'
                            : isDelivered
                            ? 'bg-gradient-to-r from-emerald-500 via-green-300 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.9)]'
                            : isOnTheWay
                            ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                            : isUrgent
                            ? 'bg-gradient-to-r from-rose-500 via-rose-300 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                            : isWarming
                            ? 'bg-gradient-to-r from-amber-500 via-amber-200 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                            : isKitchen
                            ? 'bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)]'
                            : 'bg-transparent'
                        }`}
                      />

                      <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5">
                        <span className="font-mono text-white font-black text-sm tracking-tight drop-shadow-xs">#{ord.orderNumber.replace('ORD-', '')}</span>
                        <span className="text-emerald-400 font-black font-mono text-xs drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">PKR {ord.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-300 mb-2">
                        <span className="capitalize font-bold text-stone-200 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">{ord.type.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase tracking-wider border ${getStatusBadgeStyle(ord.status)}`}>
                          {getStatusLabel(ord.status)}
                        </span>
                        <span className={`ml-auto font-mono text-[10px] font-bold ${isUrgent ? 'text-rose-400 animate-pulse' : isWarming ? 'text-amber-400' : 'text-stone-400'}`}>
                          {elapsedMins}m ago
                        </span>
                      </div>
                      {(ord.customer?.name || ord.customer?.phone || ord.customer?.address) && (
                        <div className="flex flex-col gap-1 text-[10.5px] text-stone-200 mb-2 p-1.5 bg-black/40 rounded-lg border border-white/10">
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-bold text-white">{ord.customer?.name || 'Guest'}</span>
                            {ord.customer?.phone && (
                              <>
                                <span className="text-stone-500 mx-0.5">•</span>
                                <span className="text-stone-300 font-mono text-[9.5px]">{ord.customer.phone}</span>
                              </>
                            )}
                          </div>
                          {ord.customer?.address && (
                            <div className="flex items-start gap-1.5 text-[9.5px] text-stone-300 mt-0.5 leading-snug">
                              <MapPin className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="truncate whitespace-normal line-clamp-2">{ord.customer.address}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-stone-200 text-[11.5px] truncate leading-tight mb-2.5 font-medium">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                        {ord.status !== 'completed' && ord.status !== 'cancelled' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickDispatch(ord); }}
                            className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-black tracking-wide transition-all duration-150 flex-1 hover:scale-[1.02] cursor-pointer shadow-xs ${
                              ((ord.type !== 'delivery' && ord.orderType !== 'delivery') && ord.status === 'ready') ||
                              ((ord.type === 'delivery' || ord.orderType === 'delivery') && (ord.status === 'dispatched' || ord.status === 'delivered'))
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60 hover:bg-emerald-600 hover:text-white shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                                : 'bg-blue-500/20 text-blue-300 border-blue-400/50 hover:bg-blue-500 hover:text-white shadow-[0_0_10px_rgba(59,130,246,0.25)]'
                            }`}
                          >
                            {ord.status === 'pending' || ord.status === 'open' || ord.status === 'PUNCHED' || ord.status === 'MODIFIED' ? 'To Kitchen' 
                              : ord.status === 'in_kitchen' ? 'Mark Ready' 
                              : ord.status === 'ready' ? ((ord.type === 'delivery' || ord.orderType === 'delivery') ? 'Dispatch' : 'Cashout & Complete') 
                              : 'Cashout & Complete'}
                          </button>
                        )}
                        {ord.status !== 'completed' && ord.status !== 'cancelled' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCashout(ord); }}
                            className="px-2.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black tracking-wide transition-all duration-150 flex-1 hover:scale-[1.02] cursor-pointer shadow-xs"
                          >
                            Cashout
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrintReceipt(ord); }}
                          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-lg text-[10px] font-bold border border-white/15 transition-all hover:scale-105 cursor-pointer shrink-0 shadow-xs"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrintKOT(ord); }}
                          className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-400/40 transition-all hover:scale-105 cursor-pointer shrink-0 shadow-xs"
                          title="Print Kitchen Slip (KOT)"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                        </button>
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickEdit(ord); }}
                            className="px-2 py-1 bg-amber-500/15 text-amber-300 border border-amber-400/40 hover:bg-amber-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCancel(ord.id, ord.orderNumber); }}
                            className="px-2 py-1 bg-red-500/15 text-red-300 border border-red-400/40 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all duration-150 hover:scale-[1.02] cursor-pointer"
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
      {/* ========================================================================= */}
      {/* PANE 3: MENU GRID (Responsive Central Catalog)                             */}
      {/* ========================================================================= */}
      <div className={`flex-1 min-w-0 h-full flex flex-col relative overflow-hidden z-10 transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#141417]' : 'bg-slate-100'
      }`}>
        
        {/* Top 3rem Search Bar Header covering the top space */}
        <div className={`h-[3rem] px-3.5 flex items-center border-b shrink-0 transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#101014] border-slate-300 dark:border-white/10' : 'bg-white border-slate-200 shadow-2xs'
        }`}>
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-400'
              }`} />
              <input
                id="pos-menu-search-input"
                type="text"
                placeholder="Search menu items by name, code, or ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-100 dark:bg-stone-950/90 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:text-stone-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-inner'
                }`}
              />
            </div>
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')} 
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 text-xs rounded-xl cursor-pointer shrink-0 transition-all shadow-xs active:scale-95"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Category Strip - All Categories Visible (No Scrolling, Perfectly Aligned) */}
        <div className={`border-b px-2.5 py-1.5 shrink-0 transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#121216] border-slate-200 dark:border-white/5' : 'bg-slate-50/90 border-slate-200 shadow-2xs'
        }`}>
          {/* Category Chips - Perfectly Aligned Responsive Grid */}
          <div 
            id="pos-menu-categories-bar" 
            className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1.5 w-full"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              title={`All Items (${menuItems.length})`}
              className={`pos-category-chip group rounded-lg cursor-pointer transition-all duration-150 border flex items-center justify-between gap-1.5 px-2.5 select-none ${
                (displayCategories.length + 1) % 7 === 6 ? 'xl:col-span-2' : 'col-span-1'
              } ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white border-red-500 shadow-xs ring-1 ring-red-400/40'
                  : theme === 'dark'
                  ? 'bg-[#1c1c22] text-stone-300 border-white/6 hover:border-white/20 hover:bg-[#25252e] hover:text-white shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <Layers className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                  selectedCategory === 'all' ? 'text-white' : theme === 'dark' ? 'text-stone-400 group-hover:text-red-400' : 'text-slate-500 group-hover:text-red-600'
                }`} />
                <span className="font-semibold tracking-tight text-[11px] truncate">All Items</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm shrink-0 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-white/25 text-white'
                  : theme === 'dark'
                  ? 'bg-white/5 text-stone-400 group-hover:bg-white/10 group-hover:text-stone-200'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
              }`}>
                {menuItems.length}
              </span>
            </button>

            {displayCategories.map((cat) => {
              const catCount = menuItems.filter(
                (i) =>
                  i.category.toLowerCase().replace(/[-_ ]/g, '') === cat.id.toLowerCase().replace(/[-_ ]/g, '') ||
                  i.category.toLowerCase().replace(/[-_ ]/g, '') === cat.name.toLowerCase().replace(/[-_ ]/g, '')
              ).length;
              const isSelected =
                selectedCategory.toLowerCase().replace(/[-_ ]/g, '') === cat.id.toLowerCase().replace(/[-_ ]/g, '') ||
                selectedCategory.toLowerCase().replace(/[-_ ]/g, '') === cat.name.toLowerCase().replace(/[-_ ]/g, '');

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  title={`${cat.name} (${catCount})`}
                  className={`pos-category-chip group rounded-lg cursor-pointer transition-all duration-150 border flex items-center justify-between gap-1 px-2 select-none overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white border-red-500 shadow-xs ring-1 ring-red-400/40'
                      : theme === 'dark'
                      ? 'bg-[#1c1c22] text-stone-300 border-white/6 hover:border-white/20 hover:bg-[#25252e] hover:text-white shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <CategoryIcon categoryIdOrName={cat.id || cat.name} className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                      isSelected ? 'text-white' : theme === 'dark' ? 'text-stone-400 group-hover:text-red-400' : 'text-slate-500 group-hover:text-red-600'
                    }`} />
                    <span className="font-semibold tracking-tight text-[11px] truncate">{cat.name}</span>
                  </div>
                  {catCount > 0 && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : theme === 'dark'
                        ? 'bg-white/5 text-stone-400 group-hover:bg-white/10 group-hover:text-stone-200'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
                    }`}>
                      {catCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Menu Grid */}
        <div className="flex-1 overflow-y-auto p-3 bg-transparent no-scrollbar">
          <div className="pos-menu-grid mx-auto w-full">
            {filteredMenuItems.map((item) => {
              const ItemCategoryIcon = getCategoryIcon(item.category || item.name);
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemTap(item)}
                  className={`pos-menu-card border rounded-2xl flex flex-col overflow-hidden relative cursor-pointer active:scale-[0.98] select-none ${
                    theme === 'dark'
                      ? 'border-slate-200 dark:border-white/5 bg-gradient-to-b from-stone-900 to-stone-950 hover:border-emerald-500/40'
                      : 'border-slate-200 bg-white hover:border-emerald-500/50 shadow-xs'
                  }`}
                >
                  {/* Title */}
                  <div className={`pos-card-title px-2.5 py-1 text-center z-10 shrink-0 flex items-center justify-center backdrop-blur-xs border-b ${
                    theme === 'dark' ? 'bg-white dark:bg-stone-900/90 border-slate-200 dark:border-white/5' : 'bg-slate-50/95 border-slate-200'
                  }`}>
                    <h4 className={`font-semibold leading-tight line-clamp-2 transition-colors ${
                      theme === 'dark' ? 'text-slate-900 dark:text-stone-100 group-hover:text-emerald-300' : 'text-slate-800 group-hover:text-emerald-600'
                    }`}>
                      {item.name}
                    </h4>
                  </div>

                  {/* Image or vector SVG background */}
                  <div className="flex-1 relative w-full h-full flex items-end justify-end overflow-hidden">
                    {item.image ? (
                       <img 
                          src={item.image} 
                          alt={item.name} 
                          className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100" 
                          referrerPolicy="no-referrer"
                       />
                    ) : (
                      <div className={`absolute inset-0 flex items-center justify-center ${
                        theme === 'dark' 
                          ? 'bg-gradient-to-br from-stone-900 via-stone-950 to-black text-stone-700' 
                          : 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 text-slate-400'
                      }`}>
                        <div className="p-3 rounded-2xl bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center shadow-inner group-hover:text-emerald-400">
                          <ItemCategoryIcon className="w-8 h-8 stroke-[1.7]" />
                        </div>
                      </div>
                    )}
                    
                    {/* Category SVG badge top-left */}
                    <div className="absolute top-2 left-2 z-10 p-1 rounded-md bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs border border-slate-300 dark:border-white/10 text-white/80 group-hover:text-white shadow-xs">
                      <ItemCategoryIcon className="w-3 h-3" />
                    </div>

                    {/* Price Badge */}
                    <div className={`pos-price-badge relative z-10 border font-black font-mono m-2 leading-none rounded-lg shadow-md backdrop-blur-xs ${
                      theme === 'dark' ? 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-stone-950/90 text-emerald-400' : 'border-emerald-200 bg-white/95 text-emerald-600'
                    }`}>
                      PKR {item.price.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 2: RIGHT PANE (Ticket Punch, Order Details, All Orders Ledger)        */}
      {/* ========================================================================= */}
      <div className={`pos-right-ticket shrink-0 flex flex-col h-full border-l relative overflow-hidden justify-between z-10 transition-all duration-300 ease-in-out ${
        theme === 'dark' ? 'bg-[#0c0c0e] border-[#e4e4e7]/10' : 'bg-slate-50 border-slate-200'
      }`}>
        
        {/* Pane 2 Top View Tabs */}
        <div className={`flex items-center border-b px-4 py-2.5 gap-2 shrink-0 transition-colors duration-200 ${
          theme === 'dark' ? 'border-slate-300 dark:border-white/10 bg-slate-900/20 dark:bg-black/40' : 'border-slate-200 bg-white shadow-2xs'
        }`}>
          <button
            type="button"
            onClick={() => setMiddleTab('active_ticket')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
              middleTab === 'active_ticket'
                ? 'bg-emerald-500 text-stone-950 font-black shadow-sm'
                : theme === 'dark'
                ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Ticket</span>
            {posCart.items.length > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-none ${
                middleTab === 'active_ticket' ? 'bg-slate-100 dark:bg-stone-950 text-emerald-400' : 'bg-emerald-500 text-stone-950'
              }`}>
                {posCart.items.reduce((s, it) => s + it.quantity, 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedOrder) {
                setMiddleTab('order_details');
              } else if (orders.length > 0) {
                setSelectedOrderId(orders[0].id);
                setMiddleTab('order_details');
              } else {
                showToast('No orders placed yet');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
              middleTab === 'order_details'
                ? 'bg-emerald-500 text-stone-950 font-black shadow-sm'
                : theme === 'dark'
                ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{selectedOrder ? `#${selectedOrder.orderNumber.replace('ORD-', '')}` : 'Order Detail'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMiddleTab('all_orders')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
              middleTab === 'all_orders'
                ? 'bg-emerald-500 text-stone-950 font-black shadow-sm'
                : theme === 'dark'
                ? 'text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Orders</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-none ${
              middleTab === 'all_orders'
                ? 'bg-slate-100 dark:bg-stone-950 text-emerald-400'
                : theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {orders.length}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ACTIVE PUNCH TICKET                                                */}
        {/* ========================================================================= */}
        {middleTab === 'active_ticket' && (
          <>
            <div className={`flex flex-col px-3.5 py-2.5 gap-2 shrink-0 border-b ${
              theme === 'dark' ? 'border-[#e4e4e7]/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <h2 className={`font-mono text-[0.65rem] uppercase tracking-[0.15em] font-bold ${
                    theme === 'dark' ? 'text-[#e4e4e7]/50' : 'text-slate-500'
                  }`}>Client Details</h2>
                  {posCart.items.length > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {posCart.items.length} lines ({posCart.items.reduce((s, i) => s + i.quantity, 0)} units)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {customerLookupStatus === 'found' && (
                    <button onClick={() => setIsCustomerHistoryOpen(true)} className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md transition-colors cursor-pointer text-[0.65rem] font-bold uppercase tracking-wider">
                      <History className="w-3 h-3" />
                      History
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsClientDetailsCollapsed(prev => !prev)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title={isClientDetailsCollapsed ? "Expand Client Details" : "Collapse to maximize huge order ticket view"}
                  >
                    {isClientDetailsCollapsed ? (
                      <><span>Expand</span><ChevronDown className="w-3 h-3" /></>
                    ) : (
                      <><span>Compact</span><ChevronUp className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
              </div>

              {isClientDetailsCollapsed ? (
                /* Collapsed Slim Summary for Huge Orders */
                <div className={`flex items-center justify-between gap-1.5 py-1 px-2 rounded-lg border text-xs ${
                  theme === 'dark' ? 'bg-[#141417]/80 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`px-2 py-0.5 text-[9.5px] font-black rounded uppercase tracking-wider ${
                      posCart.orderType === 'dine_in' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                      posCart.orderType === 'delivery' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                      'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                    }`}>
                      {posCart.orderType === 'dine_in' ? 'Dine In' : posCart.orderType === 'delivery' ? 'Delivery' : 'Takeaway'}
                    </span>
                    {posCart.customer?.name ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold truncate text-slate-900 dark:text-white">{posCart.customer.name}</span>
                        <span className="text-[10.5px] font-mono font-semibold text-emerald-500 shrink-0">({posCart.customer.phone})</span>
                        {posCart.customer.address && (
                          <span className="text-[10px] text-slate-400 dark:text-stone-500 truncate hidden sm:inline">• {posCart.customer.address}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No customer specified</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {posCart.customer?.name && (
                      <button
                        type="button"
                        onClick={() => setIsCustomerManageModalOpen(true)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Edit Customer Information"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsClientDetailsCollapsed(false)}
                      className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Expand details"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <select 
                      value={selectedOutlet} 
                      onChange={(e) => setSelectedOutlet(e.target.value)} 
                      className={`border rounded-xl px-3 py-1.5 text-xs font-semibold appearance-none focus:outline-none focus:border-emerald-500 w-full transition-all cursor-pointer ${
                        theme === 'dark' ? 'bg-[#141417] border-[#e4e4e7]/10 text-[#e4e4e7]' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
                      }`}
                    >
                      <option value="">Select Outlet</option>
                      {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button onClick={() => showToast('WhatsApp Sync Status')} title="WhatsApp Sync Status" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-emerald-400/20"><MessageSquare className="w-4 h-4 stroke-[3]" /></button>
                    <button onClick={handleResetTicket} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-red-400/20"><X className="w-4 h-4 stroke-[3]" /></button>
                  </div>
                  
                  {/* Row 2: Order Type & Source */}
                  <div className="flex items-center gap-1.5">
                    <div className={`flex rounded-xl overflow-hidden shrink-0 border p-0.5 shadow-inner ${
                      theme === 'dark' ? 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-stone-950/80' : 'border-slate-300 bg-slate-200/80'
                    }`}>
                      <button onClick={() => setPosOrderType('dine_in')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'dine_in' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm border border-amber-400/30' : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>DineIn</button>
                      <button onClick={() => setPosOrderType('takeaway')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'takeaway' ? 'bg-gradient-to-r from-stone-700 to-stone-800 text-white shadow-sm border border-slate-300 dark:border-white/10' : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>TakeAway</button>
                      <button onClick={() => setPosOrderType('delivery')} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${posCart.orderType === 'delivery' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-400/30' : theme === 'dark' ? 'text-slate-500 dark:text-stone-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Delivery</button>
                    </div>
                    <select 
                      value={selectedSource} 
                      onChange={(e) => setSelectedSource(e.target.value)} 
                      className={`border rounded-xl px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 cursor-pointer transition-all ${
                        theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/80 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
                      }`}
                    >
                      <option value="Pos">Select Source</option>
                      <option value="Call">Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Walk In Customer">Walk In Customer</option>
                    </select>
                  </div>
                  
                  {/* Row 3: Customer Input */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="tel"
                        maxLength={11}
                        placeholder="Enter 11-digit Phone (03001234567)..."
                        value={phoneSearchInput}
                        onChange={(e) => setPhoneSearchInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneLookup(undefined, true); }}
                        className={`w-full border rounded-xl pl-8 pr-16 py-1.5 text-xs font-mono transition-all shadow-inner focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 ${
                          theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/80 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:text-stone-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                      <Phone className="w-3.5 h-3.5 text-emerald-500/70 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      
                      {/* 11 Digits Counter Indicator Badge */}
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                          cleanPhoneDigits.length === 11 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : cleanPhoneDigits.length > 0
                            ? theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-500 dark:text-stone-400' : 'bg-slate-200 text-slate-600'
                            : theme === 'dark' ? 'text-stone-600' : 'text-slate-400'
                        }`}>
                          {cleanPhoneDigits.length === 11 ? '11/11 ✓' : `${cleanPhoneDigits.length}/11`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePhoneLookup(undefined, true)}
                      disabled={isSearchingCustomer}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      title="Search Customer (Requires 11 Digits)"
                    >
                      {isSearchingCustomer ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                      ) : (
                        <Search className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </button>
                    {cleanPhoneDigits.length >= 7 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBlockTargetPhone(cleanPhoneDigits);
                          setBlockTargetName(posCart.customer?.name || foundCustomer?.name || 'Customer');
                          setIsBlockModalOpen(true);
                        }}
                        className={`p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 border flex items-center justify-center ${
                          posCart.customer?.isBlocked || foundCustomer?.isBlocked || isCustomerBlocked(cleanPhoneDigits).blocked
                            ? 'bg-red-600/30 text-red-400 border-red-500/50 hover:bg-red-600 hover:text-white'
                            : theme === 'dark'
                            ? 'bg-white dark:bg-stone-900 hover:bg-red-950/60 text-slate-500 dark:text-stone-400 hover:text-red-400 border-slate-300 dark:border-white/10 hover:border-red-500/30'
                            : 'bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border-slate-200 hover:border-red-300'
                        }`}
                        title="Block this phone number"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Blocked Customer Prominent Alert Banner in Ticket */}
                  {(posCart.customer?.isBlocked || foundCustomer?.isBlocked || (cleanPhoneDigits ? isCustomerBlocked(cleanPhoneDigits).blocked : false)) && (
                    <div className="bg-gradient-to-r from-red-950/90 via-red-900/80 to-red-950/90 border-2 border-red-500/60 rounded-xl p-2.5 shadow-lg shadow-red-950/40 animate-in fade-in duration-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-lg bg-red-600/30 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block">
                              ⛔ BLOCKED CUSTOMER DETECTED
                            </span>
                            <h4 className="text-xs font-black text-white leading-tight">
                              Blocked customer can&apos;t place an order
                            </h4>
                            <p className="text-[10px] text-red-200/90 mt-0.5 bg-slate-900/20 dark:bg-black/40 p-1 rounded border border-red-500/20 leading-snug">
                              <strong>Reason:</strong> {posCart.customer?.blockReason || foundCustomer?.blockReason || isCustomerBlocked(cleanPhoneDigits).reason || 'Store blacklist policy'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1.5 pt-1.5 border-t border-red-500/30">
                        <button
                          type="button"
                          onClick={() => {
                            const targetCust = posCart.customer?.isBlocked ? (foundCustomer || posCart.customer as any) : (isCustomerBlocked(cleanPhoneDigits).customer || foundCustomer);
                            setBlockedAlertCustomer(targetCust);
                            setBlockedAlertPhone(cleanPhoneDigits);
                            setIsBlockedAlertOpen(true);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3 h-3" />
                          View Block Popup
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Unblock customer ${cleanPhoneDigits}?`)) {
                              const res = await unblockCustomer(cleanPhoneDigits);
                              if (res.success) {
                                setFoundCustomer((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        isBlocked: false,
                                        blockReason: undefined,
                                        blockedAt: undefined,
                                        blockedBy: undefined,
                                      }
                                    : null
                                );
                                setBlockedAlertCustomer(null);
                                setIsBlockedAlertOpen(false);
                                setCustomerLookupStatus('idle');
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-[10px] font-semibold transition cursor-pointer border border-slate-300 dark:border-white/10"
                        >
                          Unblock
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Customer Details Display Area */}
                  {customerLookupStatus === 'new' ? (
                    <div className={`border rounded-xl p-2.5 mt-0.5 flex flex-col gap-2 shadow-xs animate-in fade-in duration-150 ${
                      theme === 'dark' ? 'bg-[#141417] border-blue-500/20' : 'bg-blue-50/70 border-blue-200'
                    }`}>
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                           <span className="text-[0.65rem] uppercase font-bold tracking-wider text-blue-500">New Customer Profile</span>
                         </div>
                         <span className={`text-[10px] font-mono font-bold ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-600'}`}>
                           {cleanPhoneDigits}
                         </span>
                       </div>
                       <div className="space-y-1.5">
                         <div className="relative">
                           <User className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`} />
                           <input
                             type="text"
                             placeholder="Full Name (Required) *"
                             value={posCart.customer?.name || ''}
                             onChange={(e) => setPosCustomerField('name', e.target.value)}
                             className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/50 transition-colors ${
                               theme === 'dark' ? 'bg-[#0c0c0e] border-slate-300 dark:border-white/10 text-white placeholder:text-slate-400 dark:text-stone-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                             }`}
                           />
                         </div>
                         <div className="relative">
                           <MapPin className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`} />
                           <textarea
                             rows={1}
                             placeholder="Delivery Address (Optional)"
                             value={posCart.customer?.address || ''}
                             onChange={(e) => setPosCustomerField('address', e.target.value)}
                             className={`w-full border rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-blue-500/50 transition-colors resize-none ${
                               theme === 'dark' ? 'bg-[#0c0c0e] border-slate-300 dark:border-white/10 text-white placeholder:text-slate-400 dark:text-stone-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                             }`}
                           />
                         </div>
                       </div>

                       {/* Save Customer Explicit Button */}
                       <div className={`flex items-center justify-between pt-1 border-t ${theme === 'dark' ? 'border-slate-200 dark:border-white/5' : 'border-slate-200'}`}>
                         <span className={`text-[9.5px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                           Auto-saves with order
                         </span>
                         <button
                           type="button"
                           onClick={handleSaveCustomerManually}
                           disabled={isSavingCustomer || !posCart.customer?.name?.trim()}
                           className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all border border-emerald-400/20"
                         >
                           {isSavingCustomer ? (
                             <Loader2 className="w-3 h-3 animate-spin" />
                           ) : (
                             <Save className="w-3 h-3" />
                           )}
                           <span>{isSavingCustomer ? 'Saving...' : 'Save Details'}</span>
                         </button>
                       </div>
                    </div>
                  ) : customerLookupStatus === 'found' && posCart.customer ? (
                    <div className={`border rounded-xl px-2.5 py-1.5 mt-0.5 flex items-center justify-between shadow-xs transition-all ${
                      theme === 'dark' ? 'bg-[#141417]/90 border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-300'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`font-bold text-xs truncate leading-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                              {posCart.customer.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {posCart.customer.phone}
                            </span>
                          </div>
                          {posCart.customer.address ? (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-stone-400 truncate mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{posCart.customer.address}</span>
                            </div>
                          ) : (
                            <span className="text-[9.5px] text-slate-400 dark:text-stone-500 italic truncate">Registered Customer</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons: Edit and View Profile */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsCustomerManageModalOpen(true)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border shadow-xs ${
                            theme === 'dark'
                              ? 'bg-stone-800 hover:bg-emerald-600/30 hover:border-emerald-500/50 text-emerald-400 border-white/10'
                              : 'bg-white hover:bg-emerald-100 hover:border-emerald-300 text-emerald-700 border-slate-200'
                          }`}
                          title="Edit Customer Information"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomerModalOpen(true)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                            theme === 'dark'
                              ? 'text-stone-300 bg-stone-800 hover:bg-stone-700 border-white/10'
                              : 'text-slate-600 bg-white hover:bg-slate-100 border-slate-200'
                          }`}
                          title="View Customer Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Active Ticket Cart Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-transparent no-scrollbar">
               {posCart.items.length === 0 ? (
                  <div className={`h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center space-y-3 rounded-2xl border border-dashed transition-all ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-b from-stone-900/30 via-stone-950/50 to-[#0a0b10] border-slate-200 dark:border-stone-800/80 text-slate-500 dark:text-stone-400 shadow-inner' 
                      : 'bg-gradient-to-b from-slate-50/50 to-slate-100/50 border-slate-200 text-slate-500 shadow-2xs'
                  }`}>
                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-stone-900/40 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                        <ChefHat className="w-6 h-6 text-emerald-400 animate-pulse" />
                     </div>
                     <div className="space-y-1 max-w-[210px]">
                        <p className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                           Active Ticket Empty
                        </p>
                        <p className="text-[10.5px] leading-relaxed text-slate-400 dark:text-stone-500 font-medium">
                           Tap menu items on the left grid or scan barcode to build order ticket.
                        </p>
                     </div>
                     <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-xs">
                        <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Ready for Order Input</span>
                     </div>
                  </div>
               ) : (
                  <div className="space-y-1">
                    {/* Huge Order Header Summary Bar */}
                    <div className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                      theme === 'dark' ? 'bg-stone-900/60 border-white/5 text-stone-400' : 'bg-slate-100/90 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-500">{posCart.items.length} Lines</span>
                        <span>•</span>
                        <span>{posCart.items.reduce((s, i) => s + i.quantity, 0)} Units</span>
                        {posCart.items.length >= 6 && (
                          <span className="bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.2 rounded text-[9px] font-sans font-black uppercase tracking-wider">
                            Bulk Order
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleResetTicket}
                        className="text-red-400 hover:text-red-500 hover:underline cursor-pointer font-sans text-[10px]"
                        title="Clear all ticket items"
                      >
                        Clear All
                      </button>
                    </div>

                    {posCart.items.map((cartItem, idx) => (
                      <div 
                        key={cartItem.id} 
                        className={`border rounded-xl p-1.5 px-2 flex items-center justify-between text-xs transition-all duration-200 shadow-xs ${
                        theme === 'dark' 
                          ? 'bg-gradient-to-r from-stone-900/90 to-stone-950/90 border-slate-200 dark:border-white/5 hover:border-emerald-500/30' 
                          : 'bg-white border-slate-200 hover:border-emerald-500/40 shadow-xs'
                      }`}>
                        <span className={`text-[10px] font-mono font-bold w-4 shrink-0 ${theme === 'dark' ? 'text-stone-500' : 'text-slate-400'}`}>
                          {idx + 1}.
                        </span>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className={`font-semibold truncate text-[11px] ${theme === 'dark' ? 'text-slate-900 dark:text-stone-100' : 'text-slate-900'}`}>{cartItem.name}</div>
                          {cartItem.flavor && <div className="text-[10px] text-emerald-500 font-medium truncate">{cartItem.flavor}</div>}
                          {cartItem.modifiers && cartItem.modifiers.length > 0 && <div className={`text-[9px] truncate ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>+{cartItem.modifiers.map(m=>m.name).join(', ')}</div>}
                        </div>
                        <div className={`flex items-center gap-1.5 shrink-0 border rounded-lg p-0.5 ${
                          theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/90 border-slate-200 dark:border-white/5' : 'bg-slate-100 border-slate-200'
                        }`}>
                          <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity - 1)} className={`w-5 h-5 rounded-md font-bold flex items-center justify-center cursor-pointer transition text-[10px] ${
                            theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-white' : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                          }`}><Minus className="w-2.5 h-2.5" /></button>
                          <span className={`w-4 text-center font-mono font-bold text-[11px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{cartItem.quantity}</span>
                          <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity + 1)} className={`w-5 h-5 rounded-md font-bold flex items-center justify-center cursor-pointer transition text-[10px] ${
                            theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-white' : 'bg-white hover:bg-slate-200 text-slate-800 shadow-xs'
                          }`}><Plus className="w-2.5 h-2.5" /></button>
                        </div>
                        <div className="text-right shrink-0 pl-2 min-w-[55px]">
                          <span className="font-mono font-black text-emerald-500 text-xs block truncate">{Number(cartItem.price * cartItem.quantity).toLocaleString()}</span>
                          <button onClick={() => removeFromPosCart(cartItem.id)} className="text-slate-500 dark:text-stone-400 hover:text-red-500 text-[10px] transition cursor-pointer font-bold mt-0.5">X</button>
                        </div>
                      </div>
                    ))}
                  </div>
               )}
            </div>

            {/* Bottom Action Controls */}
            <div className={`p-2.5 border-t space-y-2 shrink-0 shadow-lg ${
              theme === 'dark' 
                ? 'bg-gradient-to-t from-[#141414] to-[#181818] border-slate-200 dark:border-white/5' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-12 border rounded-xl py-2 text-center font-mono font-bold text-xs shadow-inner ${
                  theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 border-slate-300 dark:border-white/10 text-slate-700 dark:text-stone-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                }`}>0</div>
                <button onClick={() => setShowDiscountPrompt(true)} className={`flex-1 border font-bold text-[11px] py-2 px-2 rounded-xl cursor-pointer transition-all duration-150 text-center shadow-xs truncate ${
                  theme === 'dark' ? 'bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 border-slate-300 dark:border-white/10 text-stone-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}>Discount {posCart.discountPercent > 0 ? `${(cartSubtotal * (posCart.discountPercent / 100)).toFixed(0)}(${posCart.discountPercent}%)` : '0(0%)'}</button>
                <button onClick={() => setShowChargesPrompt(true)} className={`flex-1 border font-bold text-[11px] py-2 px-2 rounded-xl cursor-pointer transition-all duration-150 text-center shadow-xs truncate ${
                  theme === 'dark' ? 'bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 border-slate-300 dark:border-white/10 text-stone-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}>Charges {posCart.tipAmount || 0}</button>
              </div>
              {posCart.orderType === 'dine_in' && (
                <div className="flex gap-2 w-full">
                  <select
                    value={posCart.tableNumber || ''}
                    onChange={(e) => setPosTableNumber(e.target.value)}
                    className={`flex-1 border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 cursor-pointer ${
                      theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/80 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
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
                    className={`flex-1 border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 cursor-pointer ${
                      theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/80 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="">Select Server (Required)</option>
                    {users.filter(u => u.role === 'server' && u.active !== false).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {posCart.orderType === 'delivery' && (
                <div className="w-full space-y-1">
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] uppercase font-bold flex items-center gap-1.5 ${
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    }`}>
                      <Truck className="w-3.5 h-3.5" />
                      <span>Assigned Delivery Rider</span>
                      <span className="text-red-500 font-extrabold">* (Required)</span>
                    </label>
                    {!posCart.deliveryDriver && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20 animate-pulse">
                        Required
                      </span>
                    )}
                  </div>
                  <select
                    value={posCart.deliveryDriver || ''}
                    onChange={(e) => setPosDeliveryDriver(e.target.value)}
                    className={`w-full rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer transition-all ${
                      !posCart.deliveryDriver
                        ? theme === 'dark'
                          ? 'border-2 border-amber-500/70 bg-amber-950/40 text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-2 border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20'
                        : theme === 'dark'
                        ? 'bg-slate-100 dark:bg-stone-950/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-emerald-500/50'
                        : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  >
                    <option value="">-- Choose Rider (Required for Delivery)* --</option>
                    {deliveryDrivers.map((d) => (
                      <option key={d} value={d}>Rider: {d}</option>
                    ))}
                  </select>
                </div>
              )}
              <input 
                type="text" 
                placeholder="Delivery Note" 
                value={activeDeliveryNote} 
                onChange={(e) => setActiveDeliveryNote(e.target.value)} 
                className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 transition-all ${
                  theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/80 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:text-stone-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                }`} 
              />
              <div className="flex items-center gap-2 pt-0.5">
                <label className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer shrink-0 select-none ${
                  theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-600'
                }`}>
                  <input type="checkbox" checked={isPreOrder} onChange={(e) => setIsPreOrder(e.target.checked)} className="rounded border-slate-300 text-emerald-500 focus:ring-0 cursor-pointer w-4 h-4" />
                  PreOrder
                </label>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isPunching}
                  className={`flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.97] text-white font-black text-xs py-2.5 px-4 rounded-xl transition-all duration-75 shadow-md flex items-center justify-center gap-2 border border-emerald-400/20 tabular-nums ${
                    isPunching ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                  } ${punchSuccessAnimation ? 'bg-emerald-500' : ''}`}
                >
                  {isPunching ? <span className="animate-pulse">Punching...</span> : punchSuccessAnimation ? <span>✓ Punched!</span> : <span>Place Order ({posCart.items.length === 0 ? '0' : `PKR ${cartTotal.toLocaleString()}`})</span>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ORDER DETAILS & ACTION CONTROL VIEW                                */}
        {/* ========================================================================= */}
        {middleTab === 'order_details' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedOrder ? (
              <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 ${
                theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'
              }`}>
                <Receipt className={`w-10 h-10 stroke-1 ${theme === 'dark' ? 'text-stone-600' : 'text-slate-300'}`} />
                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>No Order Selected</h4>
                <p className={`text-xs max-w-[220px] ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-500'}`}>
                  Select an order from the ongoing stream on the left or tap below to start a new ticket.
                </p>
                <button
                  onClick={() => setMiddleTab('active_ticket')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  + Punch New Ticket
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden justify-between">
                {/* Order Top Banner */}
                <div className={`p-3 border-b shrink-0 ${
                  theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 border-slate-300 dark:border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-base font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        #{selectedOrder.orderNumber.replace('ORD-', '')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${getStatusBadgeStyle(selectedOrder.status)}`}>
                        {getStatusLabel(selectedOrder.status)}
                      </span>
                    </div>
                    <span className={`text-[11px] font-semibold capitalize px-2 py-0.5 rounded-md border ${
                      theme === 'dark' ? 'text-slate-500 dark:text-stone-400 bg-white dark:bg-stone-900 border-slate-200 dark:border-white/5' : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}>
                      {selectedOrder.type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between text-[10px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                    <span>Outlet: <strong className={theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}>{selectedOrder.outlet || selectedOrder.branchName || 'Main'}</strong></span>
                    <span>{new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Status Progress Stepper */}
                  <div className={`grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t text-[9px] font-bold text-center ${
                    theme === 'dark' ? 'border-slate-200 dark:border-white/5' : 'border-slate-200'
                  }`}>
                    {['Punched', 'Kitchen', 'Ready', selectedOrder.type === 'delivery' ? 'Dispatched' : 'Completed'].map((stLabel, idx) => {
                      const curStatus = selectedOrder.status.toLowerCase();
                      const isPastOrCurrent =
                        idx === 0 ||
                        (idx === 1 && (curStatus === 'in_kitchen' || curStatus === 'ready' || curStatus === 'dispatched' || curStatus === 'completed')) ||
                        (idx === 2 && (curStatus === 'ready' || curStatus === 'dispatched' || curStatus === 'completed')) ||
                        (idx === 3 && (curStatus === 'dispatched' || curStatus === 'completed'));
                      const isCurrent =
                        (idx === 0 && (curStatus === 'pending' || curStatus === 'open' || curStatus === 'punched')) ||
                        (idx === 1 && curStatus === 'in_kitchen') ||
                        (idx === 2 && curStatus === 'ready') ||
                        (idx === 3 && (curStatus === 'dispatched' || curStatus === 'completed'));
                      return (
                        <div
                          key={stLabel}
                          className={`py-1 rounded-md border transition-all ${
                            isCurrent
                              ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40 ring-1 ring-emerald-500/30 font-extrabold'
                              : isPastOrCurrent
                              ? theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-white/10' : 'bg-slate-200 text-slate-700 border-slate-300'
                              : theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 text-stone-600 border-slate-200 dark:border-white/5' : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {stLabel}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Middle Scrollable Section: Customer, Table/Rider, Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  {/* Customer Info Card */}
                  {(selectedOrder.customer?.name || selectedOrder.customer?.phone || selectedOrder.tableNumber || selectedOrder.serverName) && (
                    <div className={`border rounded-xl p-2.5 space-y-1.5 text-xs ${
                      theme === 'dark' ? 'bg-white dark:bg-stone-900/80 border-slate-200 dark:border-white/5' : 'bg-white border-slate-200 shadow-xs'
                    }`}>
                      {selectedOrder.customer?.name && (
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 font-semibold ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                            <User className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{selectedOrder.customer.name}</span>
                          </div>
                          {selectedOrder.customer?.phone && (
                            <span className={`font-mono text-[11px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>{selectedOrder.customer.phone}</span>
                          )}
                        </div>
                      )}
                      {selectedOrder.customer?.address && (
                        <div className={`flex items-start gap-1.5 text-[11px] pt-1 border-t ${
                          theme === 'dark' ? 'text-slate-500 dark:text-stone-400 border-slate-200 dark:border-white/5' : 'text-slate-600 border-slate-200'
                        }`}>
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{selectedOrder.customer.address}</span>
                        </div>
                      )}
                      {(selectedOrder.tableNumber || selectedOrder.serverName) && (
                        <div className={`flex items-center justify-between text-[11px] pt-1 border-t ${
                          theme === 'dark' ? 'text-amber-300/90 border-slate-200 dark:border-white/5' : 'text-amber-700 border-slate-200'
                        }`}>
                          {selectedOrder.tableNumber && <span>Table: <strong>#{selectedOrder.tableNumber}</strong></span>}
                          {selectedOrder.serverName && <span>Server: <strong>{selectedOrder.serverName}</strong></span>}
                        </div>
                      )}
                      {selectedOrder.notes && (
                        <div className={`text-[10.5px] italic p-1.5 rounded-lg border ${
                          theme === 'dark' ? 'text-slate-500 dark:text-stone-400 bg-slate-100 dark:bg-stone-950/60 border-slate-200 dark:border-white/5' : 'text-slate-600 bg-slate-50 border-slate-200'
                        }`}>
                          Note: {selectedOrder.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items Table */}
                  <div className={`border rounded-xl overflow-hidden ${
                    theme === 'dark' ? 'bg-white dark:bg-stone-900/60 border-slate-200 dark:border-white/5' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className={`p-2 border-b text-[10px] font-bold uppercase tracking-wider flex justify-between ${
                      theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950/90 border-slate-200 dark:border-white/5 text-slate-500 dark:text-stone-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <span>Item Description</span>
                      <span>Total</span>
                    </div>
                    <div className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
                      {selectedOrder.items.map((it, idx) => (
                        <div key={idx} className="p-2 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <div className={`font-semibold ${theme === 'dark' ? 'text-stone-200' : 'text-slate-900'}`}>
                              <span className="text-emerald-500 font-mono font-bold mr-1.5">{it.quantity}x</span>
                              {it.name}
                            </div>
                            {it.flavor && (
                              <div className="text-[10px] text-amber-500 font-medium">{it.flavor}</div>
                            )}
                            {it.modifiers && it.modifiers.length > 0 && (
                              <div className={`text-[9.5px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                                +{it.modifiers.map(m => m.name).join(', ')}
                              </div>
                            )}
                          </div>
                          <span className={`font-mono font-bold shrink-0 ${theme === 'dark' ? 'text-stone-200' : 'text-slate-800'}`}>
                            PKR {(it.price * it.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className={`border rounded-xl p-2.5 space-y-1 text-xs font-mono ${
                    theme === 'dark' ? 'bg-white dark:bg-stone-900/80 border-slate-200 dark:border-white/5' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className={`flex justify-between text-[11px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                      <span>Subtotal:</span>
                      <span>PKR {selectedOrder.subtotal?.toLocaleString() || selectedOrder.total.toLocaleString()}</span>
                    </div>
                    {selectedOrder.discount ? (
                      <div className="flex justify-between text-red-500 text-[11px]">
                        <span>Discount:</span>
                        <span>- PKR {selectedOrder.discount.toLocaleString()}</span>
                      </div>
                    ) : null}
                    {selectedOrder.tax ? (
                      <div className={`flex justify-between text-[11px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                        <span>GST Tax:</span>
                        <span>PKR {selectedOrder.tax.toLocaleString()}</span>
                      </div>
                    ) : null}
                    <div className={`flex justify-between font-bold text-sm pt-1 border-t ${
                      theme === 'dark' ? 'text-white border-slate-200 dark:border-white/5' : 'text-slate-900 border-slate-200'
                    }`}>
                      <span>Net Total:</span>
                      <span className="text-emerald-500">PKR {selectedOrder.total.toLocaleString()}</span>
                    </div>
                    <div className="pt-1.5">
                      {selectedOrder.paymentStatus?.toUpperCase() === 'PAID' ? (
                        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 font-bold text-[10px] uppercase text-center py-1 rounded-lg">
                          ✓ Paid via {selectedOrder.paymentMethod || 'Cash'}
                        </div>
                      ) : (
                        <div className="bg-red-500/15 border border-red-500/30 text-red-500 font-bold text-[10px] uppercase text-center py-1 rounded-lg flex items-center justify-between px-2">
                          <span>⚠️ Unpaid</span>
                          <span>PKR {selectedOrder.total.toLocaleString()} Due</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Order Action Bar */}
                <div className={`p-2.5 border-t space-y-2 shrink-0 ${
                  theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 border-slate-300 dark:border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  {/* Primary Workflow Advance */}
                  {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        const isDelivery = selectedOrder.type === 'delivery' || selectedOrder.orderType === 'delivery';
                        const isReadyToComplete = (!isDelivery && selectedOrder.status === 'ready') || (isDelivery && (selectedOrder.status === 'dispatched' || selectedOrder.status === 'delivered'));
                        if (isReadyToComplete) {
                          handleOneClickCashout(selectedOrder);
                        } else {
                          handleOneClickDispatch(selectedOrder);
                        }
                      }}
                      className={`w-full py-2.5 font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                        ((selectedOrder.type !== 'delivery' && selectedOrder.orderType !== 'delivery') && selectedOrder.status === 'ready') ||
                        ((selectedOrder.type === 'delivery' || selectedOrder.orderType === 'delivery') && (selectedOrder.status === 'dispatched' || selectedOrder.status === 'delivered'))
                          ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-[1.01]'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                      }`}
                    >
                      {((selectedOrder.type !== 'delivery' && selectedOrder.orderType !== 'delivery') && selectedOrder.status === 'ready') ||
                      ((selectedOrder.type === 'delivery' || selectedOrder.orderType === 'delivery') && (selectedOrder.status === 'dispatched' || selectedOrder.status === 'delivered')) ? (
                        <DollarSign className="w-4 h-4" />
                      ) : (
                        <ChefHat className="w-4 h-4" />
                      )}
                      <span>
                        {selectedOrder.status === 'pending' || selectedOrder.status === 'open' || selectedOrder.status === 'PUNCHED' || selectedOrder.status === 'MODIFIED'
                          ? 'Send to Kitchen'
                          : selectedOrder.status === 'in_kitchen'
                          ? 'Mark as Ready'
                          : selectedOrder.status === 'ready'
                          ? ((selectedOrder.type === 'delivery' || selectedOrder.orderType === 'delivery') ? 'Dispatch Rider' : 'Cashout & Complete Order')
                          : 'Cashout & Complete Order'}
                      </span>
                    </button>
                  )}

                  {/* Cashout / Settle Action (Always visible on all active orders) */}
                  {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => handleOneClickCashout(selectedOrder)}
                      className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {selectedOrder.paymentStatus?.toUpperCase() === 'PAID'
                          ? `Settle / Change Payment (PKR ${selectedOrder.total.toLocaleString()})`
                          : `Cashout Order (PKR ${selectedOrder.total.toLocaleString()})`}
                      </span>
                    </button>
                  )}

                  {selectedOrder.status === 'completed' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Order Completed & Closed</span>
                      </span>
                      <span className="text-[11px] font-mono">
                        {selectedOrder.paymentMethod ? selectedOrder.paymentMethod.toUpperCase() : 'CASH'} • PKR {selectedOrder.total.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Print Options & Quick Actions */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handlePrintReceipt(selectedOrder)}
                      className={`py-1.5 font-bold text-[11px] rounded-xl border flex items-center justify-center gap-1 cursor-pointer transition ${
                        theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border-slate-300 dark:border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                      title="Print Customer Receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                    <button
                      onClick={() => handlePrintKOT(selectedOrder)}
                      className="py-1.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-500 font-bold text-[11px] rounded-xl border border-amber-500/30 flex items-center justify-center gap-1 cursor-pointer transition"
                      title="Print Kitchen Order Ticket"
                    >
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>KOT</span>
                    </button>
                    <button
                      onClick={() => setMiddleTab('active_ticket')}
                      className={`py-1.5 font-bold text-[11px] rounded-xl border flex items-center justify-center gap-1 cursor-pointer transition ${
                        theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-emerald-400 border-slate-300 dark:border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-emerald-600 border-slate-300'
                      }`}
                      title="Punch New Ticket"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Ticket</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ALL ORDERS STREAM & COMPREHENSIVE LEDGER                          */}
        {/* ========================================================================= */}
        {middleTab === 'all_orders' && (
          <div className="flex-1 flex flex-col overflow-hidden justify-between">
            {/* Filter Chips & Search */}
            <div className={`p-2 border-b space-y-1.5 shrink-0 ${
              theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 border-slate-300 dark:border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by Order #, Phone, Name, Table..."
                  value={allOrdersSearch}
                  onChange={(e) => setAllOrdersSearch(e.target.value)}
                  className={`w-full border rounded-xl pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 ${
                    theme === 'dark' ? 'bg-white dark:bg-stone-900 border-slate-300 dark:border-white/10 text-white placeholder:text-slate-400 dark:text-stone-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'}`} />
                {allOrdersSearch && (
                  <button
                    onClick={() => setAllOrdersSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'punched', label: 'Punched' },
                  { id: 'in_kitchen', label: 'Kitchen' },
                  { id: 'ready', label: 'Ready' },
                  { id: 'delivery', label: 'Delivery' },
                  { id: 'completed', label: 'Done' },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setAllOrdersStatusFilter(st.id)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg whitespace-nowrap cursor-pointer transition border ${
                      allOrdersStatusFilter === st.id
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                        : theme === 'dark'
                        ? 'bg-white dark:bg-stone-900 text-slate-500 dark:text-stone-400 border-slate-200 dark:border-white/5 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
              {filteredAllOrders.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center p-6 text-center space-y-2 ${
                  theme === 'dark' ? 'text-slate-400 dark:text-stone-500' : 'text-slate-400'
                }`}>
                  <Database className={`w-8 h-8 stroke-1 ${theme === 'dark' ? 'text-stone-700' : 'text-slate-300'}`} />
                  <p className="text-xs font-semibold">No matching orders found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                {filteredAllOrders.map((ord) => {
                  const isSelected = selectedOrderId === ord.id;
                  const ordSt = (ord.status || '').toLowerCase();
                  const isCancelled = ordSt === 'cancelled' || ordSt === 'refunded' || ordSt === 'void';
                  const isDelivered = ordSt === 'delivered' || ordSt === 'completed' || ordSt === 'ready';
                  const isOnTheWay = ordSt === 'dispatched' || ordSt === 'on_the_way';

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                        setMiddleTab('order_details');
                      }}
                      className={`relative overflow-hidden border-2 rounded-xl p-2.5 transition cursor-pointer text-xs space-y-1.5 ${
                        isSelected 
                          ? 'border-emerald-400/90 ring-1 ring-emerald-400/50 bg-stone-900/90 shadow-[0_0_15px_rgba(52,211,153,0.25)]' 
                          : isCancelled
                          ? theme === 'dark'
                            ? 'bg-gradient-to-b from-[#241016] to-[#120a0d] border-rose-500/80 shadow-[0_0_14px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/30'
                            : 'bg-red-50/60 border-red-400 shadow-xs'
                          : isDelivered
                          ? theme === 'dark'
                            ? 'bg-gradient-to-b from-[#0c2015] to-[#08120c] border-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.22)] ring-1 ring-emerald-400/30'
                            : 'bg-emerald-50/60 border-emerald-400 shadow-xs'
                          : isOnTheWay
                          ? theme === 'dark'
                            ? 'bg-gradient-to-b from-[#22160a] to-[#120d06] border-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.22)] ring-1 ring-orange-400/30'
                            : 'bg-amber-50/60 border-amber-400 shadow-xs'
                          : theme === 'dark'
                          ? 'bg-white dark:bg-stone-900/90 hover:bg-slate-100 dark:hover:bg-stone-800/90 border-slate-200 dark:border-white/10'
                          : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Top Ambient Glow Strip */}
                      <div
                        className={`absolute top-0 left-0 right-0 h-0.5 ${
                          isCancelled
                            ? 'bg-gradient-to-r from-rose-500 via-rose-300 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                            : isDelivered
                            ? 'bg-gradient-to-r from-emerald-500 via-green-300 to-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                            : isOnTheWay
                            ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                            : 'bg-transparent'
                        }`}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            #{ord.orderNumber.replace('ORD-', '')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getStatusBadgeStyle(ord.status)}`}>
                            {getStatusLabel(ord.status)}
                          </span>
                        </div>
                        <span className="font-mono font-black text-emerald-500">
                          PKR {ord.total.toLocaleString()}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between text-[10.5px] ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                        <span className="capitalize">{ord.type.replace('_', ' ')} {ord.tableNumber ? `• T#${ord.tableNumber}` : ''}</span>
                        <span>{new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {(ord.customer?.name || ord.customer?.phone) && (
                        <div className={`text-[10px] truncate ${theme === 'dark' ? 'text-slate-700 dark:text-stone-300' : 'text-slate-700'}`}>
                          {ord.customer.name} {ord.customer.phone ? `(${ord.customer.phone})` : ''}
                        </div>
                      )}

                      <div className={`text-[10.5px] truncate ${theme === 'dark' ? 'text-slate-500 dark:text-stone-400' : 'text-slate-500'}`}>
                        {ord.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>

                      <div className={`flex items-center gap-1 pt-1 border-t ${theme === 'dark' ? 'border-slate-200 dark:border-white/5' : 'border-slate-200'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(ord.id);
                            setMiddleTab('order_details');
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer flex-1 ${
                            theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 border-slate-300 dark:border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          }`}
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintReceipt(ord);
                          }}
                          className={`p-1 rounded-lg border cursor-pointer ${
                            theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 hover:text-white border-slate-300 dark:border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                          title="Print Receipt"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintKOT(ord);
                          }}
                          className="p-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 cursor-pointer"
                          title="Print KOT"
                        >
                          <ChefHat className="w-3 h-3" />
                        </button>
                        {ord.paymentStatus?.toUpperCase() !== 'PAID' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOneClickCashout(ord);
                            }}
                            className="px-2 py-1 bg-emerald-500/15 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-600 hover:text-white cursor-pointer"
                          >
                            Cashout
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>

            {/* Quick Action Footer */}
            <div className={`p-2 border-t shrink-0 ${
              theme === 'dark' ? 'bg-slate-100 dark:bg-stone-950 border-slate-300 dark:border-white/10' : 'bg-white border-slate-200'
            }`}>
              <button
                onClick={() => setMiddleTab('active_ticket')}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Punch New Order Ticket</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      
      {/* CASHOUT MODAL */}
      {isCashoutModalOpen && selectedOrderForCashout && (() => {
        const orderTotal = selectedOrderForCashout.total;
        const rawTendered = cashoutTenderedInput.trim();
        const tenderedVal = rawTendered === '' ? 0 : parseFloat(rawTendered) || 0;
        const hasInput = rawTendered !== '';
        const isShort = tenderedVal < orderTotal;
        const isExact = tenderedVal === orderTotal && hasInput;
        const isExcess = tenderedVal > orderTotal;
        const shortage = Math.max(0, orderTotal - tenderedVal);
        const changeToReturn = Math.max(0, tenderedVal - orderTotal);
        const canCashout = !isShort && hasInput && tenderedVal > 0;

        const handleSetExact = () => {
          setCashoutTenderedInput(orderTotal.toString());
        };

        const handleAddPreset = (amount: number) => {
          const current = parseFloat(cashoutTenderedInput) || 0;
          setCashoutTenderedInput((current + amount).toString());
        };

        const handleSetDirect = (amount: number) => {
          setCashoutTenderedInput(amount.toString());
        };

        const handleSelectMethod = (method: 'cash' | 'card' | 'online') => {
          setCashoutPaymentMethod(method);
          if (method === 'card' || method === 'online') {
            if (!hasInput || tenderedVal === 0) {
              setCashoutTenderedInput(orderTotal.toString());
            }
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-gradient-to-b from-stone-900 via-[#141414] to-stone-950 border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 my-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-300 dark:border-white/10 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">
                      Cashout & Settle Order
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-stone-400 mt-1 flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold">
                      Order #{selectedOrderForCashout.orderNumber.replace('ORD-', '')}
                    </span>
                    <span>•</span>
                    <span className="uppercase font-semibold text-slate-700 dark:text-stone-300">
                      {selectedOrderForCashout.type.replace('_', ' ')}
                    </span>
                    {selectedOrderForCashout.customer?.name && (
                      <>
                        <span>•</span>
                        <span className="text-slate-700 dark:text-stone-300">{selectedOrderForCashout.customer.name}</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setIsCashoutModalOpen(false)}
                  className="text-slate-500 dark:text-stone-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Total Amount Banner */}
              <div className="bg-gradient-to-br from-stone-950 via-stone-900/90 to-stone-950 rounded-2xl p-4 border border-emerald-500/20 mb-5 relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] tracking-wider text-slate-500 dark:text-stone-400 uppercase font-black block">
                      Total Payable Amount
                    </span>
                    <div className="text-3xl font-mono font-black text-emerald-400 mt-0.5">
                      PKR {orderTotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase font-semibold block">Order Items</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-stone-300">
                      {selectedOrderForCashout.items.reduce((acc, i) => acc + i.quantity, 0)} Items
                    </span>
                    <div className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">
                      Subtotal: PKR {(selectedOrderForCashout.subtotal || orderTotal).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector (Cash, Card, Online) */}
              <div className="mb-5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300 block mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => handleSelectMethod('cash')}
                    className={`py-3 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer border ${
                      cashoutPaymentMethod === 'cash'
                        ? 'bg-gradient-to-b from-emerald-600/30 to-emerald-950/40 text-emerald-300 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
                        : 'bg-slate-100 dark:bg-stone-950/80 text-slate-500 dark:text-stone-400 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    <Banknote className={`w-5 h-5 ${cashoutPaymentMethod === 'cash' ? 'text-emerald-400' : 'text-slate-500 dark:text-stone-400'}`} />
                    <span>Cash</span>
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectMethod('card')}
                    className={`py-3 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer border ${
                      cashoutPaymentMethod === 'card'
                        ? 'bg-gradient-to-b from-blue-600/30 to-blue-950/40 text-blue-300 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-400/50'
                        : 'bg-slate-100 dark:bg-stone-950/80 text-slate-500 dark:text-stone-400 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    <CreditCard className={`w-5 h-5 ${cashoutPaymentMethod === 'card' ? 'text-blue-400' : 'text-slate-500 dark:text-stone-400'}`} />
                    <span>Card / POS</span>
                  </button>

                  {/* Online */}
                  <button
                    type="button"
                    onClick={() => handleSelectMethod('online')}
                    className={`py-3 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer border ${
                      cashoutPaymentMethod === 'online'
                        ? 'bg-gradient-to-b from-purple-600/30 to-purple-950/40 text-purple-300 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/50'
                        : 'bg-slate-100 dark:bg-stone-950/80 text-slate-500 dark:text-stone-400 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    <Globe className={`w-5 h-5 ${cashoutPaymentMethod === 'online' ? 'text-purple-400' : 'text-slate-500 dark:text-stone-400'}`} />
                    <span>Online / Raast</span>
                  </button>
                </div>
              </div>

              {/* Tally / Amount Received Input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300">
                    Amount Received in Tally / Register
                  </label>
                  <button
                    type="button"
                    onClick={handleSetExact}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Exact Total (PKR {orderTotal.toLocaleString()})</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-500 dark:text-stone-400 font-mono font-bold text-sm pointer-events-none">
                    PKR
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    autoFocus
                    value={cashoutTenderedInput}
                    onChange={(e) => setCashoutTenderedInput(e.target.value)}
                    placeholder={`e.g. ${orderTotal.toLocaleString()} (Enter amount given)`}
                    className="w-full bg-slate-100 dark:bg-stone-950 border border-slate-300 dark:border-white/15 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-14 pr-14 py-3 text-lg font-mono font-black text-slate-900 dark:text-white placeholder:text-stone-600 transition-all outline-none"
                  />
                  {cashoutTenderedInput && (
                    <button
                      type="button"
                      onClick={() => setCashoutTenderedInput('')}
                      className="absolute right-3 text-slate-500 dark:text-stone-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Presets & Denominations */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <button
                    type="button"
                    onClick={handleSetExact}
                    className="px-2.5 py-1 bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 border border-slate-300 dark:border-white/10 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:scale-105"
                  >
                    Exact
                  </button>
                  {[500, 1000, 2000, 5000].map((denom) => (
                    <button
                      key={denom}
                      type="button"
                      onClick={() => handleSetDirect(denom)}
                      className="px-2.5 py-1 bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-white/10 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all hover:scale-105"
                    >
                      {denom.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddPreset(100)}
                    className="px-2 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-800/40 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPreset(500)}
                    className="px-2 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-800/40 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPreset(1000)}
                    className="px-2 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-800/40 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all"
                  >
                    +1,000
                  </button>
                </div>
              </div>

              {/* Difference Status Box: Short vs Exact vs Excess */}
              <div className="mb-5">
                {!hasInput || tenderedVal === 0 ? (
                  <div className="bg-slate-100 dark:bg-stone-950/60 border border-slate-300 dark:border-white/10 rounded-xl p-3 flex items-center justify-between text-slate-500 dark:text-stone-400">
                    <span className="text-xs font-medium">Please enter amount in tally to verify settlement</span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-stone-500">Due: PKR {orderTotal.toLocaleString()}</span>
                  </div>
                ) : isShort ? (
                  <div className="bg-red-950/40 border-2 border-red-500/50 rounded-xl p-3.5 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="font-black text-xs uppercase tracking-wider text-red-400">
                          AMOUNT IS SHORT
                        </span>
                      </div>
                      <span className="font-mono text-lg font-black text-red-400">
                        - PKR {shortage.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-red-300/90 mt-1.5 leading-snug">
                      Amount entered (PKR {tenderedVal.toLocaleString()}) is less than order total (PKR {orderTotal.toLocaleString()}).
                      <strong className="block text-red-200 mt-0.5">
                        Unable to cashout order until full PKR {shortage.toLocaleString()} is collected.
                      </strong>
                    </p>
                  </div>
                ) : isExact ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 text-emerald-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span className="font-black text-xs uppercase tracking-wider text-emerald-400">
                          EXACT AMOUNT RECEIVED
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        CHANGE: PKR 0
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80 mt-1">
                      Customer paid exact total of PKR {orderTotal.toLocaleString()}. No change needed.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border-2 border-emerald-500/60 rounded-xl p-3.5 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
                        <span className="font-black text-xs uppercase tracking-wider text-emerald-400">
                          RETURN CHANGE TO CUSTOMER
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400/80 uppercase font-bold block">Change to Return</span>
                        <span className="font-mono text-xl font-black text-emerald-300">
                          PKR {changeToReturn.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11.5px] text-emerald-300/90 mt-1.5 flex items-center justify-between border-t border-emerald-500/20 pt-1.5">
                      <span>Customer tendered: <strong className="font-mono">PKR {tenderedVal.toLocaleString()}</strong></span>
                      <span>Order total: <strong className="font-mono">PKR {orderTotal.toLocaleString()}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!canCashout || isCashoutSubmitting}
                  onClick={() => submitCashout(cashoutPaymentMethod, tenderedVal, changeToReturn)}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 border shadow-lg ${
                    canCashout && !isCashoutSubmitting
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer active:scale-98 shadow-[0_0_20px_rgba(16,185,129,0.35)] border-emerald-400/30'
                      : 'bg-white dark:bg-stone-900 text-slate-400 dark:text-stone-500 border-slate-200 dark:border-white/5 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isCashoutSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Processing Settlement...</span>
                    </span>
                  ) : isShort ? (
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>Unable to Cashout — Short by PKR {shortage.toLocaleString()}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>
                        Complete Cashout ({cashoutPaymentMethod.toUpperCase()}
                        {isExcess ? ` • Return PKR ${changeToReturn.toLocaleString()}` : ''})
                      </span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCashoutModalOpen(false)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-500 dark:text-stone-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-stone-950/60 hover:bg-slate-100 dark:hover:bg-stone-800 border border-slate-300 dark:border-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FLAVOR & VARIANT PICKER MODAL                                             */}
      {/* ========================================================================= */}
      {activeFlavorModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-white/10 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-stone-100 text-sm">
                Select Flavor: {activeFlavorModalItem.name}
              </h3>
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="text-slate-500 dark:text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
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
                      : 'bg-slate-100 dark:bg-stone-950/60 text-slate-700 dark:text-stone-300 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-stone-800/80 hover:text-slate-900 dark:text-white'
                  }`}
                >
                  {flavor}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300 dark:border-white/10">
              <button
                onClick={() => setActiveFlavorModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 dark:text-stone-100 text-sm">Apply Order Discount (%)</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="flex-1 bg-slate-100 dark:bg-stone-950 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Discount % (e.g. 10)"
              />
              <span className="font-bold text-slate-500 dark:text-stone-400 text-sm">%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscountInput(d.toString())}
                  className="py-1.5 bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 border border-slate-300 dark:border-white/10 rounded-lg text-xs font-bold text-stone-200 transition-all cursor-pointer hover:scale-105"
                >
                  {d}%
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300 dark:border-white/10">
              <button
                onClick={() => setShowDiscountPrompt(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-slate-300 dark:border-white/10 ring-1 ring-white/10 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 dark:text-stone-100 text-sm">Add Extra Service Charges (PKR)</h3>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 dark:text-stone-400 text-xs">PKR</span>
              <input
                type="number"
                min="0"
                value={chargesInput}
                onChange={(e) => setChargesInput(e.target.value)}
                className="flex-1 bg-slate-100 dark:bg-stone-950 border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="Charges amount"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300 dark:border-white/10">
              <button
                onClick={() => setShowChargesPrompt(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-stone-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
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
        title={posCart.customer?.name || foundCustomer?.name ? `Edit Customer Details` : "New Customer Details"}
        initialData={{
          name: posCart.customer?.name || foundCustomer?.name || '',
          phone: posCart.customer?.phone || foundCustomer?.phone || phoneSearchInput || '',
          address: posCart.customer?.address || foundCustomer?.address || '',
          notes: posCart.customer?.notes || foundCustomer?.deliveryNotes || '',
        }}
        onSave={async (data) => {
          setPosCustomerField('phone', data.phone);
          setPosCustomerField('name', data.name);
          setPosCustomerField('address', data.address);
          setPosCustomerField('notes', data.notes || '');
          setPhoneSearchInput(data.phone);
          try {
            const saved = await upsertCustomer({
              name: data.name,
              phone: data.phone,
              address: data.address,
              notes: data.notes,
            });
            if (saved) {
              setFoundCustomer(saved);
              setCustomerLookupStatus('found');
              setPosCustomerField('phone', saved.phone || data.phone);
              setPosCustomerField('name', saved.name);
              setPosCustomerField('address', saved.address || data.address);
              setPosCustomerField('notes', saved.notes || saved.deliveryNotes || data.notes || '');
            }
            showToast(`✓ Updated customer details: ${data.name}`);
          } catch (e) {
            console.error(e);
            showToast(`❌ Error saving customer details`);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* CUSTOMER HISTORY VIEW MODAL                                               */}
      {/* ========================================================================= */}
      <CustomerViewModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={foundCustomer || (posCart.customer?.name ? (posCart.customer as any) : null)}
        pastOrders={[]}
        onEditCustomer={() => setIsCustomerManageModalOpen(true)}
      />

      <CancelOrderModal
        order={cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onCancelled={() => {
          playErrorSound();
          showToast(`✕ Order cancelled successfully`);
        }}
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

      {/* ========================================================================= */}
      {/* CUSTOMER BLOCKING REASON MODAL                                            */}
      {/* ========================================================================= */}
      <BlockCustomerModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        phone={blockTargetPhone}
        customerName={blockTargetName}
        onConfirmBlock={async (reason) => {
          const res = await blockCustomer(blockTargetPhone, reason, currentUser?.name);
          if (res.success) {
            setCustomerLookupStatus('found');
            setIsBlockedAlertOpen(true);
            setBlockedAlertPhone(blockTargetPhone);
            setBlockedAlertCustomer(
              res.customer || customers.find((c) => (c.phone || '').replace(/\D/g, '') === blockTargetPhone) || null
            );
          }
        }}
      />

      {/* ========================================================================= */}
      {/* BLOCKED CUSTOMER CANNOT PLACE ORDER ALERT POPUP                           */}
      {/* ========================================================================= */}
      <BlockedCustomerAlertModal
        isOpen={isBlockedAlertOpen}
        onClose={() => setIsBlockedAlertOpen(false)}
        customer={blockedAlertCustomer || foundCustomer}
        phone={blockedAlertPhone || cleanPhoneDigits}
        onClearCustomer={() => {
          setPhoneSearchInput('');
          setCustomerLookupStatus('idle');
          setFoundCustomer(null);
          setPosCustomerField('phone', '');
          setPosCustomerField('name', '');
          setPosCustomerField('address', '');
          setPosCustomerField('notes', '');
          showToast('Customer cleared from cart.');
        }}
        onUnblockCustomer={async (phoneToUnblock) => {
          const res = await unblockCustomer(phoneToUnblock);
          if (res.success) {
            setFoundCustomer((prev) =>
              prev
                ? {
                    ...prev,
                    isBlocked: false,
                    blockReason: undefined,
                    blockedAt: undefined,
                    blockedBy: undefined,
                  }
                : null
            );
            setBlockedAlertCustomer(null);
            setIsBlockedAlertOpen(false);
            setCustomerLookupStatus('idle');
          }
        }}
        onViewHistory={() => {
          setIsCustomerHistoryOpen(true);
        }}
      />

      {isCustomerHistoryOpen && (
        <CustomerHistoryView 
          initialPhone={phoneSearchInput || posCart.customer?.phone}
          onClose={() => setIsCustomerHistoryOpen(false)}
        />
      )}
    </div>
  );
};
