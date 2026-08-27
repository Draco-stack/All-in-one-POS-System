import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Package,
  Layers,
  Search,
  DollarSign,
  Clock,
  X,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem } from '../../types';

export const MenuManagementView: React.FC = () => {
  const {
    menuItems,
    categories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleItemAvailability,
    stockItems,
    updateStockQuantity,
    currentUser,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<'menu' | 'stock'>('menu');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('pizza');
  const [formPrice, setFormPrice] = useState(1000);
  const [formDesc, setFormDesc] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formPrepTime, setFormPrepTime] = useState(12);
  const [formFlavors, setFormFlavors] = useState('Classic, Spicy, Special');

  const isOwnerOrManager = ['owner', 'manager'].includes(currentUser.role);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('pizza');
    setFormPrice(1000);
    setFormDesc('');
    setFormImage('https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80');
    setFormPrepTime(12);
    setFormFlavors('Standard');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormPrice(item.price);
    setFormDesc(item.description);
    setFormImage(item.image);
    setFormPrepTime(item.preparationTimeMinutes);
    setFormFlavors(item.flavors ? item.flavors.join(', ') : '');
    setIsAddModalOpen(true);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    const flavorsArray = formFlavors
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    if (editingItem) {
      updateMenuItem(editingItem.id, {
        name: formName,
        category: formCategory,
        price: formPrice,
        description: formDesc,
        image: formImage,
        preparationTimeMinutes: formPrepTime,
        flavors: flavorsArray.length > 0 ? flavorsArray : undefined,
      });
    } else {
      addMenuItem({
        name: formName,
        category: formCategory,
        price: formPrice,
        description: formDesc,
        image: formImage,
        dietary: ['non-veg'],
        preparationTimeMinutes: formPrepTime,
        available: true,
        flavors: flavorsArray.length > 0 ? flavorsArray : undefined,
      });
    }
    setIsAddModalOpen(false);
  };

  const filteredMenuItems = menuItems.filter((i) => {
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-stone-950 text-stone-100 font-sans space-y-6">
      {/* Header & Tabs */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-[#00897b]" />
            Menu Catalog & Inventory Stock Control
          </h2>
          <p className="text-xs text-stone-400">
            Configure dishes, pricing, flavors, and live raw ingredient inventory depletion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-[#00897b] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Menu Items ({menuItems.length})
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-[#00897b] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Raw Stock Levels ({stockItems.length})
            </button>
          </div>

          {isOwnerOrManager && activeTab === 'menu' && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Menu Item
            </button>
          )}
        </div>
      </div>

      {activeTab === 'menu' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-3"
              >
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-xl object-cover bg-stone-950 shrink-0 border border-stone-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897b]">
                        {item.category}
                      </span>
                      <button
                        onClick={() => toggleItemAvailability(item.id)}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                          item.available
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-950/40 border-red-500/30 text-red-400'
                        }`}
                      >
                        {item.available ? (
                          <>
                            <CheckCircle className="w-3 h-3" /> Available
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Out of Stock
                          </>
                        )}
                      </button>
                    </div>
                    <h3 className="font-bold text-sm text-white truncate mt-1">{item.name}</h3>
                    <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.flavors && (
                  <div className="flex flex-wrap gap-1">
                    {item.flavors.map((f, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[10px] text-stone-300"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-emerald-400">
                    PKR {item.price.toLocaleString()}
                  </span>

                  {isOwnerOrManager && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                        title="Edit Price / Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMenuItem(item.id)}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-red-950/50 text-stone-400 hover:text-red-400 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* STOCK INVENTORY VIEW */
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase font-mono text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th className="p-4">Ingredient / Raw Stock</th>
                <th className="p-4">Category</th>
                <th className="p-4">Current Stock</th>
                <th className="p-4">Threshold Alert</th>
                <th className="p-4">Cost / Unit</th>
                <th className="p-4">Last Restocked</th>
                <th className="p-4 text-right">Quick Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {stockItems.map((stk) => {
                const isLow = stk.currentStock <= stk.minThreshold;
                return (
                  <tr key={stk.id} className="hover:bg-stone-850 transition">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      {stk.name}
                    </td>
                    <td className="p-4 text-stone-400">{stk.category}</td>
                    <td className="p-4 font-mono font-bold">
                      <span className={isLow ? 'text-red-400 animate-pulse' : 'text-emerald-400'}>
                        {stk.currentStock.toFixed(1)} {stk.unit}
                      </span>
                      {isLow && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/20">
                          Low Stock
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-stone-400">
                      {stk.minThreshold} {stk.unit}
                    </td>
                    <td className="p-4 font-mono">PKR {stk.costPerUnit}</td>
                    <td className="p-4 text-stone-400">{stk.lastRestocked}</td>
                    <td className="p-4 text-right space-x-1">
                      <button
                        onClick={() => updateStockQuantity(stk.id, stk.currentStock + 5)}
                        className="px-2 py-1 rounded bg-stone-800 hover:bg-[#00897b] text-stone-200 hover:text-white font-mono font-bold transition cursor-pointer"
                      >
                        +5 {stk.unit}
                      </button>
                      <button
                        onClick={() => updateStockQuantity(stk.id, stk.currentStock + 20)}
                        className="px-2 py-1 rounded bg-stone-800 hover:bg-[#00897b] text-stone-200 hover:text-white font-mono font-bold transition cursor-pointer"
                      >
                        +20 {stk.unit}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT MENU ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitItem} className="space-y-3">
              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00897b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-300 font-semibold block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    {categories.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-300 font-semibold block mb-1">Price (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">
                  Flavors / Crust Options (Comma Separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fajita Sicilian, Chicken Tikka, White Special"
                  value={formFlavors}
                  onChange={(e) => setFormFlavors(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-stone-300 font-semibold block mb-1">Image URL</label>
                <input
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold shadow-md"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
