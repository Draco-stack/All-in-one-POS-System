import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Eye, RotateCw, RefreshCw, X, Search, ChevronLeft, ChevronRight, Copy, Download, Printer } from 'lucide-react';
import { Order } from '../../types';

interface CustomerHistoryViewProps {
  onClose: () => void;
  initialPhone?: string;
}

export const CustomerHistoryView: React.FC<CustomerHistoryViewProps> = ({ onClose, initialPhone = '' }) => {
  const { orders, currentUser, customers } = useRestaurant();
  const [phoneSearch, setPhoneSearch] = useState(initialPhone);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Find customer based on search
  const customer = phoneSearch ? customers.find(c => c.phone.includes(phoneSearch) || c.name.toLowerCase().includes(phoneSearch.toLowerCase())) : null;
  
  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (!phoneSearch) return true;
    return o.customer?.phone.includes(phoneSearch) || o.customer?.name.toLowerCase().includes(phoneSearch.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="w-full h-full flex overflow-hidden bg-white dark:bg-[#0c0c0e] text-slate-800 dark:text-[#e4e4e7] font-['Inter',sans-serif] select-none absolute inset-0 z-50">
      {/* Sidebar Navigation */}
      <aside className="w-[80px] bg-white dark:bg-[#141417] border-r border-slate-300 dark:border-[#e4e4e7]/10 flex flex-col items-center py-6 gap-8 shrink-0 z-20">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-['Syne',sans-serif] font-extrabold text-black text-xl bg-[#e4e4e7] cursor-pointer hover:bg-white transition-all shadow-[0_0_20px_rgba(228,228,231,0.2)]">
          H
        </div>
        
        {/* Placeholder Nav Icons from original CSS */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 dark:text-[#e4e4e7]/60 hover:bg-slate-100 dark:hover:bg-[#e4e4e7]/10 hover:text-slate-900 dark:hover:text-[#e4e4e7] cursor-pointer transition-all border border-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-900 dark:text-white bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer transition-all border border-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 dark:text-[#e4e4e7]/60 hover:bg-slate-100 dark:hover:bg-[#e4e4e7]/10 hover:text-slate-900 dark:hover:text-[#e4e4e7] cursor-pointer transition-all border border-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
        </div>
        
        <div className="mt-auto w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 dark:text-[#e4e4e7]/60 hover:bg-slate-100 dark:hover:bg-[#e4e4e7]/10 hover:text-slate-900 dark:hover:text-[#e4e4e7] cursor-pointer transition-all border border-transparent" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-[radial-gradient(circle_at_top_right,#1a1a20,#0c0c0e)] relative overflow-hidden">
        
        {/* Top Filters Header */}
        <div className="px-8 py-4 bg-white dark:bg-[#141417]/50 backdrop-blur-md flex items-center gap-4 shrink-0 border-b border-slate-300 dark:border-[#e4e4e7]/10 z-20">
          <select className="bg-transparent text-slate-800 dark:text-[#e4e4e7] border border-slate-300 dark:border-[#e4e4e7]/10 rounded-md px-3 py-2 text-[0.85rem] focus:outline-none appearance-none flex-1 font-semibold">
            <option>Select User</option>
          </select>
          <select className="bg-transparent text-slate-800 dark:text-[#e4e4e7] border border-slate-300 dark:border-[#e4e4e7]/10 rounded-md px-3 py-2 text-[0.85rem] focus:outline-none appearance-none flex-1 font-semibold">
            <option>Select Outlet</option>
          </select>
          <select className="bg-transparent text-slate-800 dark:text-[#e4e4e7] border border-slate-300 dark:border-[#e4e4e7]/10 rounded-md px-3 py-2 text-[0.85rem] focus:outline-none appearance-none flex-1 font-semibold">
            <option>Select Date</option>
          </select>
          
          <div className="relative flex-[2]">
            <input 
              type="text" 
              placeholder="Customer Search" 
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-300 dark:border-[#e4e4e7]/10 rounded-lg px-4 py-2 text-slate-800 dark:text-[#e4e4e7] text-[0.85rem] focus:outline-none font-semibold"
            />
          </div>
          
          <button className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#27272a] text-slate-800 dark:text-[#e4e4e7] hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors border border-slate-300 dark:border-[#e4e4e7]/10 cursor-pointer flex items-center justify-center">
            <RotateCw className="w-4 h-4" />
          </button>
          
          <button onClick={onClose} className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-slate-900 dark:text-white transition-colors border border-red-500/30 cursor-pointer flex items-center justify-center">
            <div className="w-4 h-0.5 bg-white rounded-full"></div>
          </button>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto px-8 pb-8 pt-4 custom-scrollbar">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Invoice</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Time</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Name</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Phone</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10 w-1/4">Address</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Outlet</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Type</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">By</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Total</th>
                <th className="text-left py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">Status</th>
                <th className="text-right py-4 px-4 text-slate-900 dark:text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-white dark:bg-[#0c0c0e] z-10">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500 dark:text-[#e4e4e7]/60 font-semibold">
                    No order history found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const dt = new Date(order.createdAt);
                  const names = (order.customer?.name || 'Walk-in').split(' ');
                  const firstName = names[0];
                  const lastName = names.slice(1).join(' ');
                  return (
                    <tr key={order.id} className="bg-white dark:bg-[#141417] hover:bg-[#1c1c21] hover:scale-[1.002] transition-transform duration-200">
                      <td className="py-4 px-4 font-['Inter',sans-serif] text-slate-600 dark:text-[#e4e4e7]/80 border-y border-l border-slate-300 dark:border-[#e4e4e7]/10 border-r-0 text-[0.85rem]">
                        {order.orderNumber || order.id}
                      </td>
                      <td className="py-4 px-4 border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        <div className="font-['JetBrains_Mono',monospace] text-slate-500 dark:text-[#e4e4e7]/60 text-[0.7rem] mb-0.5">{dt.toISOString().split('T')[0]}</div>
                        <div className="font-['JetBrains_Mono',monospace] font-bold text-slate-800 dark:text-[#e4e4e7] text-[0.85rem]">{dt.toTimeString().split(' ')[0].substring(0,5)}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-800 dark:text-[#e4e4e7] text-[0.85rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {firstName}<br />{lastName}
                      </td>
                      <td className="py-4 px-4 font-['Inter',sans-serif] text-slate-600 dark:text-[#e4e4e7]/80 text-[0.85rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.customer?.phone || 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-[#e4e4e7]/80 text-[0.8rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.customer?.address || '-'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-[#e4e4e7]/80 text-[0.8rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.branchName || order.outlet || 'Main Branch'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-[#e4e4e7]/80 text-[0.8rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.orderType || 'delivery'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-[#e4e4e7]/80 text-[0.8rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.punchedBy || order.cashierName || order.riderName || 'Staff'}
                      </td>
                      <td className="py-4 px-4 font-['Inter',sans-serif] text-slate-800 dark:text-[#e4e4e7] text-[0.85rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        {order.total?.toLocaleString() || '0'}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white text-[0.85rem] border-y border-slate-300 dark:border-[#e4e4e7]/10">
                        <div className="flex flex-col">
                          <span>{order.status === 'delivered' ? 'Completed' : order.status}</span>
                          {order.status === 'delivered' && <span className="font-['JetBrains_Mono',monospace] font-extrabold">{order.deliveryElapsedMinutes || '47'}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right border-y border-r border-slate-300 dark:border-[#e4e4e7]/10  border-l-0">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="bg-[#10b981] text-slate-900 dark:text-white border border-[#10b981] rounded-md p-1.5 cursor-pointer hover:bg-[#059669] transition shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95"
                          title="View complete order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Complete Order Details Receipt Modal */}
        {selectedOrder && (
          <div 
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedOrder(null);
            }}
          >
            <div className="bg-white dark:bg-[#141417] border border-slate-300 dark:border-white/20 rounded-xl p-6 w-full max-w-[450px] shadow-2xl text-slate-800 dark:text-[#e4e4e7] relative font-['Inter',sans-serif] select-text">
              {/* Close Button */}
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="absolute top-3.5 right-3.5 text-slate-500 dark:text-stone-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Restaurant / Outlet Name Header */}
              <div className="text-center font-bold text-slate-900 dark:text-stone-100 text-[0.95rem] pb-2.5">
                White's Castle {selectedOrder.branchName || selectedOrder.outlet || ''}
              </div>

              {/* Top Info Bar: Order Number | Type | Payment Status */}
              <div className="border-y border-white/25 py-2 flex justify-between items-center text-[0.8rem] font-semibold">
                <span className="font-mono text-stone-200">{selectedOrder.orderNumber || selectedOrder.id}</span>
                <span className="capitalize text-slate-700 dark:text-stone-300">{(selectedOrder.orderType || selectedOrder.type || 'delivery').replace('_', ' ')}</span>
                <span className="text-stone-200 uppercase">{selectedOrder.paymentStatus || 'Unpaid'}</span>
              </div>

              {/* DateTime, Channel & Customer Information */}
              <div className="py-2.5 space-y-1.5 text-[0.8rem]">
                <div className="flex justify-between items-center">
                  <div className="font-['JetBrains_Mono',monospace] text-stone-200">
                    {new Date(selectedOrder.createdAt).toISOString().split('T')[0]}{' '}
                    <span className="font-bold">{new Date(selectedOrder.createdAt).toTimeString().split(' ')[0].substring(0, 5)}</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-stone-100">
                    {selectedOrder.source || selectedOrder.sourceChannel || selectedOrder.orderType || selectedOrder.type || '-'}
                  </div>
                </div>

                <div className="font-bold text-slate-900 dark:text-white text-[0.85rem]">
                  {selectedOrder.customer?.name || 'Walk-in'}
                </div>

                <div className="font-['JetBrains_Mono',monospace] text-slate-700 dark:text-stone-300">
                  {selectedOrder.customer?.phone || 'N/A'}
                </div>

                <div className="text-slate-700 dark:text-stone-300 text-[0.8rem] leading-snug">
                  {selectedOrder.customer?.address || selectedOrder.deliveryAddress || 'No address specified'}
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t border-white/25 py-2.5 space-y-2 text-[0.8rem]">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => {
                    const itemNote = item.itemNote || item.notes || item.flavor || item.customization;
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between items-center text-stone-200">
                          <span className="font-semibold">
                            {item.name} <span className="font-bold">X {item.quantity}</span>
                          </span>
                          <span className="font-mono font-bold">
                            {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                        {itemNote && (
                          <div className="text-[0.75rem] text-slate-500 dark:text-stone-400 pl-1">
                            ({item.name}) {itemNote}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 dark:text-stone-400 text-center py-1">No items recorded</div>
                )}
              </div>

              {/* Subtotal & Total Section */}
              <div className="border-t border-white/25 py-2 space-y-1.5 text-[0.8rem]">
                <div className="flex justify-between items-center text-slate-700 dark:text-stone-300">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{(selectedOrder.subtotal || selectedOrder.total).toLocaleString()}</span>
                </div>
                {Boolean(selectedOrder.discount && selectedOrder.discount > 0) && (
                  <div className="flex justify-between items-center text-slate-500 dark:text-stone-400">
                    <span>Discount</span>
                    <span className="font-mono">-{selectedOrder.discount.toLocaleString()}</span>
                  </div>
                )}
                {Boolean(selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0) && (
                  <div className="flex justify-between items-center text-slate-500 dark:text-stone-400">
                    <span>Delivery Fee</span>
                    <span className="font-mono">+{selectedOrder.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-white/25 pt-2 flex justify-between items-center font-bold text-slate-900 dark:text-white text-[0.9rem]">
                  <span>Total</span>
                  <span className="font-mono">{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Delivery Note & Punched By Section */}
              <div className="border-t border-white/25 pt-2 text-[0.8rem] space-y-1.5">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500 dark:text-stone-400 font-semibold shrink-0">Delivery Note</span>
                  <span className="text-stone-200 text-right pl-4">
                    {selectedOrder.customer?.notes || selectedOrder.notes || (selectedOrder.items && selectedOrder.items.find(i => i.itemNote || i.notes)?.itemNote) || (selectedOrder.items && selectedOrder.items.find(i => i.itemNote || i.notes)?.notes) || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[0.75rem] text-slate-500 dark:text-stone-400 pt-1.5 border-t border-slate-300 dark:border-white/10">
                  <span>Punched By</span>
                  <span className="text-slate-700 dark:text-stone-300 font-medium">
                    {selectedOrder.punchedBy || selectedOrder.cashierName || selectedOrder.riderName || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="px-8 py-3 border-t border-slate-300 dark:border-[#e4e4e7]/10 flex justify-between items-center bg-white dark:bg-[#0c0c0e] shrink-0">
          <div className="flex items-center gap-4">
            <div className="font-['JetBrains_Mono',monospace] text-[0.7rem] font-bold bg-white dark:bg-[#141417] border border-slate-300 dark:border-[#e4e4e7]/10 px-3 py-1.5 rounded-md flex items-center gap-2">
              {filteredOrders.length}
              <select className="bg-transparent text-slate-500 dark:text-[#e4e4e7]/60 focus:outline-none appearance-none cursor-pointer">
                <option>15</option>
              </select>
            </div>
            <span className="font-['Inter',sans-serif] text-[0.8rem] text-slate-500 dark:text-[#e4e4e7]/60">1-{filteredOrders.length} of {filteredOrders.length} Entries</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="bg-slate-100 dark:bg-[#e4e4e7]/10 text-slate-500 dark:text-[#e4e4e7]/60 px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-slate-200 dark:hover:bg-[#e4e4e7]/20 border border-slate-300 dark:border-[#e4e4e7]/10">&lt;</button>
            <button className="bg-emerald-500 text-slate-900 dark:text-white px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer">1</button>
            <button className="bg-slate-100 dark:bg-[#e4e4e7]/10 text-slate-500 dark:text-[#e4e4e7]/60 px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-slate-200 dark:hover:bg-[#e4e4e7]/20 border border-slate-300 dark:border-[#e4e4e7]/10">&gt;</button>
            
            <div className="flex gap-2 ml-4">
              <button className="bg-[#10b981] text-slate-900 dark:text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">
                Copy <Copy className="w-3.5 h-3.5" />
              </button>
              <button className="bg-[#10b981] text-slate-900 dark:text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">
                Export <Download className="w-3.5 h-3.5" />
              </button>
              <button className="bg-[#10b981] text-slate-900 dark:text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">
                Print <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
