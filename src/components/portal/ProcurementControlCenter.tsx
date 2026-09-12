import React, { useState, useEffect } from 'react';
import {
  Truck, Plus, FileText, CheckCircle,
  ShoppingCart, RefreshCw, X, FileSpreadsheet, Box
} from 'lucide-react';
import { getAuthToken } from '../../utils/apiConfig';

interface Vendor {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface Ingredient {
  id: string;
  name: string;
  purchaseUnit: string;
  costPerPurchaseUnit: number;
}

interface POItem {
  id: string;
  ingredient: { id: string; name: string; purchaseUnit: string };
  orderedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  totalCost: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'FULFILLED' | 'CANCELLED';
  vendor: { id: string; name: string };
  total: number;
  createdAt: string;
  items: POItem[];
}

export function ProcurementControlCenter() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'pos'>('pos');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // New PO State
  const [showNewPO, setShowNewPO] = useState(false);
  const [newPOVendor, setNewPOVendor] = useState('');
  const [newPOItems, setNewPOItems] = useState<{ingredientId: string, quantity: number, unitCost: number}[]>([]);

  // Receive Goods State
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [venRes, ingRes, poRes] = await Promise.all([
        fetch('/api/portal/vendors', { headers }),
        fetch('/api/portal/inventory', { headers }),
        fetch('/api/portal/procurement/purchase-orders', { headers })
      ]);

