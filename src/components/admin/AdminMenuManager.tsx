import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Layers,
  Sparkles,
  UtensilsCrossed,
  Tag,
  DollarSign,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, Category } from '../../types';

export const AdminMenuManager: React.FC = () => {
  const {
    menuItems,
    categories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleItemAvailability,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    showToast,
  } = useRestaurant();

  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemFormData, setItemFormData] = useState<{
    name: string;
    description: string;
    price: number;
    category: string;
    image: string;
    available: boolean;
    flavors: string[];
    isPopular: boolean;
  }>({
    name: '',
    description: '',
    price: 999,
    category: 'pizzas',
    image: '',
    available: true,
    flavors: [],
    isPopular: false,
  });

  // Category Manager Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');

  // Quick Inline Price Edit
  const [quickPriceEditId, setQuickPriceEditId] = useState<string | null>(null);
  const [quickPriceVal, setQuickPriceVal] = useState<string>('');

  // Async Deletion Loader State
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const handleDeleteItem = async (item: MenuItem) => {
    console.log("Deleting ID:", item.id);
    if (!item.id) {
      console.error("[handleDeleteItem] Error: item.id is missing or undefined!", item);
      showToast("❌ Cannot delete item: Missing item ID.");
      return;
    }
    if (!confirm(`Remove "${item.name}" from catalog?`)) return;
    setDeletingItemId(item.id);
    try {
      const ok = await deleteMenuItem(item.id);
      if (!ok) {
        console.warn("[handleDeleteItem] deleteMenuItem returned false for ID:", item.id);
      }
    } catch (err: any) {
      console.error("[handleDeleteItem] Exception caught:", err);
      showToast(`❌ Error deleting menu item: ${err.message || 'Server error'}`);
    } finally {
      setDeletingItemId(null);
    }
  };

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = selectedCatFilter === 'all' || item.category.toLowerCase() === selectedCatFilter.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCatFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemFormData({
      name: '',
      description: '',
      price: 999,
      category: categories[0]?.id !== 'all' ? categories[0]?.id : 'pizzas',
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
      available: true,
      flavors: ['Chicken Tikka', 'Fajita Classic', 'Cheese Feast'],
      isPopular: false,
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      image: item.image || '',
      available: item.available !== false,
      flavors: item.flavors || [],
      isPopular: !!item.isPopular,
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemFormData.name.trim()) {
      showToast('Item title is required');
      return;
    }
    if (itemFormData.price <= 0) {
      showToast('Price must be greater than zero');
      return;
    }

    if (editingItem) {
      updateMenuItem(editingItem.id, {
        name: itemFormData.name.trim(),
        description: itemFormData.description.trim(),
        price: Number(itemFormData.price),
        category: itemFormData.category,
        image: itemFormData.image.trim(),
        available: itemFormData.available,
        flavors: itemFormData.flavors,
        isPopular: itemFormData.isPopular,
      });
      showToast(`Updated "${itemFormData.name}"`);
    } else {
      addMenuItem({
        name: itemFormData.name.trim(),
        description: itemFormData.description.trim(),
        price: Number(itemFormData.price),
        category: itemFormData.category,
        image: itemFormData.image.trim() || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
        available: itemFormData.available,
        flavors: itemFormData.flavors,
        isPopular: itemFormData.isPopular,
      });
    }

    setIsItemModalOpen(false);
  };

  const handleSaveQuickPrice = (itemId: string) => {
    const val = parseFloat(quickPriceVal);
    if (!isNaN(val) && val > 0) {
      updateMenuItem(itemId, { price: val });
    }
    setQuickPriceEditId(null);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;
    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    reorderCategories(updated);
  };

  return (
    <div className="space-y-6">
      {/* Action Header & Category Toolbar */}
      <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-emerald-400" />
              Menu & Catalog Management
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Live floor pricing, catalog taxonomy, category reordering, and item visibility controls
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/20 active:scale-95 shadow-sm"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              Manage Categories ({categories.length})
            </button>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer border border-emerald-500/30"
            >
              <Plus className="w-4 h-4" />
              Add Menu Item
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-white/5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search items, titles, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-thin">
            <button
              onClick={() => setSelectedCatFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                selectedCatFilter === 'all'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                  : 'bg-stone-950/80 text-stone-400 hover:text-white border border-white/5 hover:border-white/10'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((c) => {
              const count = menuItems.filter((m) => m.category.toLowerCase() === c.id.toLowerCase()).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCatFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    selectedCatFilter.toLowerCase() === c.id.toLowerCase()
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/30'
                      : 'bg-stone-950/80 text-stone-400 hover:text-white border border-white/5 hover:border-white/10'
                  }`}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Menu Items Grid Table */}
      <div className="bg-gradient-to-b from-stone-900/90 to-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
          <div className="text-xs text-stone-400">
            Displaying <span className="text-white font-bold">{filteredItems.length}</span> items in catalog
          </div>
          <div className="flex items-center gap-3 text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /> Active on POS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-stone-600" /> Soft-Deactivated
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300 border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Item Details</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Floor Price (PKR)</th>
                <th className="py-2.5 px-3">Custom Flavors</th>
                <th className="py-2.5 px-3 text-center">POS Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-500 italic">
                    No items matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isAvail = item.available !== false;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/[0.02] transition ${!isAvail ? 'opacity-55 bg-stone-950/40' : ''}`}
                    >
                      {/* Item Details */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-stone-950 flex-shrink-0 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {item.name}
                              {item.isPopular && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-bold uppercase shadow-xs">
                                  Popular
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 max-w-sm truncate" title={item.description}>
                              {item.description || 'No description provided'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-800/80 text-stone-300 text-[11px] font-semibold capitalize font-mono border border-white/5">
                          {item.category}
                        </span>
                      </td>

                      {/* Floor Price with On-the-Fly Quick Editing */}
                      <td className="py-3 px-3 text-right">
                        {quickPriceEditId === item.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              value={quickPriceVal}
                              onChange={(e) => setQuickPriceVal(e.target.value)}
                              className="w-20 px-2 py-1 bg-stone-950 border border-emerald-500 rounded text-xs text-white font-mono text-right focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveQuickPrice(item.id);
                                if (e.key === 'Escape') setQuickPriceEditId(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveQuickPrice(item.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setQuickPriceEditId(null)}
                              className="p-1 text-stone-500 hover:text-stone-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setQuickPriceEditId(item.id);
                              setQuickPriceVal(String(item.price));
                            }}
                            className="inline-flex items-center gap-1 font-mono font-bold text-white hover:text-emerald-400 cursor-pointer group transition-colors"
                            title="Click to edit price on the fly"
                          >
                            <span>PKR {item.price.toLocaleString()}</span>
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-stone-400" />
                          </div>
                        )}
                      </td>

                      {/* Flavors / Modifiers */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.flavors && item.flavors.length > 0 ? (
                            item.flavors.map((f, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.2 rounded bg-stone-950/80 text-stone-400 text-[10px] border border-white/5"
                              >
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-500 italic text-[11px]">Standard</span>
                          )}
                        </div>
                      </td>

                      {/* Active/Inactive Toggle (Soft Delete) */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleItemAvailability(item.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all duration-200 cursor-pointer border ${
                            isAvail
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                              : 'bg-stone-800/80 text-stone-500 border-stone-700 hover:bg-stone-700'
                          }`}
                        >
                          {isAvail ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-stone-500" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-700 rounded-lg transition-all duration-200 cursor-pointer border border-white/5 active:scale-95"
                            title="Edit Item Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            disabled={deletingItemId === item.id}
                            className="p-1.5 text-stone-400 hover:text-red-400 bg-stone-800/80 hover:bg-red-950/40 rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 active:scale-95"
                            title="Delete Item"
                          >
                            {deletingItemId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Menu Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#141414] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4.5 border-b border-white/10 flex items-center justify-between bg-stone-950/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  {editingItem ? `Edit Menu Item — ${editingItem.name}` : 'Create New Menu Item'}
                </h4>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Item Title */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Item Title / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Traditional Tikka Feast Pizza"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
              </div>

              {/* Price & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Price (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={itemFormData.price}
                    onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Category *</label>
                  <select
                    value={itemFormData.category}
                    onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Description & Ingredients</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Signature marinated chicken cubes with diced onions, bell peppers and mozzarella..."
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={itemFormData.image}
                    onChange={(e) => setItemFormData({ ...itemFormData, image: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Flavors (Comma separated) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Flavor / Style Options (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Chicken Tikka, Fajita Sicilian, Super Supreme"
                  value={itemFormData.flavors.join(', ')}
                  onChange={(e) =>
                    setItemFormData({
                      ...itemFormData,
                      flavors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemFormData.available}
                    onChange={(e) => setItemFormData({ ...itemFormData, available: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Active & Visible on Floor POS</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemFormData.isPopular}
                    onChange={(e) => setItemFormData({ ...itemFormData, isPopular: e.target.checked })}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span>Badge as "Popular"</span>
                </label>
              </div>

              {/* Footer CTA */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer border border-white/5 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-95 border border-emerald-500/30"
                >
                  {editingItem ? 'Save Item Changes' : 'Create Menu Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-stone-900 to-[#141414] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4.5 border-b border-white/10 flex items-center justify-between bg-stone-950/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Dynamic Category Control</h4>
              </div>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add New Category Form */}
              <form onSubmit={handleAddCategorySubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Category Name (e.g. Mocktails, Platters)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-stone-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-95 border border-emerald-500/30"
                >
                  Add
                </button>
              </form>

              {/* Category List & Reordering */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pt-2 pr-1">
                {categories.map((c, index) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 bg-stone-950/80 rounded-xl border border-white/5 hover:border-white/10 transition"
                  >
                    {editingCatId === c.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-stone-900 border border-emerald-500 rounded text-xs text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (editingCatName.trim()) updateCategory(c.id, editingCatName.trim());
                            setEditingCatId(null);
                          }}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingCatId(null)} className="p-1 text-stone-500 hover:text-stone-400 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-stone-500 font-mono text-[10px] w-4">{index + 1}.</span>
                          <span className="font-semibold text-xs text-white">{c.name}</span>
                          <span className="text-[10px] text-stone-500 font-mono">({c.id})</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-stone-400 hover:text-white disabled:opacity-30 cursor-pointer transition"
                            title="Move Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === categories.length - 1}
                            className="p-1 text-stone-400 hover:text-white disabled:opacity-30 cursor-pointer transition"
                            title="Move Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCatId(c.id);
                              setEditingCatName(c.name);
                            }}
                            className="p-1 text-stone-400 hover:text-white cursor-pointer transition"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete category "${c.name}"?`)) deleteCategory(c.id);
                            }}
                            className="p-1 text-stone-400 hover:text-red-400 cursor-pointer transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-white/10 text-right">
                <button
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer border border-white/5 active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
