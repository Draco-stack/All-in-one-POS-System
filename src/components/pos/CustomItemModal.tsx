import React, { useState } from 'react';
import { X, Plus, DollarSign } from 'lucide-react';

interface CustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomItem: (name: string, price: number, quantity: number, notes?: string) => void;
}

export const CustomItemModal: React.FC<CustomItemModalProps> = ({ isOpen, onClose, onAddCustomItem }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (!name.trim() || isNaN(numPrice) || numPrice < 0) return;

    onAddCustomItem(name.trim(), numPrice, quantity, notes.trim());
    setName('');
    setPrice('');
    setQuantity(1);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] border border-white/10 ring-1 ring-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Add Custom / Open Item</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Add ad-hoc charges or specials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Item Name *</label>
            <input
              type="text"
              placeholder="e.g. Corkage Fee, Custom Dessert, Daily Chef Special"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Price (PKR) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-stone-400 text-xs font-mono font-bold">PKR</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full bg-stone-950/90 border border-white/10 rounded-xl pl-12 pr-3 py-2.5 text-xs text-stone-100 font-mono font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Quantity</label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono font-bold text-center focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Item Notes / Kitchen Prep</label>
            <input
              type="text"
              placeholder="Optional notes or details for receipt/kitchen"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg border border-emerald-400/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
