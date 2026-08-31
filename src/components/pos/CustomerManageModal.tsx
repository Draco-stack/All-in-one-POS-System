import React, { useState } from 'react';
import { Customer } from '../../types';
import { User, Phone, MapPin, X, Save } from 'lucide-react';

interface CustomerManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    name?: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
  onSave: (data: { name: string; phone: string; address: string; notes?: string }) => void;
  title: string;
}

export const CustomerManageModal: React.FC<CustomerManageModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  title,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  React.useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setPhone(initialData?.phone || '');
      setAddress(initialData?.address || '');
      setNotes(initialData?.notes || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-stone-900 to-[#121212] rounded-2xl border border-white/10 ring-1 ring-white/10 shadow-2xl w-full max-w-md overflow-hidden text-stone-100 animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-stone-950/60 backdrop-blur-xs border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-md border border-emerald-400/20">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{title}</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Customer profile & delivery details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1.5">
              Customer Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ali Hassan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1.5">
              Phone Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 03215289807"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1.5">
              Delivery Address *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. House 14, Street 22, Sector F-11/2, Islamabad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1.5">
              Customer / Gate Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Ring bell at main gate, call upon arrival"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
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
              <Save className="w-3.5 h-3.5" />
              <span>Save Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
