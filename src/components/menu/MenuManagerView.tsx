import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem } from '../../types';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';

export const MenuManagerView: React.FC = () => {
  const {
    categories,
    menuItems,
    toggleItemAvailability,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
  } = useRestaurant();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State for Add / Edit
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || 'square_pizza');
  const [image, setImage] = useState('');
  const [prepTime, setPrepTime] = useState(12);
  const [dietary, setDietary] = useState<string[]>(['non-veg']);

  const filteredItems = menuItems.filter((i) => {
    const matchCat = selectedCat === 'all' || i.category === selectedCat;
    const matchSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setDescription('');
    setPrice('');
    setCategory(categories[0]?.id || 'square_pizza');
    setImage('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80');
    setPrepTime(12);
    setDietary(['non-veg']);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setImage(item.image);
    setPrepTime(item.preparationTimeMinutes);
    setDietary(item.dietary || []);
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (!name.trim() || isNaN(numPrice)) return;

    if (editingItem) {
      await updateMenuItem(editingItem.id, {
        name: name.trim(),
        description: description.trim(),
        price: numPrice,
        category,
        image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        preparationTimeMinutes: prepTime,
        dietary: dietary as any,
      });
    } else {
      await addMenuItem({
        name: name.trim(),
        description: description.trim(),
        price: numPrice,
        category,
        image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        preparationTimeMinutes: prepTime,
        dietary: dietary as any,
        available: true,
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 bg-stone-900 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00897b]/10 border border-[#00897b]/30 flex items-center justify-center text-[#00897b]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Menu Catalog & 86 Item Availability</h2>
            <p className="text-xs text-stone-400">
              Manage live dish availability (86 status), item prices, prep times, and descriptions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-900/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isAvailable = item.available;
            return (
              <div
                key={item.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 flex flex-col justify-between shadow space-y-3"
              >
                <div className="space-y-2">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-950">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-lg bg-stone-950/90 text-teal-300 font-mono font-bold text-xs shadow border border-stone-800">
                        Rs. {item.price.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">{item.name}</h4>
                    <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5">{item.description}</p>
                  </div>
                </div>

                {/* 86 Toggle & Actions */}
                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  {/* Availability Toggle */}
                  <button
                    onClick={() => toggleItemAvailability(item.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isAvailable ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{isAvailable ? 'In Stock' : '86’d / Out'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMenuItem(item.id)}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 transition cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Dish Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingItem ? 'Edit Menu Dish' : 'Add New Menu Dish'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-stone-300 uppercase">Item Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-stone-300 uppercase">Price (Rs.) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-300 uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-300 uppercase">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-300 uppercase">Image URL</label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00796b] text-white font-bold cursor-pointer"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
