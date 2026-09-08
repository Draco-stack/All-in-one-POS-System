const fs = require('fs');
let content = fs.readFileSync('src/components/history/CustomerHistoryView.tsx', 'utf8');

// Update Table headers and rows
content = content.replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Invoice</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Invoice</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Time</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Time</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Name</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Name</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Phone</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Phone</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10 w-1/4">Address</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10 w-1/4">Address</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Outlet</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Outlet</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Type</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Type</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">By</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">By</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Total</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Total</th>`
).replace(
  `                <th className="text-left py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">Status</th>`,
  `                <th className="text-left py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">Status</th>`
).replace(
  `                <th className="text-right py-3 px-4 text-[#e4e4e7]/60 font-semibold text-[0.7rem] uppercase tracking-[0.1em] sticky top-0 bg-[#0c0c0e] z-10">View</th>`,
  `                <th className="text-right py-4 px-4 text-white font-extrabold text-[0.8rem] capitalize sticky top-0 bg-[#0c0c0e] z-10">View</th>`
);

// Update table rows
content = content.replace(
  /<td className="py-4 px-4 font-\['JetBrains_Mono',monospace\] font-bold text-\[#e4e4e7\] border-y border-l border-\[#e4e4e7\]\/10 rounded-l-lg border-r-0 text-\[0.8rem\]">/g,
  `<td className="py-4 px-4 font-['Inter',sans-serif] text-[#e4e4e7]/80 border-y border-l border-[#e4e4e7]/10 border-r-0 text-[0.85rem]">`
).replace(
  /<td className="py-4 px-4 font-bold text-\[#e4e4e7\] border-y border-\[#e4e4e7\]\/10">/g,
  `<td className="py-4 px-4 text-[#e4e4e7] text-[0.85rem] border-y border-[#e4e4e7]/10">`
).replace(
  /<td className="py-4 px-4 font-\['JetBrains_Mono',monospace\] text-\[#e4e4e7\] text-\[0.8rem\] border-y border-\[#e4e4e7\]\/10">/g,
  `<td className="py-4 px-4 font-['Inter',sans-serif] text-[#e4e4e7]/80 text-[0.85rem] border-y border-[#e4e4e7]/10">`
).replace(
  /font-\['JetBrains_Mono',monospace\] font-bold text-\[#e4e4e7\] text-\[0.8rem\] border-y/g,
  `font-['Inter',sans-serif] text-[#e4e4e7] text-[0.85rem] border-y`
).replace(
  /font-bold text-\[#e4e4e7\] text-\[0.8rem\] border-y/g,
  `font-bold text-white text-[0.85rem] border-y`
);

// Update footer buttons (they are bright green with white text in screenshot)
content = content.replace(
  `<button className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-emerald-500/20 flex items-center gap-1.5">`,
  `<button className="bg-[#10b981] text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">`
).replace(
  `<button className="bg-emerald-500 text-[#0c0c0e] border border-emerald-500 px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-emerald-400 flex items-center gap-1.5">`,
  `<button className="bg-[#10b981] text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">`
).replace(
  `<button className="bg-emerald-500 text-[#0c0c0e] border border-emerald-500 px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-emerald-400 flex items-center gap-1.5">`,
  `<button className="bg-[#10b981] text-white border border-[#10b981] px-3 py-1.5 rounded-md font-bold text-[0.8rem] cursor-pointer hover:bg-[#059669] flex items-center gap-1.5">`
);

// Ensure the main table row has no rounded corners if the screenshot doesn't show them
content = content.replace(/rounded-l-lg/g, "").replace(/rounded-r-lg/g, "");

// Ensure "View" button is solid green
content = content.replace(
  `<button className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-md p-1.5 cursor-pointer hover:bg-emerald-500/30 transition">`,
  `<button className="bg-[#10b981] text-white border border-[#10b981] rounded-md p-1.5 cursor-pointer hover:bg-[#059669] transition shadow-[0_0_10px_rgba(16,185,129,0.3)]">`
).replace(
  `const dt = new Date(order.createdAt);`,
  `const dt = new Date(order.createdAt);
                  const names = (order.customer?.name || 'Walk-in').split(' ');
                  const firstName = names[0];
                  const lastName = names.slice(1).join(' ');`
).replace(
  `{order.customer?.name || 'Walk-in'}`,
  `{firstName}<br />{lastName}`
);

fs.writeFileSync('src/components/history/CustomerHistoryView.tsx', content);
