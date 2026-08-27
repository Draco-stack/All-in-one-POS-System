import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Settings, Plus, Trash2, Store } from 'lucide-react';

export const AdminSystemSettings: React.FC = () => {
  const { outlets, addOutlet, deleteOutlet, showToast } = useRestaurant();
  const [newOutletName, setNewOutletName] = useState('');

  const handleAddOutlet = () => {
    if (!newOutletName.trim()) return;
    if (outlets.includes(newOutletName.trim())) {
      showToast('Branch already exists');
      return;
    }
    addOutlet(newOutletName.trim());
    setNewOutletName('');
    showToast('Branch added successfully');
  };

  const handleDeleteOutlet = (name: string) => {
    deleteOutlet(name);
    showToast('Branch deleted successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Store className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-black text-white uppercase tracking-wider">System Settings & Branches</h2>
      </div>

      <div className="bg-[#111111] border border-stone-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Store className="w-4 h-4 text-[#00897b]" /> Manage Branches (Outlets)
        </h3>
        
        <div className="flex items-center gap-3 mb-6">
          <input 
            type="text" 
            placeholder="New Branch Name..." 
            value={newOutletName} 
            onChange={(e) => setNewOutletName(e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-stone-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#00897b]"
          />
          <button 
            onClick={handleAddOutlet}
            className="px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        </div>

        <div className="space-y-2">
          {outlets.map(outlet => (
            <div key={outlet} className="flex items-center justify-between bg-[#1a1a1a] border border-stone-800 p-3 rounded-lg">
              <span className="text-white font-medium">{outlet}</span>
              <button 
                onClick={() => handleDeleteOutlet(outlet)}
                className="p-1.5 bg-stone-800 hover:bg-red-900/50 text-stone-400 hover:text-red-400 rounded-lg transition cursor-pointer"
                title="Delete Branch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {outlets.length === 0 && (
            <div className="text-stone-500 text-sm text-center py-4">No custom branches configured.</div>
          )}
        </div>
      </div>
    </div>
  );
};
