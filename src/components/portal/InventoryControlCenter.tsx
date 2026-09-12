import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  Scale,
  FileSpreadsheet,
  AlertTriangle,
  TrendingDown,
  Trash2,
  GitPullRequest,
  CheckSquare,
  DollarSign,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronDown,
  FileText
} from 'lucide-react';
import { getAuthToken } from '../../utils/apiConfig';

interface Ingredient {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  minStock: number;
  unit: string;
  purchaseUnit: string;
  conversionRatio: number;
  costPerPurchaseUnit: number;
  costPerBaseUnit: number;
  category: string;
  preferredVendorId: string | null;
  preferredVendor: string | null;
}

interface StockLog {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  type: string;
  reason: string;
  userId: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Recipe {
  id: string;
  name: string;
  notes?: string | null;
  menuItem?: { id: string; title: string } | null;
  variant?: { id: string; name: string } | null;
  modifierOption?: { id: string; name: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unit: string;
    ingredient: {
      id: string;
      name: string;
      costPerBaseUnit: number;
      baseUnit: string;
    };
  }>;
}

interface WasteLog {
  id: string;
  quantity: number;
  unit: string;
  reason: string;
  totalCost: number;
  reportedByName: string;
  createdAt: string;
  ingredient: {
    name: string;
  };
}

interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  targetBranchId: string;
  status: string;
  notes?: string | null;
  createdByName: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unit: string;
    ingredient: {
      name: string;
    };
  }>;
}

interface StockCountSession {
  id: string;
  sessionNumber: string;
  status: string;
  notes?: string | null;
  conductedByName: string;
  createdAt: string;
  items: Array<{
    id: string;
    theoreticalQuantity: number;
    physicalQuantity: number;
    varianceQuantity: number;
    unit: string;
    unitCost: number;
    varianceCost: number;
    ingredient: {
      name: string;
    };
  }>;
}

