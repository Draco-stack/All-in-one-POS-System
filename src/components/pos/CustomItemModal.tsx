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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Add Custom / Open Item</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-stone-300">Item Name *</label>
            <input
              type="text"
              placeholder="e.g. Corkage Fee, Custom Dessert, Daily Chef Special"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-stone-300">Price ($) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-stone-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-7 pr-3 py-2.5 text-sm text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-stone-300">Quantity</label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-100 font-mono text-center focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-stone-300">Item Notes / Kitchen Prep</label>
            <input
              type="text"
              placeholder="Optional notes or details for receipt/kitchen"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/30 transition cursor-pointer"
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
