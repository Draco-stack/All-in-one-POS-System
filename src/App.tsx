import React, { useState } from 'react';
import { ChefHat, Search } from 'lucide-react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { POSWorkstation } from './components/pos/POSWorkstation';
import { DeliveryMonitoringView } from './components/delivery/DeliveryMonitoringView';
import { OrderQueueView } from './components/orders/OrderQueueView';
import { AllOrdersSearchView } from './components/orders/AllOrdersSearchView';
import { ShiftManagementView } from './components/shift/ShiftManagementView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserSwitchModal } from './components/auth/UserSwitchModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThermalReceipt } from './components/pos/ThermalReceipt';
import { DeliveryDriverSlipModal } from './components/pos/DeliveryDriverSlipModal';
import { ReceiptModal } from './components/orders/ReceiptModal';
import { AppHeader } from './components/common/AppHeader';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<'delivery' | 'pos' | 'orders' | 'all-orders' | 'shifts' | 'admin'>('pos');
  const [orderSubTab, setOrderSubTab] = useState<'search' | 'kitchen'>('kitchen');
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState<boolean>(false);

  const {
    theme,
    toast,
    printQueueOrder,
    isLoggedIn,
    activeDeliverySlipOrder,
    setActiveDeliverySlipOrder,
    activeReceiptOrder,
    setActiveReceiptOrder,
    currentUser,
    isRestricted,
    orders,
  } = useRestaurant();

  React.useEffect(() => {
    if (!isLoggedIn) return;
    const viewMapping: Record<string, string> = {
      delivery: 'delivery',
      pos: 'pos',
      orders: 'kitchen',
      'all-orders': 'all-orders',
      shifts: 'shift',
      admin: 'staff',
    };

    const restrictionKey = viewMapping[activeView];
    if (restrictionKey && isRestricted(restrictionKey)) {
      const views: ('delivery' | 'pos' | 'orders' | 'all-orders' | 'shifts' | 'admin')[] = [
        'pos',
        'delivery',
        'orders',
        'all-orders',
        'shifts',
      ];
      const firstAllowed = views.find((v) => {
        const key = viewMapping[v];
        return !isRestricted(key);
      });
      if (firstAllowed) {
        setActiveView(firstAllowed);
      }
    }
  }, [activeView, isLoggedIn, currentUser, isRestricted]);

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  const activeKitchenCount = (orders || []).filter((o) =>
    ['pending', 'PUNCHED', 'MODIFIED', 'in_kitchen', 'ready'].includes(o.status)
  ).length;

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col font-sans select-none no-scrollbar transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#0c0c0e] text-stone-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* UNIFIED SINGLE HEADER ACCROSS THE ENTIRE APPLICATION */}
      <div className="print:hidden">
        <AppHeader
          activeView={activeView}
          setActiveView={setActiveView}
          orderSubTab={orderSubTab}
          setOrderSubTab={setOrderSubTab}
          onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
        />
      </div>

      {/* MAIN VIEWPORT BODY */}
      <main className="w-full flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative print:hidden">
        <ErrorBoundary fallbackTitle="POS Workstation Error">
          {activeView === 'delivery' && (
            <DeliveryMonitoringView
              onOpenPOS={() => setActiveView('pos')}
              onOpenKitchen={() => {
                setActiveView('orders');
                setOrderSubTab('kitchen');
              }}
              onOpenAdmin={() => setActiveView('admin')}
              onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
            />
          )}

          {activeView === 'pos' && (
            <POSWorkstation
              onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
              onOpenOrdersView={() => {
                setActiveView('orders');
                setOrderSubTab('kitchen');
              }}
              onOpenAdminDashboard={() => setActiveView('admin')}
              onOpenDeliveryMonitoring={() => setActiveView('delivery')}
              onOpenShiftsView={() => setActiveView('shifts')}
            />
          )}

          {activeView === 'all-orders' && (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <AllOrdersSearchView />
            </div>
          )}

          {activeView === 'orders' && (
            <div
              className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden transition-colors duration-200 ${
                theme === 'dark' ? 'bg-[#1a1d24]' : 'bg-slate-100'
              }`}
            >
              {/* KDS Sub-Tab Switcher */}
              <div
                className={`px-4 py-2 border-b flex items-center justify-between shrink-0 ${
                  theme === 'dark' ? 'bg-[#141720] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 p-1 rounded-xl border border-white/5 bg-black/20">
                  <button
                    onClick={() => setOrderSubTab('kitchen')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderSubTab === 'kitchen'
                        ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Kitchen Prep Tickets</span>
                    {activeKitchenCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-stone-950 text-amber-400 text-[9px] font-mono font-black">
                        {activeKitchenCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setOrderSubTab('search')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderSubTab === 'search'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Order Search & Filters</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {orderSubTab === 'search' ? <AllOrdersSearchView /> : <OrderQueueView />}
              </div>
            </div>
          )}

          {activeView === 'shifts' && (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto">
              <ShiftManagementView />
            </div>
          )}

          {activeView === 'admin' && (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto">
              <AdminDashboard />
            </div>
          )}
        </ErrorBoundary>

        {/* Global Toast Notification */}
        {toast && (
          <div className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200 backdrop-blur-md select-none ${
            theme === 'dark'
              ? 'bg-[#12141c]/95 border-emerald-500/30 text-stone-100 shadow-black/60 shadow-lg'
              : 'bg-white/95 border-emerald-500/40 text-slate-800 shadow-slate-300/60 shadow-lg'
          }`}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-medium tracking-tight">{toast}</span>
          </div>
        )}
      </main>

      {/* Global Modals */}
      <UserSwitchModal isOpen={isUserSwitchOpen} onClose={() => setIsUserSwitchOpen(false)} />

      <DeliveryDriverSlipModal
        order={activeDeliverySlipOrder}
        onClose={() => setActiveDeliverySlipOrder(null)}
      />

      <ReceiptModal
        isOpen={!!activeReceiptOrder}
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
      />

      <ThermalReceipt order={printQueueOrder} />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary fallbackTitle="Commercial POS Shell Failure">
      <RestaurantProvider>
        <AppContent />
      </RestaurantProvider>
    </ErrorBoundary>
  );
}

export default App;
