import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { posDB } from '../../utils/indexedDB';
import { useRestaurant } from '../../context/RestaurantContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { currentUser, drainOfflineQueue } = useRestaurant();
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const [lastOnlineState, setLastOnlineState] = useState(isOnline);

  const checkPendingOrders = async () => {
    try {
      const orders = await posDB.getQueuedOrders(currentUser?.organizationId);
      setQueuedCount(orders.length);
    } catch (e) {
      // Ignore IndexedDB query errors
    }
  };

  useEffect(() => {
    checkPendingOrders();
    const interval = setInterval(checkPendingOrders, 4000);
    return () => clearInterval(interval);
  }, [currentUser?.organizationId]);

  useEffect(() => {
    if (!lastOnlineState && isOnline) {
      // Transitioned from offline to online
      setShowSyncedToast(true);
      const t = setTimeout(() => setShowSyncedToast(false), 4000);
      return () => clearTimeout(t);
    }
    setLastOnlineState(isOnline);
  }, [isOnline, lastOnlineState]);

  const triggerManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await drainOfflineQueue();
      await checkPendingOrders();
    } catch (err) {
      console.warn('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no pending orders and no recent sync toast, show nothing
  if (isOnline && queuedCount === 0 && !showSyncedToast) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9990] flex flex-col gap-2 max-w-md pointer-events-auto">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div
          id="offline-status-banner"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-amber-950/90 text-amber-100 border border-amber-500/60 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 ring-2 ring-amber-500/30"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black text-amber-200 tracking-wide uppercase text-[11px]">
                Offline Mode Active
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <p className="text-[11px] text-amber-300/90 leading-tight mt-0.5">
              Service Worker & IndexedDB caching enabled. Orders continue punching locally!
            </p>
            {queuedCount > 0 && (
              <div className="mt-1 font-mono font-bold text-[10px] text-amber-200">
                {queuedCount} {queuedCount === 1 ? 'order' : 'orders'} pending auto-sync
              </div>
            )}
          </div>
        </div>
      )}

      {/* Online with pending queue sync banner */}
      {isOnline && queuedCount > 0 && (
        <div
          id="offline-pending-sync-banner"
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-sky-950/90 text-sky-100 border border-sky-500/60 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-center gap-2 text-xs">
            <RefreshCw className={`w-4 h-4 text-sky-300 ${isSyncing ? 'animate-spin' : ''}`} />
            <div>
              <span className="font-bold text-sky-200">Online Restored</span>
              <p className="text-[10px] text-sky-300/80">
                Syncing {queuedCount} offline {queuedCount === 1 ? 'order' : 'orders'}...
              </p>
            </div>
          </div>
          <button
            onClick={triggerManualSync}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition shadow-xs disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Reconnected notification */}
      {showSyncedToast && isOnline && queuedCount === 0 && (
        <div
          id="offline-restored-toast"
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-950/90 text-emerald-100 border border-emerald-500/50 shadow-xl backdrop-blur-md animate-in fade-in duration-300"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-200">
            Internet reconnected. All POS assets & orders synced!
          </span>
        </div>
      )}
    </div>
  );
};
