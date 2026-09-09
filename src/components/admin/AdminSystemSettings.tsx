import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Settings, Plus, Trash2, Store, Table2 } from 'lucide-react';

export const AdminSystemSettings: React.FC = () => {
  const { outlets, addOutlet, deleteOutlet, showToast, tables, addTable, deleteTable, theme } = useRestaurant();
  const [newOutletName, setNewOutletName] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

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

  const handleAddTable = async () => {
    const tableNum = newTableNumber.trim();
    if (!tableNum) {
      showToast('⚠️ Please enter a table number');
      return;
    }
    const cap = parseInt(newTableCapacity) || 4;
    await addTable(tableNum, cap);
    setNewTableNumber('');
    setNewTableCapacity('4');
  };

  const handleDeleteTable = async (id: string) => {
    if (confirm('Are you sure you want to delete this table?')) {
      await deleteTable(id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 mobile-admin-viewport">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-amber-500" />
        <h2 className={`text-lg font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>System Settings & Resources</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manage Branches Panel */}
        <div className={`border rounded-xl p-5 shadow-lg flex flex-col justify-between ${
          theme === 'dark' ? 'bg-[#111111] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              <Store className="w-4 h-4 text-[#00897b]" /> Manage Branches (Outlets)
            </h3>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <input 
                type="text" 
                placeholder="New Branch Name..." 
                value={newOutletName} 
                onChange={(e) => setNewOutletName(e.target.value)}
                className={`flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#00897b] ${
                  theme === 'dark' ? 'bg-[#1a1a1a] border-slate-300 dark:border-stone-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
              <button 
                onClick={handleAddOutlet}
                className="px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" /> Add Branch
              </button>
            </div>

            <div className="space-y-2">
              {outlets.map(outlet => (
                <div key={outlet} className={`flex items-center justify-between border p-3 rounded-lg ${
                  theme === 'dark' ? 'bg-[#1a1a1a] border-slate-200 dark:border-stone-800 text-white' : 'bg-slate-50 border-slate-150 text-slate-800'
                }`}>
                  <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>{outlet}</span>
                  <button 
                    onClick={() => handleDeleteOutlet(outlet)}
                    className={`p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition cursor-pointer ${
                      theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-500 dark:text-stone-400' : 'bg-slate-200/60 text-slate-500'
                    }`}
                    title="Delete Branch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {outlets.length === 0 && (
                <div className="text-slate-400 dark:text-stone-500 text-sm text-center py-4">No custom branches configured.</div>
              )}
            </div>
          </div>
        </div>

        {/* Manage Tables Panel */}
        <div className={`border rounded-xl p-5 shadow-lg ${
          theme === 'dark' ? 'bg-[#111111] border-slate-200 dark:border-stone-800' : 'bg-white border-slate-200'
        }`}>
          <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            <Table2 className="w-4 h-4 text-[#00897b]" /> Manage Dining Tables (Dine-In)
          </h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
            <input 
              type="text" 
              placeholder="Table Number (e.g. 05, T-1)..." 
              value={newTableNumber} 
              onChange={(e) => setNewTableNumber(e.target.value)}
              className={`w-full sm:flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#00897b] ${
                theme === 'dark' ? 'bg-[#1a1a1a] border-slate-300 dark:border-stone-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
            <select
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(e.target.value)}
              className={`w-full sm:w-28 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00897b] cursor-pointer ${
                theme === 'dark' ? 'bg-[#1a1a1a] border-slate-300 dark:border-stone-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="2">2 Pax</option>
              <option value="4">4 Pax</option>
              <option value="6">6 Pax</option>
              <option value="8">8 Pax</option>
              <option value="10">10 Pax</option>
            </select>
            <button 
              onClick={handleAddTable}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Table
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
            {tables.map(table => (
              <div key={table.id} className={`flex items-center justify-between border p-3 rounded-lg ${
                theme === 'dark' ? 'bg-[#1a1a1a] border-slate-200 dark:border-stone-800 text-white' : 'bg-slate-50 border-slate-150 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-mono font-bold">
                    #{table.number}
                  </div>
                  <div>
                    <span className={`font-medium text-sm block ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Table {table.number}</span>
                    <span className={`text-slate-400 dark:text-stone-500 text-[11px] font-mono capitalize`}>{table.capacity} Seats • {table.status.toLowerCase()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteTable(table.id)}
                  className={`p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition cursor-pointer ${
                    theme === 'dark' ? 'bg-slate-50 dark:bg-stone-800 text-slate-500 dark:text-stone-400' : 'bg-slate-200/60 text-slate-500'
                  }`}
                  title="Delete Table"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {tables.length === 0 && (
              <div className="text-slate-400 dark:text-stone-500 text-sm text-center py-4">No custom tables configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