export function InventoryControlCenter() {
  const [subTab, setSubTab] = useState<'stock' | 'recipes' | 'waste' | 'transfers' | 'counts' | 'vendors'>('stock');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [counts, setCounts] = useState<StockCountSession[]>([]);
  
  // Helpers
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [menuItems, setMenuItems] = useState<Array<{ id: string; title: string; basePrice: number }>>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal forms states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('RESTOCK');
  const [adjustType, setAdjustType] = useState('PURCHASE');

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeMenuItemId, setRecipeMenuItemId] = useState('');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [recipeItems, setRecipeItems] = useState<Array<{ ingredientId: string; quantity: string; unit: string }>>([
    { ingredientId: '', quantity: '', unit: 'g' }
  ]);

  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteIngredientId, setWasteIngredientId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('SPOILED');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSource, setTransferSource] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{ ingredientId: string; quantity: string; unit: string }>>([
    { ingredientId: '', quantity: '', unit: 'g' }
  ]);
  const [transferNotes, setTransferNotes] = useState('');

  const [showCountModal, setShowCountModal] = useState(false);
  const [countItems, setCountItems] = useState<Array<{ ingredientId: string; physicalQuantity: string }>>([]);
  const [countNotes, setCountNotes] = useState('');

  const token = getAuthToken() || localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Load Stock & Logs
      const invRes = await fetch('/api/portal/inventory', { headers });
      const invJson = await invRes.json();
      if (invRes.ok && invJson.success) {
        setIngredients(invJson.data.items || []);
        setLogs(invJson.data.logs || []);
      }

      // Load Vendors
      const vRes = await fetch('/api/portal/vendors', { headers });
      const vJson = await vRes.json();
      if (vRes.ok && vJson.success) {
        setVendors(vJson.data || []);
      }

      // Load Recipes
      const rRes = await fetch('/api/portal/recipes', { headers });
      const rJson = await rRes.json();
      if (rRes.ok && rJson.success) {
        setRecipes(rJson.data || []);
      }

      // Load Waste Logs
      const wRes = await fetch('/api/portal/waste', { headers });
      const wJson = await wRes.json();
      if (wRes.ok && wJson.success) {
        setWasteLogs(wJson.data || []);
      }

      // Load Transfers
      const tRes = await fetch('/api/portal/transfers', { headers });
      const tJson = await tRes.json();
      if (tRes.ok && tJson.success) {
        setTransfers(tJson.data || []);
      }

      // Load Reconciliation sessions
      const cRes = await fetch('/api/portal/counts', { headers });
      const cJson = await cRes.json();
      if (cRes.ok && cJson.success) {
        setCounts(cJson.data || []);
      }

      // Load auxiliary info
      const bRes = await fetch('/api/portal/branches', { headers });
      const bJson = await bRes.json();
      if (bRes.ok && bJson.success) {
        setBranches(bJson.data || []);
      }

      const menuRes = await fetch('/api/portal/menu', { headers });
      const menuJson = await menuRes.json();
      if (menuRes.ok && menuJson.success) {
        const categories = menuJson.data || [];
        const flatItems: any[] = [];
        categories.forEach((cat: any) => {
          if (Array.isArray(cat.items)) {
            flatItems.push(...cat.items);
          }
        });
        setMenuItems(flatItems);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory core data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleAdjustInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient || !adjustQty) return;

    try {
      const res = await fetch('/api/portal/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          quantityDelta: Number(adjustQty),
          reason: adjustReason,
          movementType: adjustType,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowAdjustModal(false);
        setAdjustQty('');
        fetchData();
      } else {
        alert(json.error || 'Failed to adjust inventory');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName || recipeItems.some(i => !i.ingredientId || !i.quantity)) {
      alert('Please fill out all fields and select ingredients');
      return;
    }

    try {
      const res = await fetch('/api/portal/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: recipeName,
          menuItemId: recipeMenuItemId || null,
          items: recipeItems,
          notes: recipeNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowRecipeModal(false);
        setRecipeName('');
        setRecipeMenuItemId('');
        setRecipeNotes('');
        setRecipeItems([{ ingredientId: '', quantity: '', unit: 'g' }]);
        fetchData();
      } else {
        alert(json.error || 'Failed to create recipe');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;
    try {
      const res = await fetch(`/api/portal/recipes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteIngredientId || !wasteQty) return;

    try {
      const res = await fetch('/api/portal/waste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId: wasteIngredientId,
          quantity: Number(wasteQty),
          reason: wasteReason,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowWasteModal(false);
        setWasteIngredientId('');
        setWasteQty('');
        fetchData();
      } else {
        alert(json.error || 'Failed to log waste');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSource || !transferTarget || transferItems.some(i => !i.ingredientId || !i.quantity)) {
      alert('Please fill out source, target, and all transfer items');
      return;
    }

    try {
      const res = await fetch('/api/portal/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceBranchId: transferSource,
          targetBranchId: transferTarget,
          items: transferItems,
          notes: transferNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowTransferModal(false);
        setTransferSource('');
        setTransferTarget('');
        setTransferItems([{ ingredientId: '', quantity: '', unit: 'g' }]);
        setTransferNotes('');
        fetchData();
      } else {
        alert(json.error || 'Failed to complete transfer');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateStockCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countItems.some(i => !i.physicalQuantity)) {
      alert('Please fill out physical counts for the reconciliation audit');
      return;
    }

    try {
      const res = await fetch('/api/portal/counts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: countItems,
          notes: countNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowCountModal(false);
        setCountItems([]);
        setCountNotes('');
        fetchData();
      } else {
        alert(json.error || 'Failed to log reconciliation audit');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculations for recipe cost
  const calculateRecipeCost = (recipe: Recipe) => {
    return recipe.items.reduce((sum, item) => {
      const itemCost = item.quantity * (item.ingredient?.costPerBaseUnit || 0);
      return sum + itemCost;
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-400" />
            <span>Production Inventory & Food-Cost Control Center</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time database-backed ingredient margins, raw recipe calculations, waste audits, and multi-branch stock transfers.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Database</span>
        </button>
      </div>

      {/* Advanced Sub-Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-px">
        {[
          { id: 'stock', label: 'Raw Ingredients & Stock', icon: Package },
          { id: 'recipes', label: 'Recipes & BOM Costing', icon: Layers },
          { id: 'waste', label: 'Waste & Spoilage Logs', icon: Trash2 },
          { id: 'transfers', label: 'Inter-Branch Transfers', icon: ArrowRightLeft },
          { id: 'counts', label: 'Physical Count Audits', icon: CheckSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                isActive
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ERROR HANDLER */}
      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-200 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ACTIVE SUB-TAB CONTENT */}
      {subTab === 'stock' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Active Ingredient Inventory Levels</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const initialCount = ingredients.map(ing => ({
                    ingredientId: ing.id,
                    physicalQuantity: String(ing.currentStock),
                  }));
                  setCountItems(initialCount);
                  setShowCountModal(true);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Trigger Stock Audit</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ingredients Table */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-xs font-semibold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3 text-right">Stock Level</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3">Preferred Vendor</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ingredients.map((ing) => {
                    const isLow = Number(ing.currentStock) <= Number(ing.minStock);
                    return (
                      <tr key={ing.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{ing.name}</div>
                          <div className="text-slate-500 text-[10px] font-mono mt-0.5">{ing.code} • {ing.category}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={`font-bold ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {ing.currentStock.toLocaleString()} {ing.unit}
                          </span>
                          {isLow && (
                            <span className="ml-1 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">
                              LOW
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                          ${ing.costPerPurchaseUnit.toFixed(2)} / {ing.purchaseUnit}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{ing.preferredVendor || 'None assigned'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedIngredient(ing);
                              setShowAdjustModal(true);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-bold"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {ingredients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No ingredients found in database. Syncing may populate defaults.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent Adjustments Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px]">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Live Stock Movements</h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-white">{log.itemName}</span>
                      <span className={`font-mono font-bold ${log.quantityDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {log.quantityDelta >= 0 ? '+' : ''}{log.quantityDelta.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Reason: {log.reason}</span>
                      <span>By {log.userId}</span>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    No movements recorded.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Ingredient Cost-Margins & Recipes (BOM)</h3>
            <button
              onClick={() => setShowRecipeModal(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Recipe / BOM</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recipes.map((rec) => {
              const totalCost = calculateRecipeCost(rec);
              return (
                <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{rec.name}</h4>
                        {rec.menuItem && (
                          <div className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold uppercase">
                            Linked Menu Item: {rec.menuItem.title}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteRecipe(rec.id)}
                        className="text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ingredients Summary</span>
                      <div className="bg-slate-950 rounded-lg p-2.5 divide-y divide-slate-900/60 text-xs">
                        {rec.items.map((item) => (
                          <div key={item.id} className="py-1.5 flex justify-between">
                            <span className="text-slate-300">{item.ingredient?.name || 'Unknown Ingredient'}</span>
                            <span className="font-mono text-slate-400">
                              {item.quantity} {item.unit} (${(item.quantity * (item.ingredient?.costPerBaseUnit || 0)).toFixed(2)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Total Ingredient Cost (BOM Basis)</span>
                    <span className="text-base font-extrabold text-sky-400 font-mono">
                      ${totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}

            {recipes.length === 0 && (
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-8 rounded-xl text-center text-slate-400 text-sm">
                No recipes currently configured. Create a recipe to compute detailed portion costs.
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'waste' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Food Spoilage & Product Waste Logging</h3>
            <button
              onClick={() => setShowWasteModal(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Log Spoilage / Waste</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300 font-sans">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3 text-right">Wasted Value Cost</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {wasteLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20">
                    <td className="px-4 py-3 text-slate-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold text-white">{log.ingredient?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono">{log.quantity.toLocaleString()} {log.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">${log.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {log.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{log.reportedByName}</td>
                  </tr>
                ))}
                {wasteLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No waste logs found. Good job! Spoilage levels are fully managed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'transfers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Inter-Branch Stock Movement & Transfers</h3>
            <button
              onClick={() => setShowTransferModal(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Create Inter-Branch Transfer</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {transfers.map((trf) => (
              <div key={trf.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <span className="font-mono text-[10px] text-sky-400 uppercase tracking-wider block font-bold">Transfer Session</span>
                    <h4 className="text-sm font-extrabold text-white mt-0.5">{trf.transferNumber}</h4>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {trf.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] mb-3">
                  <div>
                    <span className="text-slate-500 block">From Source Branch</span>
                    <span className="text-white font-medium">Branch ID: {trf.sourceBranchId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">To Target Destination</span>
                    <span className="text-white font-medium">Branch ID: {trf.targetBranchId}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg mb-3">
                  <span className="text-[10px] text-slate-500 block mb-1">Transferred Items</span>
                  <div className="space-y-1.5 text-[11px]">
                    {trf.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-slate-300">
                        <span>{item.ingredient?.name || 'Ingredient'}</span>
                        <span className="font-mono">{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>Authorized by: {trf.createdByName}</span>
                  <span>{new Date(trf.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}

            {transfers.length === 0 && (
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-8 rounded-xl text-center text-slate-400 text-sm">
                No inter-branch transfers recorded in this tenant organization.
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'counts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Physical Count Audits & Reconciliations</h3>
            <button
              onClick={() => {
                const initialCount = ingredients.map(ing => ({
                  ingredientId: ing.id,
                  physicalQuantity: String(ing.currentStock),
                }));
                setCountItems(initialCount);
                setShowCountModal(true);
              }}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Trigger Reconciliation Audit</span>
            </button>
          </div>

          <div className="space-y-6">
            {counts.map((sess) => (
              <div key={sess.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] text-sky-400 block font-bold uppercase tracking-wider">Audit Session</span>
                    <h4 className="text-sm font-extrabold text-white mt-0.5">{sess.sessionNumber}</h4>
                  </div>
                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {sess.status}
                  </span>
                </div>

                <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800/40">
                  <table className="w-full text-left text-[11px] text-slate-300">
                    <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2 text-right">Theoretical</th>
                        <th className="px-3 py-2 text-right">Physical Count</th>
                        <th className="px-3 py-2 text-right">Variance</th>
                        <th className="px-3 py-2 text-right">Variance Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {sess.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/10">
                          <td className="px-3 py-2 font-medium text-white">{item.ingredient?.name || 'Unknown'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">{item.theoreticalQuantity.toLocaleString()} {item.unit}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-200">{item.physicalQuantity.toLocaleString()} {item.unit}</td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${item.varianceQuantity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.varianceQuantity >= 0 ? '+' : ''}{item.varianceQuantity.toLocaleString()}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold ${item.varianceCost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${item.varianceCost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-3 pt-2">
                  <span>Conducted by: {sess.conductedByName}</span>
                  <span>{new Date(sess.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}

            {counts.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center text-slate-400 text-sm">
                No physical stock reconciliation audits have been conducted yet. Try triggering an audit!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADJUST MODAL */}
      {showAdjustModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full relative">
            <h4 className="text-sm font-bold text-white mb-4">Manual Adjustment: {selectedIngredient.name}</h4>
            <form onSubmit={handleAdjustInventory} className="space-y-4 text-xs text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400">Stock Delta (Negative to deduct)</label>
                <input
                  type="number"
                  placeholder="e.g. 500 or -200"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                >
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                  <option value="SPOILED">SPOILED</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Reason / Reference Note</label>
                <input
                  type="text"
                  placeholder="Reason for adjustment"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  Adjust Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECIPE CREATE MODAL */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full relative max-h-[85vh] overflow-y-auto">
            <h4 className="text-sm font-bold text-white mb-4">Create New Recipe BOM (Bill of Materials)</h4>
            <form onSubmit={handleCreateRecipe} className="space-y-4 text-xs text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400">Recipe Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Margherita Standard Portions"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Pair with Menu Item</label>
                <select
                  value={recipeMenuItemId}
                  onChange={(e) => setRecipeMenuItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                >
                  <option value="">-- No menu item link --</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title} (${item.basePrice.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ingredients list</label>
                  <button
                    type="button"
                    onClick={() => setRecipeItems([...recipeItems, { ingredientId: '', quantity: '', unit: 'g' }])}
                    className="text-sky-400 hover:text-sky-300 font-bold"
                  >
                    + Add row
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        required
                        value={item.ingredientId}
                        onChange={(e) => {
                          const updated = [...recipeItems];
                          updated[idx].ingredientId = e.target.value;
                          const found = ingredients.find(ing => ing.id === e.target.value);
                          if (found) {
                            updated[idx].unit = found.unit;
                          }
                          setRecipeItems(updated);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                      >
                        <option value="">-- Select ingredient --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...recipeItems];
                          updated[idx].quantity = e.target.value;
                          setRecipeItems(updated);
                        }}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-center"
                      />

                      <span className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono flex items-center min-w-[50px] justify-center">
                        {item.unit || 'g'}
                      </span>

                      {recipeItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 font-bold px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Instructional Notes / Production Method</label>
                <textarea
                  rows={2}
                  placeholder="Describe recipe preparation"
                  value={recipeNotes}
                  onChange={(e) => setRecipeNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecipeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  Create Recipe BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WASTE LOG MODAL */}
      {showWasteModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full relative">
            <h4 className="text-sm font-bold text-white mb-4">Log Food Spoilage / Product Waste</h4>
            <form onSubmit={handleLogWaste} className="space-y-4 text-xs text-slate-300">
              <div>
                <label className="block mb-1 text-slate-400">Select Ingredient</label>
                <select
                  required
                  value={wasteIngredientId}
                  onChange={(e) => setWasteIngredientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                >
                  <option value="">-- Select ingredient --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Wasted Quantity</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Waste Reason</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                >
                  <option value="SPOILED">SPOILED / ROT</option>
                  <option value="SPILLED">SPILLED / DISCARDED</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="THEFT">THEFT</option>
                  <option value="OTHER">OTHER / UNACCOUNTED</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  Log Spoilage Waste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-BRANCH TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full relative max-h-[85vh] overflow-y-auto">
            <h4 className="text-sm font-bold text-white mb-4">Create Inter-Branch Stock Transfer</h4>
            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Source Branch</label>
                  <select
                    required
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                  >
                    <option value="">-- Source Branch --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Target branch</label>
                  <select
                    required
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                  >
                    <option value="">-- Target Branch --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Items list</label>
                  <button
                    type="button"
                    onClick={() => setTransferItems([...transferItems, { ingredientId: '', quantity: '', unit: 'g' }])}
                    className="text-sky-400 hover:text-sky-300 font-bold"
                  >
                    + Add item
                  </button>
                </div>

                <div className="space-y-2">
                  {transferItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        required
                        value={item.ingredientId}
                        onChange={(e) => {
                          const updated = [...transferItems];
                          updated[idx].ingredientId = e.target.value;
                          const found = ingredients.find(ing => ing.id === e.target.value);
                          if (found) {
                            updated[idx].unit = found.unit;
                          }
                          setTransferItems(updated);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                      >
                        <option value="">-- Select ingredient --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...transferItems];
                          updated[idx].quantity = e.target.value;
                          setTransferItems(updated);
                        }}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-center"
                      />

                      <span className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono flex items-center min-w-[50px] justify-center">
                        {item.unit || 'g'}
                      </span>

                      {transferItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 font-bold px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Transfer reference / Logistics Notes</label>
                <textarea
                  rows={2}
                  placeholder="Details about vehicle, driver, or transfer batch"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  Complete Inter-Branch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILIATION COUNT MODAL */}
      {showCountModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full relative max-h-[85vh] overflow-y-auto">
            <h4 className="text-sm font-bold text-white mb-2">Reconciliation Stock Count Audit Session</h4>
            <p className="text-slate-400 text-[11px] mb-4">
              Enter the exact physical values observed in the restaurant storage. The database will automatically adjust variance and update actual inventories.
            </p>
            <form onSubmit={handleCreateStockCount} className="space-y-4 text-xs text-slate-300">
              <div className="max-h-[40vh] overflow-y-auto space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800/40">
                {countItems.map((item, idx) => {
                  const foundIng = ingredients.find(ing => ing.id === item.ingredientId);
                  return (
                    <div key={item.ingredientId} className="flex items-center justify-between gap-3 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <span className="font-semibold text-white block">{foundIng?.name || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Current system: {foundIng?.currentStock} {foundIng?.unit}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          required
                          value={item.physicalQuantity}
                          onChange={(e) => {
                            const updated = [...countItems];
                            updated[idx].physicalQuantity = e.target.value;
                            setCountItems(updated);
                          }}
                          className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center font-mono text-white"
                        />
                        <span className="text-[11px] text-slate-400 font-mono w-10">{foundIng?.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Reconciliation audit note</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Reason for reconciliation (e.g. End of Month Inventory Count)"
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCountModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
                >
                  Log & Correct Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