      if (venRes.ok) {
        const venData = await venRes.json();
        setVendors(venData.data);
      }
      if (ingRes.ok) {
        const ingData = await ingRes.json();
        setIngredients(ingData.data.ingredients || []);
      }
      if (poRes.ok) {
        const poData = await poRes.json();
        setPOs(poData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async () => {
    if (!newPOVendor || newPOItems.length === 0) return;
    try {
      const token = getAuthToken();
      const res = await fetch('/api/portal/procurement/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vendorId: newPOVendor,
          items: newPOItems.map(item => {
            const ing = ingredients.find(i => i.id === item.ingredientId);
            return {
              ingredientId: item.ingredientId,
              orderedQuantity: item.quantity,
              purchaseUnit: ing?.purchaseUnit || 'unit',
              unitCost: item.unitCost
            };
          })
        })
      });
      if (res.ok) {
        setShowNewPO(false);
        setNewPOVendor('');
        setNewPOItems([]);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusAction = async (poId: string, action: 'submit' | 'approve') => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/portal/procurement/purchase-orders/${poId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceiveGoods = async () => {
    if (!receivePO) return;
    try {
      const token = getAuthToken();
      
      const itemsToReceive = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => ({
          purchaseOrderItemId: itemId,
          receivedQuantity: qty,
          rejectedQuantity: 0
        }));

      if (itemsToReceive.length === 0) return;

      const res = await fetch('/api/portal/procurement/goods-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          purchaseOrderId: receivePO.id,
          items: itemsToReceive
        })
      });

      if (res.ok) {
        const body = await res.json();
        const receiptId = body.data.id;
        
        // Finalize immediately for simplicity
        await fetch(`/api/portal/procurement/goods-receipts/${receiptId}/finalize`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        setReceivePO(null);
        setReceiveQuantities({});
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-slate-800 text-slate-300';
      case 'SUBMITTED': return 'bg-blue-500/20 text-blue-400';
      case 'APPROVED': return 'bg-emerald-500/20 text-emerald-400';
      case 'PARTIAL': return 'bg-amber-500/20 text-amber-400';
      case 'FULFILLED': return 'bg-slate-800 text-slate-500 line-through';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-hidden flex flex-col relative h-full">
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between z-10 relative">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Procurement & POs</h1>
            <p className="text-sm text-slate-400 mt-1">Manage vendor orders and receive inventory exactly once.</p>
          </div>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <button onClick={fetchData} className="px-4 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center text-sm font-semibold">
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowNewPO(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors flex items-center text-sm font-semibold shadow-lg shadow-emerald-500/20">
            <Plus size={16} className="mr-2" /> New Purchase Order
          </button>
        </div>
      </header>

      <div className="px-6 py-4 border-b border-slate-800/60 flex space-x-2 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'pos', label: 'Purchase Orders', icon: FileSpreadsheet },
          { id: 'suppliers', label: 'Suppliers Directory', icon: Truck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all duration-200 ${
                isActive ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900/50 text-slate-400 border border-slate-800 hover:border-emerald-500/50 hover:text-emerald-400'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'pos' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {pos.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800">
                <p className="text-slate-400">No purchase orders found.</p>
              </div>
            ) : (
              pos.map(po => (
                <div key={po.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-bold text-white">{po.poNumber}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{po.vendor.name} • Total: ${po.total.toFixed(2)}</p>
                    </div>
                    <div className="flex space-x-2">
                      {po.status === 'DRAFT' && (
                        <button onClick={() => handleStatusAction(po.id, 'submit')} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded border border-blue-500/30 text-xs font-bold transition-colors">
                          Submit
                        </button>
                      )}
                      {po.status === 'SUBMITTED' && (
                        <button onClick={() => handleStatusAction(po.id, 'approve')} className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded border border-emerald-500/30 text-xs font-bold transition-colors">
                          Approve
                        </button>
                      )}
                      {(po.status === 'APPROVED' || po.status === 'PARTIAL') && (
                        <button onClick={() => setReceivePO(po)} className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded border border-indigo-500/30 text-xs font-bold transition-colors">
                          Receive Goods
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 border-t border-slate-800/50 pt-4">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="pb-2">Item</th>
                          <th className="pb-2">Ordered</th>
                          <th className="pb-2">Remaining</th>
                          <th className="pb-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {po.items.map(item => (
                          <tr key={item.id} className="border-t border-slate-800/30">
                            <td className="py-2">{item.ingredient.name}</td>
                            <td className="py-2">{item.orderedQuantity} {item.ingredient.purchaseUnit}</td>
                            <td className="py-2 font-medium text-emerald-400">{item.remainingQuantity}</td>
                            <td className="py-2 text-right">${item.totalCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {vendors.map(v => (
              <div key={v.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">{v.name}</h3>
                <p className="text-sm text-slate-400">{v.contactName || 'No contact specified'}</p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>{v.email || 'No email'}</p>
                  <p>{v.phone || 'No phone'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New PO Modal */}
      {showNewPO && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-white">Create Purchase Order</h2>
              <button onClick={() => setShowNewPO(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Select Vendor</label>
                <select 
                  value={newPOVendor}
                  onChange={e => setNewPOVendor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Order Items</label>
                <div className="space-y-3">
                  {newPOItems.map((item, idx) => (
                    <div key={idx} className="flex space-x-2">
                      <select
                        value={item.ingredientId}
                        onChange={e => {
                          const n = [...newPOItems];
                          n[idx].ingredientId = e.target.value;
                          const ing = ingredients.find(i => i.id === e.target.value);
                          if (ing) n[idx].unitCost = ing.costPerPurchaseUnit;
                          setNewPOItems(n);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm"
                      >
                        <option value="">Select Item</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.purchaseUnit})</option>)}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => {
                          const n = [...newPOItems];
                          n[idx].quantity = parseFloat(e.target.value) || 0;
                          setNewPOItems(n);
                        }}
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Cost"
                        value={item.unitCost}
                        onChange={e => {
                          const n = [...newPOItems];
                          n[idx].unitCost = parseFloat(e.target.value) || 0;
                          setNewPOItems(n);
                        }}
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm text-center"
                      />
                      <button 
                        onClick={() => setNewPOItems(newPOItems.filter((_, i) => i !== idx))}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setNewPOItems([...newPOItems, { ingredientId: '', quantity: 1, unitCost: 0 }])}
                    className="w-full py-2 border border-dashed border-slate-700 text-slate-400 rounded-lg hover:text-white hover:border-slate-500 transition-colors text-sm flex items-center justify-center"
                  >
                    <Plus size={16} className="mr-2" /> Add Item
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end space-x-3 shrink-0 bg-slate-900/50">
              <button onClick={() => setShowNewPO(false)} className="px-4 py-2 text-slate-400 hover:text-white font-medium">
                Cancel
              </button>
              <button onClick={handleCreatePO} disabled={!newPOVendor || newPOItems.length === 0} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
                Create PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Goods Modal */}
      {receivePO && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">Receive Goods</h2>
                <p className="text-sm text-slate-400">{receivePO.poNumber}</p>
              </div>
              <button onClick={() => setReceivePO(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 text-xs uppercase bg-slate-950">
                  <tr>
                    <th className="p-3 rounded-l-lg">Item</th>
                    <th className="p-3">Remaining</th>
                    <th className="p-3 rounded-r-lg w-32">Receive Qty</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {receivePO.items.map(item => {
                    if (item.remainingQuantity <= 0) return null;
                    return (
                      <tr key={item.id} className="border-b border-slate-800/30">
                        <td className="py-3 font-medium">{item.ingredient.name}</td>
                        <td className="py-3 text-emerald-400">{item.remainingQuantity} {item.ingredient.purchaseUnit}</td>
                        <td className="py-3">
                          <input
                            type="number"
                            min="0"
                            max={item.remainingQuantity}
                            value={receiveQuantities[item.id] || ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              setReceiveQuantities({ ...receiveQuantities, [item.id]: v });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-emerald-500 outline-none"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end space-x-3 shrink-0 bg-slate-900/50">
              <button onClick={() => setReceivePO(null)} className="px-4 py-2 text-slate-400 hover:text-white font-medium">
                Cancel
              </button>
              <button 
                onClick={handleReceiveGoods} 
                disabled={Object.values(receiveQuantities).filter(v => v > 0).length === 0} 
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                Finalize Receipt & Post Ledger
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
