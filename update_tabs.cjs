const fs = require('fs');
let content = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

// Replace tab classes
content = content.replace(
  /className=\{`px-3 py-1\.5 rounded-t-xl text-xs font-extrabold transition-all flex items-center gap-1\.5 cursor-pointer select-none \$\{([^}]+)\}`\}/,
  "className={`px-0 py-2 text-[1.1rem] font-['Syne',sans-serif] font-extrabold transition-all flex items-center gap-2 cursor-pointer select-none relative ${middleTab === 'active_ticket' ? 'text-emerald-500 after:content-[\"\"] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-emerald-500' : 'text-[#e4e4e7]/50 hover:text-[#e4e4e7]'}`}"
);
content = content.replace(
  /className=\{`px-3 py-1\.5 rounded-t-xl text-xs font-extrabold transition-all flex items-center gap-1\.5 cursor-pointer select-none \$\{([^}]+)\}`\}/,
  "className={`px-0 py-2 text-[1.1rem] font-['Syne',sans-serif] font-extrabold transition-all flex items-center gap-2 cursor-pointer select-none relative ${middleTab === 'order_details' ? 'text-emerald-500 after:content-[\"\"] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-emerald-500' : 'text-[#e4e4e7]/50 hover:text-[#e4e4e7]'}`}"
);
content = content.replace(
  /className=\{`px-3 py-1\.5 rounded-t-xl text-xs font-extrabold transition-all flex items-center gap-1\.5 cursor-pointer select-none \$\{([^}]+)\}`\}/,
  "className={`px-0 py-2 text-[1.1rem] font-['Syne',sans-serif] font-extrabold transition-all flex items-center gap-2 cursor-pointer select-none relative ${middleTab === 'all_orders' ? 'text-emerald-500 after:content-[\"\"] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-emerald-500' : 'text-[#e4e4e7]/50 hover:text-[#e4e4e7]'}`}"
);

// Ticket Active Punch Ticket header
// We'll replace the first row: Outlet, and toggles
// `<div className="flex flex-col p-2 gap-1.5 shrink-0 bg-[#161616]/90 border-b border-white/5 backdrop-blur-xs">`
content = content.replace(
  'className="flex flex-col p-2 gap-1.5 shrink-0 bg-[#161616]/90 border-b border-white/5 backdrop-blur-xs"',
  'className="flex flex-col px-6 py-6 gap-3 shrink-0 border-b border-[#e4e4e7]/10"'
);

// Add Client details label
content = content.replace(
  '{/* Row 1: Select Outlet */}',
  '<h2 className="font-[\'JetBrains_Mono\',monospace] text-[0.6rem] uppercase tracking-[0.15em] text-[#e4e4e7]/50 mb-1">Client Details</h2>'
);

// Select Outlet dropdown
content = content.replace(
  'className="bg-stone-950/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 flex-1 cursor-pointer transition-all"',
  'className="bg-[#141417] border border-[#e4e4e7]/10 rounded-lg px-3 py-2.5 text-[0.8rem] text-[#e4e4e7] appearance-none focus:outline-none focus:border-emerald-500 w-full transition-all"'
);

// The toggle group (DineIn/TakeAway/Delivery) is inside `<div className="flex bg-stone-950/80 rounded-xl p-0.5 border border-white/5 shadow-inner">`
// We replace it similarly to the Orders toggle group.
content = content.replace(
  'className="flex bg-stone-950/80 rounded-xl p-0.5 border border-white/5 shadow-inner"',
  'className="flex bg-[#141417] rounded-lg p-1 w-full"'
);

content = content.replace(
  /className=\{`flex-1 text-\[10px\] uppercase font-bold tracking-wider py-1\.5 rounded-lg transition-all duration-200 cursor-pointer \$\{posOrderType === 'dine_in' \? '[^']+' : '[^']+'\}`\}/,
  "className={`flex-1 border-none py-2 px-2 text-[0.75rem] font-semibold rounded-md cursor-pointer uppercase transition-all ${posOrderType === 'dine_in' ? 'bg-[#27272a] text-[#e4e4e7]' : 'bg-transparent text-[#e4e4e7]/50'}`}"
);
content = content.replace(
  /className=\{`flex-1 text-\[10px\] uppercase font-bold tracking-wider py-1\.5 rounded-lg transition-all duration-200 cursor-pointer \$\{posOrderType === 'takeaway' \? '[^']+' : '[^']+'\}`\}/,
  "className={`flex-1 border-none py-2 px-2 text-[0.75rem] font-semibold rounded-md cursor-pointer uppercase transition-all ${posOrderType === 'takeaway' ? 'bg-[#27272a] text-[#e4e4e7]' : 'bg-transparent text-[#e4e4e7]/50'}`}"
);
content = content.replace(
  /className=\{`flex-1 text-\[10px\] uppercase font-bold tracking-wider py-1\.5 rounded-lg transition-all duration-200 cursor-pointer \$\{posOrderType === 'delivery' \? '[^']+' : '[^']+'\}`\}/,
  "className={`flex-1 border-none py-2 px-2 text-[0.75rem] font-semibold rounded-md cursor-pointer uppercase transition-all ${posOrderType === 'delivery' ? 'bg-[#27272a] text-[#e4e4e7]' : 'bg-transparent text-[#e4e4e7]/50'}`}"
);


// Customer Input
content = content.replace(
  'className="w-full bg-stone-950/80 border border-white/10 rounded-xl pl-2.5 pr-8 py-1.5 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"',
  'className="w-full bg-black border border-[#e4e4e7]/10 rounded-lg px-3 py-2 text-[0.8rem] text-[#e4e4e7] focus:outline-none focus:border-emerald-500 transition-all placeholder:text-[#e4e4e7]/50"'
);

// Active Ticket Footer
content = content.replace(
  'className="p-3 bg-[#111111] border-t border-white/10 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-10"',
  'className="p-6 bg-[#141417] border-t border-[#e4e4e7]/10 shrink-0 z-10"'
);

// Discount / Service Charge / Tax row
content = content.replace(
  'className="flex flex-row gap-1.5 mb-3"',
  'className="flex gap-2 mb-3"'
);

// Discount button
content = content.replace(
  'className="flex-1 bg-stone-950 hover:bg-stone-900 border border-white/10 text-stone-300 rounded-lg py-1.5 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"',
  'className="flex-1 bg-[#27272a] text-[#e4e4e7] border border-[#e4e4e7]/10 py-2.5 rounded-lg text-[0.75rem] font-semibold cursor-pointer flex items-center justify-center gap-1"'
);

// Notes input
content = content.replace(
  'className="w-full bg-stone-950/50 border border-white/5 rounded-lg pl-7 pr-2 py-1.5 text-xs text-stone-300 placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none overflow-hidden"',
  'className="w-full bg-black border border-[#e4e4e7]/10 rounded-lg pl-8 pr-3 py-2 text-[0.8rem] text-[#e4e4e7] placeholder:text-[#e4e4e7]/50 focus:outline-none focus:border-emerald-500 resize-none overflow-hidden"'
);

// Place order button
content = content.replace(
  'className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold tracking-wide uppercase py-4 rounded-xl shadow-lg border border-emerald-400/20 w-full transition-all duration-200 active:scale-[0.98] flex items-center justify-between px-5 text-sm cursor-pointer hover:shadow-emerald-900/40"',
  'className="w-full bg-emerald-500 text-black border-none py-4 rounded-xl font-bold text-[0.9rem] cursor-pointer mt-4 font-[\'Inter\',sans-serif] uppercase tracking-[0.05em] transition-all hover:bg-emerald-400 flex items-center justify-between px-5"'
);

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', content);
