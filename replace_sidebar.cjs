const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');
const startMatch = "  return (\n    <div className=\"flex h-[calc(100vh-4rem)]";
const endMatch = "      {/* 3. Middle Column: Whites Castle Call Center Ticket & Inline Customizer (~430px) */}";

const startIdx = code.indexOf(startMatch);
const endIdx = code.indexOf(endMatch, startIdx);

if(startIdx !== -1 && endIdx !== -1) {
  const target = code.substring(startIdx, endIdx);
  const replacement = `  return (
    <div className="flex h-full w-full bg-[#111] text-white overflow-hidden font-sans select-none">
      {/* Column 1: Blink Co Orders & Live Orders Queue */}
      <div className="w-[300px] bg-[#1a1a1a] flex flex-col shrink-0 overflow-hidden border-r border-[#222]">
        {/* Top Header */}
        <div className="h-8 bg-[#00897b] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold tracking-wide">Blink Co Orders</span>
        </div>
        
        {/* Search & Actions Row */}
        <div className="flex items-center gap-1 p-2 bg-[#222]">
          <div className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-sm flex items-center">
            <input
              type="text"
              placeholder="search orders"
              value={orderSearchFilter}
              onChange={(e) => setOrderSearchFilter(e.target.value)}
              className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
          <button
            className="w-[30px] h-[30px] bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsBlinkModalOpen(true)}
            className="w-[30px] h-[30px] bg-[#00897b] hover:bg-[#00796b] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Live Orders List / Queue (Empty area in reference image) */}
        <div className="flex-1 overflow-y-auto bg-[#1a1a1a] p-2 space-y-2">
          {filteredQueueOrders.map((order) => {
            const isDone = order.status === 'completed';
            const isCancelled = order.status === 'cancelled';
            return (
              <div
                key={order.id}
                className="bg-[#222] border border-[#333] rounded-[3px] p-2 shadow-xs transition hover:border-[#00897b]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-white">
                    {order.orderNumber}
                  </span>
                  <span className="text-[10px] text-[#00897b] font-bold">
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {order.customer.name || 'Walk-in'} • {order.customer.phone || 'No phone'}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs border-t border-[#333] pt-1">
                  <span className="text-slate-400">{order.items.length} items</span>
                  <span className="font-bold text-white">Rs. {order.total.toFixed(0)}</span>
                </div>
                {!isDone && !isCancelled && (
                  <button
                    onClick={() => handleCashoutOrder(order.id)}
                    className="w-full mt-1.5 bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-[10px] py-1 rounded-[3px] transition"
                  >
                    Complete / Cashout
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
\n`;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
  console.log('Replaced successfully');
} else {
  console.log('Could not find start or end index');
}
