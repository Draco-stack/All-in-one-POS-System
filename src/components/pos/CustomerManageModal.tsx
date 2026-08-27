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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-stone-300 shadow-2xl w-full max-w-md overflow-hidden text-stone-900">
        {/* Header */}
        <div className="px-4 py-3 bg-[#00695c] text-white flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{title}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ali Hassan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#00695c] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Phone Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 03215289807"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 font-mono focus:outline-none focus:border-[#00695c] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Delivery Address *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. House 14, Street 22, Sector F-11/2, Islamabad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#00695c] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Customer / Gate Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Ring bell at main gate, call upon arrival"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#00695c] focus:bg-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#00695c] hover:bg-[#004d40] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
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
