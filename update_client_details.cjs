const fs = require('fs');
let content = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const targetStart = `            <div className="flex flex-col px-6 py-6 gap-3 shrink-0 border-b border-[#e4e4e7]/10">`;
const targetEnd = `              {/* Customer Details Display Area */}`;

const replacement = `            <div className="flex flex-col px-6 py-6 gap-3 shrink-0 border-b border-[#e4e4e7]/10">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-['JetBrains_Mono',monospace] text-[0.6rem] uppercase tracking-[0.15em] text-[#e4e4e7]/50">Client Details</h2>
                {customerLookupStatus === 'found' && (
                  <button onClick={() => setIsCustomerHistoryOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md transition-colors cursor-pointer text-[0.65rem] font-bold uppercase tracking-wider">
                    <History className="w-3 h-3" />
                    Full History
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} className="bg-[#141417] border border-[#e4e4e7]/10 rounded-lg px-3 py-2.5 text-[0.8rem] text-[#e4e4e7] appearance-none focus:outline-none focus:border-emerald-500 w-full transition-all">
                  <option value="">Select Outlet</option>
                  {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => showToast('WhatsApp Sync Status')} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-emerald-400/20"><Check className="w-4 h-4 stroke-[3]" /></button>
                <button onClick={handleResetTicket} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-1.5 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 shadow-sm border border-red-400/20"><X className="w-4 h-4 stroke-[3]" /></button>
              </div>
              
              {/* Row 2: Order Type & Source */}
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-xl overflow-hidden shrink-0 border border-white/10 bg-stone-950/80 p-0.5 shadow-inner">
                  <button onClick={() => setPosOrderType('dine_in')} className={\`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer \${posCart.orderType === 'dine_in' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm border border-amber-400/30' : 'text-stone-400 hover:text-white'}\`}>DineIn</button>
                  <button onClick={() => setPosOrderType('takeaway')} className={\`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer \${posCart.orderType === 'takeaway' ? 'bg-gradient-to-r from-stone-700 to-stone-800 text-white shadow-sm border border-white/10' : 'text-stone-400 hover:text-white'}\`}>TakeAway</button>
                  <button onClick={() => setPosOrderType('delivery')} className={\`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-150 cursor-pointer \${posCart.orderType === 'delivery' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-400/30' : 'text-stone-400 hover:text-white'}\`}>Delivery</button>
                </div>
                <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 cursor-pointer transition-all">
                  <option value="Pos">Select Source</option>
                  <option value="Blink Co Mobile">Blink Co Mobile</option>
                  <option value="Website Web">Website Web</option>
                  <option value="Call Center">Call Center</option>
                </select>
              </div>
              
              {/* Row 3: Customer Input */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Enter Phone..."
                    value={phoneSearchInput}
                    onChange={(e) => setPhoneSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneLookup(undefined, true); }}
                    className="w-full bg-stone-950/80 border border-white/10 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white font-['JetBrains_Mono',monospace] placeholder:text-stone-500 placeholder:font-['Inter',sans-serif] focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
                  />
                  <Phone className="w-3.5 h-3.5 text-emerald-500/70 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button onClick={() => handlePhoneLookup(undefined, true)} className="bg-emerald-500 hover:bg-emerald-400 text-black p-2 rounded-xl shrink-0 cursor-pointer transition-all hover:scale-105 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" title="Search Customer">
                  <Search className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
              
              {/* Customer Details Display Area */}`;

const fullContent = content;
const startIndex = fullContent.indexOf(targetStart);
const endIndex = fullContent.indexOf(targetEnd) + targetEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = fullContent.substring(0, startIndex) + replacement + fullContent.substring(endIndex);
    fs.writeFileSync('src/components/pos/POSWorkstation.tsx', newContent);
    console.log('Client Details replaced successfully.');
} else {
    console.log('Targets not found', startIndex, endIndex);
}
