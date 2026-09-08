const fs = require('fs');
let content = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const targetStart = `              {/* Customer Details Display Area */}`;
const targetEnd = `              ) : null}
            </div>`;

const replacement = `              {/* Customer Details Display Area */}
              {customerLookupStatus === 'new' ? (
                <div className="bg-[#141417] border border-blue-500/20 rounded-xl p-3 mt-0.5 flex flex-col gap-2 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
                   <div className="flex items-center gap-1.5 mb-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                     <span className="text-[0.65rem] uppercase font-bold tracking-wider text-blue-400">New Customer Profile</span>
                   </div>
                   <div className="space-y-2">
                     <div className="relative">
                       <User className="w-4 h-4 text-[#e4e4e7]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                       <input type="text" placeholder="Full Name (Required)" value={posCart.customer?.name || ''} onChange={(e) => setPosCustomerField('name', e.target.value)} className="w-full bg-[#0c0c0e] border border-[#e4e4e7]/10 rounded-lg pl-9 pr-3 py-2 text-[0.8rem] text-[#e4e4e7] placeholder:text-[#e4e4e7]/40 focus:outline-none focus:border-blue-500/50 transition-colors" />
                     </div>
                     <div className="relative">
                       <MapPin className="w-4 h-4 text-[#e4e4e7]/40 absolute left-3 top-2.5" />
                       <textarea rows={2} placeholder="Delivery Address (Optional)" value={posCart.customer?.address || ''} onChange={(e) => setPosCustomerField('address', e.target.value)} className="w-full bg-[#0c0c0e] border border-[#e4e4e7]/10 rounded-lg pl-9 pr-3 py-2 text-[0.8rem] text-[#e4e4e7] placeholder:text-[#e4e4e7]/40 focus:outline-none focus:border-blue-500/50 transition-colors resize-none" />
                     </div>
                   </div>
                </div>
              ) : customerLookupStatus === 'found' && posCart.customer ? (
                <div className="bg-[#141417] border border-emerald-500/30 rounded-xl p-3 mt-0.5 flex flex-col shadow-sm relative overflow-hidden group">
                   <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity">
                      <button onClick={() => setIsCustomerModalOpen(true)} className="text-[#e4e4e7] bg-[#27272a] rounded-md p-1.5 hover:bg-emerald-600 transition-colors cursor-pointer border border-[#e4e4e7]/10" title="View Full Profile">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                   </div>
                   <div className="flex items-center gap-2.5 mb-1.5">
                     <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                       <User className="w-4.5 h-4.5 text-emerald-400" />
                     </div>
                     <div className="flex flex-col min-w-0 pr-8">
                       <span className="font-bold text-[#e4e4e7] text-[0.85rem] truncate leading-tight">{posCart.customer.name}</span>
                       <span className="text-[0.75rem] text-emerald-400 font-['JetBrains_Mono',monospace] font-bold leading-tight mt-0.5">{posCart.customer.phone}</span>
                     </div>
                   </div>
                   {posCart.customer.address && (
                     <div className="flex items-start gap-1.5 mt-2.5 border-t border-[#e4e4e7]/10 pt-2.5">
                       <MapPin className="w-3.5 h-3.5 text-[#e4e4e7]/40 shrink-0 mt-0.5" />
                       <span className="text-[0.75rem] text-[#e4e4e7]/70 line-clamp-2 leading-snug">{posCart.customer.address}</span>
                     </div>
                   )}
                   {foundCustomer && (
                     <div className="flex items-center justify-between gap-4 mt-2.5 pt-2.5 border-t border-[#e4e4e7]/10 bg-[#0c0c0e]/50 -mx-3 -mb-3 px-3 py-2 rounded-b-xl">
                       <div className="flex flex-col">
                         <span className="text-[0.6rem] text-[#e4e4e7]/50 uppercase font-bold tracking-wider">Visits</span>
                         <span className="text-[0.8rem] font-['JetBrains_Mono',monospace] font-bold text-[#e4e4e7]">{foundCustomer.totalVisits || 1}</span>
                       </div>
                       <div className="flex flex-col text-right">
                         <span className="text-[0.6rem] text-[#e4e4e7]/50 uppercase font-bold tracking-wider">Points</span>
                         <span className="text-[0.8rem] font-['JetBrains_Mono',monospace] font-bold text-amber-400">{foundCustomer.loyaltyPoints || 0}</span>
                       </div>
                     </div>
                   )}
                </div>
              ) : null}
            </div>`;

const fullContent = content;
const startIndex = fullContent.indexOf(targetStart);
const endIndex = fullContent.indexOf(targetEnd) + targetEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = fullContent.substring(0, startIndex) + replacement + fullContent.substring(endIndex);
    fs.writeFileSync('src/components/pos/POSWorkstation.tsx', newContent);
    console.log('Customer Details replaced successfully.');
} else {
    console.log('Targets not found', startIndex, endIndex);
}
