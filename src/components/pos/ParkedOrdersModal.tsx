import React from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ParkedOrder } from '../../types';
import { X, PauseCircle, PlayCircle, Trash2, Clock, User, Phone, DollarSign } from 'lucide-react';

interface ParkedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ParkedOrdersModal: React.FC<ParkedOrdersModalProps> = ({ isOpen, onClose }) => {
  const { parkedOrders, recallParkedOrder, deleteParkedOrder } = useRestaurant();

  if (!isOpen) return null;

  const handleRecall = async (order: ParkedOrder) => {
    await recallParkedOrder(order.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <PauseCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Parked / Held Orders</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                {parkedOrders.length} {parkedOrders.length === 1 ? 'order' : 'orders'} currently held on register
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Parked Orders */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {parkedOrders.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <PauseCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold text-stone-400">No orders currently parked</p>
              <p className="text-xs text-stone-500 mt-1">
                You can hold any active cart from the POS pad by clicking "Park Ticket"
              </p>
            </div>
          ) : (
            parkedOrders.map((p) => {
              const timeFormatted = new Date(p.parkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={p.id}
                  className="bg-stone-950/80 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-amber-500/30 transition-all shadow-inner"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 font-mono text-xs font-black border border-amber-500/30">
                        {p.cart?.tableNumber || (p as any).tableNumber || 'Table 1'}
                      </span>
                      <span className="text-[10px] font-black text-stone-300 uppercase tracking-wider">
                        {(p.cart?.orderType || (p as any).orderType || 'takeaway').replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {timeFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-stone-300">
                      <span className="flex items-center gap-1 font-bold">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        {p.cart?.customer?.name || (p as any).customerName || p.title || 'Guest'}
                      </span>
                      {(p.cart?.customer?.phone || (p as any).customerPhone) && (
                        <span className="flex items-center gap-1 text-stone-400 font-mono">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          {p.cart?.customer?.phone || (p as any).customerPhone}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-400 truncate max-w-md">
                      {(p.cart?.items || (p as any).items || []).map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                    </p>

                    {(p.cart?.notes || (p as any).notes) && (
                      <p className="text-[11px] text-amber-400/90 italic bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-block">Note: "{p.cart?.notes || (p as any).notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                    <div className="text-right">
                      <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider block">Items ({(p.cart?.items || (p as any).items || []).length})</span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        PKR {((p.cart?.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0) || (p as any).subtotal || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteParkedOrder(p.id)}
                        className="p-2 rounded-xl bg-stone-900 border border-white/5 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 transition-all cursor-pointer"
                        title="Delete Held Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRecall(p)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg border border-amber-400/20 transition-all cursor-pointer active:scale-95"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Resume</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-stone-950/60 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-white/5 text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
