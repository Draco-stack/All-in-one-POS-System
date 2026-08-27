import React, { useState } from 'react';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { POSWorkstation } from './components/pos/POSWorkstation';
import { OrderQueueView } from './components/orders/OrderQueueView';
import { ShiftManagementView } from './components/shift/ShiftManagementView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserSwitchModal } from './components/auth/UserSwitchModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

import { ThermalReceipt } from './components/pos/ThermalReceipt';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<'pos' | 'orders' | 'shifts' | 'admin'>('pos');
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState<boolean>(false);
  const { toast, printQueueOrder, isLoggedIn } = useRestaurant();

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <>
      <div className="w-screen h-screen overflow-hidden flex flex-row bg-white text-stone-900 font-sans select-none no-scrollbar print:hidden">
        {/* Main View Area: Strict 3-Pane POS Workstation touching the absolute top of the screen */}
      <main className="w-full h-full flex overflow-hidden relative">
        <ErrorBoundary fallbackTitle="POS Workstation Error">
          {activeView === 'pos' && (
            <POSWorkstation
              onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
              onOpenOrdersView={() => setActiveView('orders')}
              onOpenAdminDashboard={() => setActiveView('admin')}
            />
          )}
          {activeView === 'orders' && (
            <div className="flex-1 flex flex-col h-full bg-[#1a1d24]">
              <div className="p-3 bg-[#232833] border-b border-stone-800 flex items-center justify-between">
                <button
                  onClick={() => setActiveView('pos')}
                  className="px-3 py-1.5 rounded-lg bg-[#00897b] text-white text-xs font-bold hover:bg-[#00796b] transition cursor-pointer"
                >
                  ← Back to POS Terminal
                </button>
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
          {activeView === 'admin' && (
            <div className="flex-1 flex flex-col h-full bg-stone-950 overflow-y-auto">
              <div className="p-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between sticky top-0 z-30 shadow-md">
                <button
                  onClick={() => setActiveView('pos')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#00897b] text-white text-xs font-bold hover:bg-[#00796b] transition cursor-pointer flex items-center gap-1.5"
                >
                  ← Back to Floor POS Workstation
                </button>
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

