import React, { useState } from 'react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { POSWorkstation } from './components/pos/POSWorkstation';
import { DeliveryMonitoringView } from './components/delivery/DeliveryMonitoringView';
import { OrderQueueView } from './components/orders/OrderQueueView';
import { ShiftManagementView } from './components/shift/ShiftManagementView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserSwitchModal } from './components/auth/UserSwitchModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThermalReceipt } from './components/pos/ThermalReceipt';
import { DeliveryDriverSlipModal } from './components/pos/DeliveryDriverSlipModal';
import { ReceiptModal } from './components/pos/ReceiptModal';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<'delivery' | 'pos' | 'orders' | 'shifts' | 'admin'>('delivery');
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState<boolean>(false);
  const { toast, printQueueOrder, isLoggedIn, activeDeliverySlipOrder, setActiveDeliverySlipOrder, activeReceiptOrder, setActiveReceiptOrder } = useRestaurant();

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <>
      <div className="w-screen h-screen overflow-hidden flex flex-row bg-white text-stone-900 font-sans select-none no-scrollbar print:hidden">
        {/* Main View Area */}
      <main className="w-full h-full flex overflow-hidden relative">
        <ErrorBoundary fallbackTitle="POS Workstation Error">
          {activeView === 'delivery' && (
            <DeliveryMonitoringView
              onOpenPOS={() => setActiveView('pos')}
              onOpenKitchen={() => setActiveView('orders')}
              onOpenAdmin={() => setActiveView('admin')}
              onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
            />
          )}
          {activeView === 'pos' && (
            <POSWorkstation
              onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
              onOpenOrdersView={() => setActiveView('orders')}
              onOpenAdminDashboard={() => setActiveView('admin')}
              onOpenDeliveryMonitoring={() => setActiveView('delivery')}
              onOpenShiftsView={() => setActiveView('shifts')}
            />
          )}
          {activeView === 'orders' && (
            <div className="flex-1 flex flex-col h-full bg-[#1a1d24]">
              <div className="p-3 bg-[#232833] border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('delivery')}
                    className="px-3 py-1.5 rounded-lg bg-[#1e40af] text-white text-xs font-bold hover:bg-[#1d4ed8] transition cursor-pointer"
                  >
                    🛵 Delivery Monitoring
                  </button>
                  <button
                    onClick={() => setActiveView('pos')}
                    className="px-3 py-1.5 rounded-lg bg-[#00897b] text-white text-xs font-bold hover:bg-[#00796b] transition cursor-pointer"
                  >
                    ← Floor POS
                  </button>
                </div>
                <span className="text-xs font-bold text-stone-300">Live Kitchen Display & Order Dispatch</span>
                <button
                  onClick={() => setActiveView('admin')}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold transition cursor-pointer"
                >
                  Admin Console →
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <OrderQueueView />
              </div>
            </div>
          )}
          {activeView === 'shifts' && (
            <div className="flex-1 flex flex-col h-full bg-stone-950 overflow-y-auto">
              <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('delivery')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1e40af] text-white text-xs font-bold hover:bg-[#1d4ed8] transition cursor-pointer flex items-center gap-1.5"
                  >
                    🛵 Delivery Monitoring
                  </button>
                  <button
                    onClick={() => setActiveView('pos')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#00897b] text-white text-xs font-bold hover:bg-[#00796b] transition cursor-pointer flex items-center gap-1.5"
                  >
                    ← Floor POS
                  </button>
                  <button
                    onClick={() => setActiveView('admin')}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    Admin Console →
                  </button>
                </div>
                <div className="text-xs font-bold text-stone-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Shift Register & Cash Drawer Reconciliation
                </div>
                <button
                  onClick={() => setIsUserSwitchOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
                >
                  Switch User
                </button>
              </div>
              <div className="flex-1 p-4 md:p-6">
                <ShiftManagementView />
              </div>
            </div>
          )}
          {activeView === 'admin' && (
            <div className="flex-1 flex flex-col h-full bg-stone-950 overflow-y-auto">
              <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('delivery')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1e40af] text-white text-xs font-bold hover:bg-[#1d4ed8] transition cursor-pointer flex items-center gap-1.5"
                  >
                    🛵 Delivery Monitoring
                  </button>
                  <button
                    onClick={() => setActiveView('pos')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#00897b] text-white text-xs font-bold hover:bg-[#00796b] transition cursor-pointer flex items-center gap-1.5"
                  >
                    ← Floor POS
                  </button>
                </div>
                <div className="text-xs font-bold text-stone-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Whites Castle Administrative & Revenue Console
                </div>
                <button
                  onClick={() => setIsUserSwitchOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
                >
                  Switch User
                </button>
              </div>
              <div className="flex-1">
                <AdminDashboard />
              </div>
            </div>
          )}
        </ErrorBoundary>

        {/* Global Toast Notification */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-white px-4 py-2 rounded-xl shadow-2xl border border-stone-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toast}
          </div>
        )}
      </main>

      {/* Quick Staff User Switcher Modal */}
      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
      />
      </div>
      
      <DeliveryDriverSlipModal
        order={activeDeliverySlipOrder}
        onClose={() => setActiveDeliverySlipOrder(null)}
      />

      <ReceiptModal
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
      />

      <ThermalReceipt order={printQueueOrder} />
    </>
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

